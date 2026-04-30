import { CITIES } from "@/lib/cities";

import { browserFetch } from "./browser";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const PAGES_PER_CITY = 2;
const SLUG = "eventbrite";

/**
 * Eventbrite adapter. Eventbrite shut down their public API for new apps in
 * 2020, so we walk the public HTML listing per city and follow event detail
 * links. Detail pages embed schema.org/Event JSON-LD with the full record;
 * we parse that directly via `tryStructured` and skip the LLM.
 *
 * Eventbrite now serves a "Human Verification" interstitial on listing and
 * detail pages, requiring a real browser to pass.
 */
export const eventbriteAdapter: SourceAdapter = {
  slug: "eventbrite",
  label: "Eventbrite",
  baseUrl: "https://www.eventbrite.com",
  needsBrowser: "render",

  async listEvents({ signal }) {
    const seen = new Map<string, ListingItem>();

    for (const city of CITIES) {
      for (let page = 1; page <= PAGES_PER_CITY; page += 1) {
        const url = `https://www.eventbrite.com/d/${city.eventbriteSlug}/all-events/?page=${page}`;
        let html: string;
        try {
          const result = await browserFetch(url, {
            signal,
            label: `${SLUG}:list:${city.key}:p${page}`,
            timeoutMs: 30_000,
            waitForSelector: "a[href*='/e/']",
          });
          html = result.html;
        } catch (err) {
          console.warn(
            `[${SLUG}] warn="page fetch failed" city=${city.key} page=${page} error="${err instanceof Error ? err.message : String(err)}"`,
          );
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

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const { html } = await browserFetch(item.url, {
      signal,
      label: `${SLUG}:structured`,
      timeoutMs: 25_000,
    });
    const events = extractJsonLdEvents(html);
    for (const ev of events) {
      const extracted = jsonLdEventToExtracted(ev);
      if (extracted) {
        if (extracted.offer) {
          extracted.offer.ticketUrl ??= item.url;
        } else {
          extracted.offer = {
            ticketUrl: item.url,
            status: extracted.isFree ? "free" : "on_sale",
            currency: "USD",
            onSaleLocal: null,
            validFromLocal: null,
            tiers: null,
          };
        }
        return { event: extracted, canonicalUrl: ev.url || item.url };
      }
    }
    return null;
  },

  async fetchAndReduce(item, signal) {
    const { html, finalUrl } = await browserFetch(item.url, {
      signal,
      label: `${SLUG}:detail`,
      timeoutMs: 25_000,
    });
    return {
      reducedHtml: reduceHtml(html, finalUrl),
      canonicalUrl: finalUrl,
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
