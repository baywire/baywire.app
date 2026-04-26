import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import type { ListingItem, SourceAdapter } from "./types";

const ORIGIN = "https://www.tampa.gov";
const LISTING_URL = `${ORIGIN}/calendar`;

const DETAIL_RE = /^\/events\/([a-z0-9-]+)\/(\d+)$/i;

/**
 * City of Tampa calendar (Drupal). The /calendar page is server-rendered and
 * links to /events/{slug}/{id} detail pages, also SSR. We collect every
 * (slug, id) pair we can find — Drupal generally repeats links across the
 * grid view.
 */
export const tampaGovAdapter: SourceAdapter = {
  slug: "tampa_gov",
  label: "City of Tampa Calendar",
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
    if (absolute.host !== "www.tampa.gov") return;
    const path = absolute.pathname.replace(/\/+$/, "");
    const match = DETAIL_RE.exec(path);
    if (!match) return;
    const [, slug, id] = match;
    const url = `${ORIGIN}${path}`;
    const sourceEventId = `${slug}-${id}`;
    if (!out.has(url)) out.set(url, { sourceEventId, url });
  });

  return Array.from(out.values());
}
