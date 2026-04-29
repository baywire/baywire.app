import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "tampa_theatre";
const LIST_URL = "https://tampatheatre.org/?show_type=live#currently_playing";
const LIST_REFERER = "https://www.google.com/";

export const tampaTheatreLiveAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Tampa Theatre (Live)",
  baseUrl: "https://tampatheatre.org",

  async listEvents({ signal }) {
    const html = await politeFetch(LIST_URL, {
      signal,
      referer: LIST_REFERER,
      label: `${SLUG}:list`,
    });
    return parseListingHtml(html);
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const html = await politeFetch(item.url, {
      signal,
      referer: LIST_URL,
      label: `${SLUG}:structured`,
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
    const html = await politeFetch(item.url, {
      signal,
      referer: LIST_URL,
      label: `${SLUG}:detail`,
    });
    return {
      reducedHtml: reduceHtml(html, item.url),
      canonicalUrl: item.url,
    };
  },
};

function parseListingHtml(html: string): ListingItem[] {
  const $ = loadHtml(html);
  const out = new Map<string, ListingItem>();

  $("a[href^='/live/'], a[href^='https://tampatheatre.org/live/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = absolutize(href, "https://tampatheatre.org");
    const id = parseLiveId(url);
    if (!id) return;
    if (!out.has(url)) out.set(url, { sourceEventId: id, url });
  });

  return Array.from(out.values());
}

function parseLiveId(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/live\/([^/]+)\/?$/);
    return m?.[1] ?? null;
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

