import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "side_splitters";
const LIST_URL = "https://sidesplitterscomedy.com/locations/tampa/";
const LIST_REFERER = "https://www.google.com/";

/**
 * Side Splitters Comedy Club. The listing page is rich (179KB) with full show
 * details. OvationTix detail pages are minimal JS iframes that produce
 * short_html, so we extract from the listing page instead and use OvationTix
 * URLs as ticket links only.
 */

let cachedListingHtml: string | null = null;

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
    cachedListingHtml = html;
    return parseListingHtml(html);
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    // Try JSON-LD from the listing page (some venue sites embed per-show JSON-LD)
    const html = cachedListingHtml ?? await politeFetch(LIST_URL, {
      signal,
      referer: LIST_REFERER,
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

      return { event: extracted, canonicalUrl: item.url };
    }
    return null;
  },

  async fetchAndReduce(item, signal) {
    // Use the rich listing page for LLM extraction instead of the minimal
    // OvationTix iframe page. Include the ticket URL as a hint so the LLM
    // can match the right show.
    const html = cachedListingHtml ?? await politeFetch(LIST_URL, {
      signal,
      referer: LIST_REFERER,
      label: `${SLUG}:detail`,
    });
    const reduced = reduceHtml(html, LIST_URL);
    return {
      reducedHtml: reduced,
      canonicalUrl: LIST_URL,
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
