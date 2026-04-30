import { solveCookies } from "./browser";
import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "straz_center";
const HOME_URL = "https://www.strazcenter.org/";

const LIST_URLS: readonly string[] = [
  "https://www.strazcenter.org/tickets-events/find-an-event/",
  "https://www.strazcenter.org/calendar/",
];

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

export const strazCenterAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Straz Center",
  baseUrl: "https://www.strazcenter.org",
  needsBrowser: "cookies",

  async listEvents({ signal }) {
    const cookie = await getCookies(signal);
    const baseFetchOpts = {
      signal,
      referer: HOME_URL,
      timeoutMs: 25_000,
      retries: 1,
    } as const;

    for (const listUrl of LIST_URLS) {
      const html = await politeFetch(listUrl, {
        ...baseFetchOpts,
        label: `${SLUG}:list`,
        headers: cookie ? { Cookie: cookie } : undefined,
      });
      const items = parseListingHtml(html);
      if (items.length > 0) return items;
    }

    return [];
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const cookie = await getCookies(signal);
    const html = await politeFetch(item.url, {
      signal,
      referer: HOME_URL,
      label: `${SLUG}:structured`,
      timeoutMs: 25_000,
      retries: 1,
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
      referer: HOME_URL,
      label: `${SLUG}:detail`,
      timeoutMs: 25_000,
      retries: 1,
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

  $("a[href*='/events/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = absolutize(href, "https://www.strazcenter.org");
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
