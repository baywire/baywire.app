import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "side_splitters";
const LIST_URL = "https://sidesplitterscomedy.com/locations/tampa/";
const LIST_REFERER = "https://www.google.com/";

export const sideSplittersAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Side Splitters Comedy Club",
  baseUrl: "https://sidesplitterscomedy.com",

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

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = absolutize(href, "https://sidesplitterscomedy.com");
    const parsed = parseOvationEventUrl(url);
    if (!parsed) return;
    if (!out.has(parsed.url)) out.set(parsed.url, parsed);
  });

  return Array.from(out.values());
}

function parseOvationEventUrl(url: string): ListingItem | null {
  // Examples:
  //   https://ci.ovationtix.com/35578/production/1259166?performanceId=11729414
  //   https://ci.ovationtix.com/35578/production/1266534?performanceId=11769809
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/ovationtix\.com$/i.test(u.hostname)) return null;
  const perf = u.searchParams.get("performanceId");
  if (!perf || !/^\d+$/.test(perf)) return null;

  const prod = u.pathname.match(/\/production\/(\d+)/)?.[1] ?? null;
  const sourceEventId = prod ? `${prod}:${perf}` : perf;
  return { sourceEventId, url: u.toString() };
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

