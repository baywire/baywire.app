import { browserFetch } from "./browser";
import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "eventbrite";

// Core cities that cover the Tampa Bay metro — suburbs like Brandon, Bradenton,
// Safety Harbor, Dunedin overlap heavily with these on Eventbrite listings.
const LISTING_SLUGS: readonly { key: string; slug: string }[] = [
  { key: "tampa", slug: "fl--tampa" },
  { key: "st_petersburg", slug: "fl--saint-petersburg" },
  { key: "clearwater", slug: "fl--clearwater" },
];

/**
 * Eventbrite adapter. Listing pages need a real browser to pass the "Human
 * Verification" interstitial, but detail pages serve JSON-LD server-side so
 * we use politeFetch for those (much faster, no browser overhead).
 */
export const eventbriteAdapter: SourceAdapter = {
  slug: "eventbrite",
  label: "Eventbrite",
  baseUrl: "https://www.eventbrite.com",
  needsBrowser: "render",

  async listEvents({ windowStart, windowEnd, signal }) {
    const seen = new Map<string, ListingItem>();
    const dateRange = formatDateRange(windowStart, windowEnd);

    for (const city of LISTING_SLUGS) {
      const url = `https://www.eventbrite.com/d/${city.slug}/all-events/?page=1${dateRange}`;
      let html: string;
      try {
        const result = await browserFetch(url, {
          signal,
          label: `${SLUG}:list:${city.key}`,
          timeoutMs: 20_000,
          waitUntil: "domcontentloaded",
          waitForSelector: "a[href*='/e/']",
        });
        html = result.html;
      } catch (err) {
        console.warn(
          `[${SLUG}] warn="page fetch failed" city=${city.key} error="${err instanceof Error ? err.message : String(err)}"`,
        );
        continue;
      }
      for (const item of parseListingHtml(html)) {
        if (!seen.has(item.url)) seen.set(item.url, item);
      }
    }

    return Array.from(seen.values());
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    let html: string;
    try {
      html = await politeFetch(item.url, {
        signal,
        label: `${SLUG}:structured`,
      });
    } catch {
      return null;
    }

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
    let html: string;
    let finalUrl = item.url;
    try {
      html = await politeFetch(item.url, {
        signal,
        label: `${SLUG}:detail`,
      });
    } catch {
      return { reducedHtml: "", canonicalUrl: finalUrl };
    }
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

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `&start_date=${fmt(start)}&end_date=${fmt(end)}`;
}
