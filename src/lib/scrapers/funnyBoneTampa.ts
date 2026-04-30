import { browserFetch } from "./browser";
import { extractListings } from "../extract/listings";
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
 * Warm-up navigation to homepage helps pass initial DataDome challenge.
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
      timeoutMs: 45_000,
      warmUpUrl: BASE,
      waitForSelector: "a[href*='/event']",
    });

    const items = parseListingHtml(html);
    if (items.length > 0) return items;

    // Fallback: use AI listing extraction if CSS selectors find nothing
    console.log(`[${SLUG}] CSS selectors found 0 events — trying AI listing extraction`);
    const aiUrls = await extractListings(html, BASE, SLUG);
    return aiUrls.map((url) => ({
      sourceEventId: parseEventId(url) ?? url,
      url,
    }));
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const { html } = await browserFetch(item.url, {
      signal,
      label: `${SLUG}:structured`,
      timeoutMs: 30_000,
      warmUpUrl: BASE,
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
      timeoutMs: 30_000,
      warmUpUrl: BASE,
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
