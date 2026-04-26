import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import type { ListingItem, SourceAdapter } from "./types";

const ORIGIN = "https://www.tampabaymarkets.com";
const LISTING_URL = `${ORIGIN}/upcoming-markets-events`;

/**
 * Tampa Bay Markets (Squarespace). The site doesn't use a CMS taxonomy for
 * markets — each recurring market lives at its own root path (e.g.
 * `/sunday-market-st-pete`). We scrape the upcoming-markets-events listing
 * for every internal slug, then drop nav / utility paths. Markets are
 * recurring, so the LLM extractor's "next upcoming occurrence" rule yields
 * the right startAt.
 */
const SKIP_SLUGS = new Set([
  "cart",
  "jobs",
  "photos",
  "programs",
  "our-markets",
  "our-sponsors",
  "special-events",
  "market-and-events",
  "upcoming-markets-events",
  "gogreen",
  "fulfill-your-destiny-vendor-grant",
  "page",
  "about",
  "contact",
  "privacy",
  "terms",
  "newsletter",
  "blog",
  "news",
  "press",
]);

const SLUG_RE = /^\/[a-z0-9][a-z0-9-]*$/i;

export const tampaBayMarketsAdapter: SourceAdapter = {
  slug: "tampa_bay_markets",
  label: "Tampa Bay Markets",
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
    if (absolute.host !== "www.tampabaymarkets.com") return;
    const path = absolute.pathname.replace(/\/+$/, "");
    if (!SLUG_RE.test(path)) return;
    const slug = path.slice(1);
    if (SKIP_SLUGS.has(slug)) return;

    const url = `${ORIGIN}${path}`;
    if (!out.has(url)) out.set(url, { sourceEventId: slug, url });
  });

  return Array.from(out.values());
}
