import { browserFetch } from "./browser";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "funny_bone_tampa";
const BASE = "https://tampa.funnybone.com";
const LIST_URL = `${BASE}/shows/`;

/**
 * Tampa Funny Bone. DataDome requires full JS execution on every page, not
 * just cookie transfer, so we use browserFetch for all requests.
 */
export const funnyBoneTampaAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Tampa Funny Bone",
  baseUrl: BASE,
  needsBrowser: "render",

  async listEvents({ signal }) {
    const { html } = await browserFetch(LIST_URL, {
      signal,
      label: `${SLUG}:list`,
      timeoutMs: 30_000,
    });
    return parseListingHtml(html);
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

  $("a[href*='/event']").each((_, el) => {
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
    const single = u.pathname.match(/^\/event\/([^/]+)\/tampa-funny-bone\/?$/);
    if (single?.[1]) return single[1];

    const series = u.pathname.match(
      /^\/events\/category\/series\/([^/]+)\/tampa-funny-bone\/?$/,
    );
    if (series?.[1]) return series[1];

    return null;
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
