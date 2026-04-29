import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "dont_tell_comedy";
const LIST_URL =
  "https://www.donttellcomedy.com/cities/tampa/?lat=27.944740810859372&lng=-82.45418579101172";
const LIST_REFERER = "https://www.google.com/";

export const dontTellComedyAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Don't Tell Comedy",
  baseUrl: "https://www.donttellcomedy.com",

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

  $("a[href^='/shows/'], a[href^='https://www.donttellcomedy.com/shows/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = absolutize(href, "https://www.donttellcomedy.com");
    const id = parseShowId(url);
    if (!id) return;
    if (!out.has(url)) out.set(url, { sourceEventId: id, url });
  });

  return Array.from(out.values());
}

function parseShowId(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/shows\/([^/]+)\/?$/);
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

