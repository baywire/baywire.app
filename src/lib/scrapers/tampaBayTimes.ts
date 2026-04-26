import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import type { ListingItem, SourceAdapter } from "./types";

const ORIGIN = "https://www.tampabay.com";
const LISTING_URL = `${ORIGIN}/life-culture/entertainment/things-to-do/`;

const ARTICLE_RE =
  /^\/life-culture\/entertainment\/things-to-do\/(\d{4})\/(\d{2})\/(\d{2})\/([a-z0-9-]+)\/?$/i;

/**
 * Tampa Bay Times "Things to Do" hub. Articles are dated weekly roundups like
 * "Top events in Tampa Bay this week of April 20." Each roundup is treated as
 * a single source page; the LLM extracts the headline pick. Cross-source
 * duplicates dedupe via `(sourceId, sourceEventId)`.
 */
export const tampaBayTimesAdapter: SourceAdapter = {
  slug: "tampa_bay_times",
  label: "Tampa Bay Times — Things to Do",
  baseUrl: ORIGIN,

  async listEvents({ signal }) {
    const html = await politeFetch(LISTING_URL, { signal });
    return parseListing(html);
  },

  async fetchAndReduce(item, signal) {
    const html = await politeFetch(item.url, { signal });
    return {
      reducedHtml: reduceHtml(html, item.url),
      canonicalUrl: item.url,
    };
  },
};

function parseListing(html: string): ListingItem[] {
  const $ = loadHtml(html);
  const out = new Map<string, ListingItem>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let absolute: URL;
    try {
      absolute = new URL(href, ORIGIN);
    } catch {
      return;
    }
    if (absolute.host !== "www.tampabay.com") return;
    const path = absolute.pathname.replace(/\/+$/, "/");
    const match = ARTICLE_RE.exec(path);
    if (!match) return;
    const [, year, month, day, slug] = match;
    const url = `${ORIGIN}${path.replace(/\/$/, "")}`;
    const sourceEventId = `${year}${month}${day}-${slug}`;
    if (!out.has(url)) out.set(url, { sourceEventId, url });
  });

  return Array.from(out.values());
}
