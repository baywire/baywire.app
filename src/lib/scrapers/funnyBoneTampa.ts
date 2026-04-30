import { solveCookies } from "./browser";
import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "funny_bone_tampa";
const BASE = "https://tampa.funnybone.com";
const HOME_URL = `${BASE}/`;
const LIST_URL = `${BASE}/shows/`;

let cachedCookies: { value: string; expiresAt: number } | null = null;
const COOKIE_TTL_MS = 10 * 60_000;

async function getCookies(signal?: AbortSignal): Promise<string | undefined> {
  if (cachedCookies && cachedCookies.expiresAt > Date.now()) {
    return cachedCookies.value;
  }

  try {
    const cookies = await solveCookies(HOME_URL, { signal, label: `${SLUG}:cookies` });
    if (cookies) {
      cachedCookies = { value: cookies, expiresAt: Date.now() + COOKIE_TTL_MS };
    }
    return cookies;
  } catch (err) {
    console.warn(
      `[${SLUG}] cookie solve failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

export const funnyBoneTampaAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Tampa Funny Bone",
  baseUrl: BASE,
  needsBrowser: "cookies",

  async listEvents({ signal }) {
    const cookie = await getCookies(signal);
    const html = await politeFetch(LIST_URL, {
      signal,
      referer: HOME_URL,
      label: `${SLUG}:list`,
      headers: cookie ? { Cookie: cookie } : undefined,
    });

    return parseListingHtml(html);
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const cookie = await getCookies(signal);
    const html = await politeFetch(item.url, {
      signal,
      referer: LIST_URL,
      label: `${SLUG}:structured`,
      headers: cookie ? { Cookie: cookie } : undefined,
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
    const cookie = await getCookies(signal);
    const html = await politeFetch(item.url, {
      signal,
      referer: LIST_URL,
      label: `${SLUG}:detail`,
      headers: cookie ? { Cookie: cookie } : undefined,
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
