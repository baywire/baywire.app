import { CITIES } from "@/lib/cities";

import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import type { ListingItem, SourceAdapter } from "./types";

const PAGES_PER_CITY = 2;

/**
 * Eventbrite adapter. Eventbrite shut down their public API for new apps in
 * 2020, so we walk the public HTML listing per city and follow event detail
 * links. Detail pages embed JSON-LD with full event data which dramatically
 * improves LLM extraction quality.
 */
export const eventbriteAdapter: SourceAdapter = {
  slug: "eventbrite",
  label: "Eventbrite",
  baseUrl: "https://www.eventbrite.com",

  async listEvents({ signal }) {
    const seen = new Map<string, ListingItem>();

    for (const city of CITIES) {
      for (let page = 1; page <= PAGES_PER_CITY; page += 1) {
        const url = `https://www.eventbrite.com/d/${city.eventbriteSlug}/all-events/?page=${page}`;
        let html: string;
        try {
          html = await politeFetch(url, { signal });
        } catch {
          break;
        }
        const items = parseListingHtml(html);
        if (items.length === 0) break;
        for (const item of items) {
          if (!seen.has(item.url)) seen.set(item.url, item);
        }
      }
    }

    return Array.from(seen.values());
  },

  async fetchAndReduce(item, signal) {
    const html = await politeFetch(item.url, { signal });
    return {
      reducedHtml: reduceHtml(html, item.url),
      canonicalUrl: item.url,
    };
  },
};

function parseListingHtml(html: string): ListingItem[] {
  const $ = loadHtml(html);
  const out = new Map<string, ListingItem>();

  $("a[href*='/e/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const absolute = href.startsWith("http") ? href : `https://www.eventbrite.com${href}`;
    const match = absolute.match(/^https:\/\/www\.eventbrite\.com\/e\/([^/?#]+)/);
    if (!match) return;
    const id = lastSegmentNumeric(match[1]);
    if (!id) return;
    const cleaned = `https://www.eventbrite.com/e/${match[1]}`;
    if (!out.has(cleaned)) {
      out.set(cleaned, { sourceEventId: id, url: cleaned });
    }
  });

  return Array.from(out.values());
}

function lastSegmentNumeric(slug: string): string | null {
  const parts = slug.split("-");
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? last : null;
}
