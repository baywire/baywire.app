import { browserFetch } from "./browser";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractListings } from "@/lib/extract/listings";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "straz_center";
const BASE = "https://www.strazcenter.org";

const LIST_URLS: readonly string[] = [
  "https://www.strazcenter.org/tickets-events/find-an-event/",
  "https://www.strazcenter.org/calendar/",
];

/**
 * Straz Center. The listing pages are JS-rendered and behind Incapsula, so
 * we use browserFetch for everything. When CSS selectors return 0 events,
 * AI listing extraction is used as a fallback.
 */
export const strazCenterAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Straz Center",
  baseUrl: BASE,
  needsBrowser: "render",

  async listEvents({ signal }) {
    for (const listUrl of LIST_URLS) {
      const { html } = await browserFetch(listUrl, {
        signal,
        label: `${SLUG}:list`,
        timeoutMs: 30_000,
      });

      // Try CSS selectors first
      const items = parseListingHtml(html);
      if (items.length > 0) return items;

      // AI fallback when selectors return nothing (site structure may have changed)
      try {
        const urls = await extractListings(html, BASE, "Straz Center");
        const aiItems = urls
          .filter((url) => {
            try { return new URL(url).host === "www.strazcenter.org"; } catch { return false; }
          })
          .map((url) => {
            const id = parseEventId(url);
            return id ? { sourceEventId: id, url } : null;
          })
          .filter((item): item is ListingItem => item !== null);

        if (aiItems.length > 0) {
          console.log(`[${SLUG}] CSS selectors found 0 events, AI extraction found ${aiItems.length}`);
          return aiItems;
        }
      } catch (err) {
        console.warn(
          `[${SLUG}] AI listing extraction failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return [];
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
      if (!extracted) continue;

      extracted.offer ??= {
        ticketUrl: item.url,
        status: extracted.isFree ? "free" : "on_sale",
        currency: "USD",
        onSaleLocal: null,
        validFromLocal: null,
        tiers: null,
      };
      extracted.offer.ticketUrl ??= item.url;
      return { event: extracted, canonicalUrl: ev.url || item.url };
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

  $("a[href*='/events/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = absolutize(href, BASE);
    const id = parseEventId(url);
    if (!id) return;
    if (!out.has(url)) out.set(url, { sourceEventId: id, url });
  });

  return Array.from(out.values());
}

function parseEventId(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/events\/(.+?)\/?$/);
    if (!m?.[1]) return null;
    return m[1].replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}
