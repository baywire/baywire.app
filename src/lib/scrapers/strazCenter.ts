import { politeFetch, politeFetchWithMeta } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "straz_center";
const HOME_URL = "https://www.strazcenter.org/";
const GOOGLE_REFERER = "https://www.google.com/";

const LIST_URLS: readonly string[] = [
  "https://www.strazcenter.org/tickets-events/find-an-event/",
  "https://www.strazcenter.org/calendar/",
];

let strazWarmupCookie: { value: string; expiresAt: number } | null = null;
const WARMUP_TTL_MS = 10 * 60_000;

export const strazCenterAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Straz Center",
  baseUrl: "https://www.strazcenter.org",

  async listEvents({ signal }) {
    const cookie = await strazRequestCookieHeader(signal);
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

    const last = await politeFetch(LIST_URLS[0] ?? HOME_URL, {
      ...baseFetchOpts,
      label: `${SLUG}:list-probe`,
      headers: cookie ? { Cookie: cookie } : undefined,
    });
    if (looksLikeWafInterstitial(last)) {
      console.warn(
        `[${SLUG}] Incapsula blocked listing pages. Set STRAZCENTER_SCRAPE_COOKIE (copy Cookie header from a real browser session on strazcenter.org) or expect 0 events from this source.`,
      );
    }
    return [];
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const cookie = await strazRequestCookieHeader(signal);
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
    const cookie = await strazRequestCookieHeader(signal);
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

/**
 * Incapsula often needs (1) a valid `Cookie` from a real browser, and/or
 * (2) a prior same-site request that returns `Set-Cookie`. We merge env +
 * short-lived warm-up cookies and reuse for ~10 minutes.
 */
async function strazRequestCookieHeader(signal: AbortSignal | undefined): Promise<string | undefined> {
  const fromEnv = process.env.STRAZCENTER_SCRAPE_COOKIE?.trim();
  if (strazWarmupCookie && strazWarmupCookie.expiresAt > Date.now()) {
    return mergeCookieHeader(fromEnv, strazWarmupCookie.value);
  }

  let warm: string | undefined;
  try {
    const meta = await politeFetchWithMeta(HOME_URL, {
      signal,
      referer: GOOGLE_REFERER,
      label: `${SLUG}:warmup`,
      timeoutMs: 20_000,
      retries: 0,
    });
    if (meta.clientCookieHeader) {
      strazWarmupCookie = {
        value: meta.clientCookieHeader,
        expiresAt: Date.now() + WARMUP_TTL_MS,
      };
      warm = meta.clientCookieHeader;
    }
  } catch {
    // Best-effort; we can still use STRAZCENTER_SCRAPE_COOKIE only.
  }

  return mergeCookieHeader(fromEnv, warm);
}

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

function looksLikeWafInterstitial(html: string): boolean {
  if (/incapsula/i.test(html) || /_incapsula_resource/i.test(html)) return true;
  // Incapsula challenge stubs can be as small as ~200 bytes and may not
  // contain the word "incapsula" when heavily compressed or truncated.
  if (html.length < 500 && /<iframe/i.test(html)) return true;
  return false;
}

/**
 * Merges `Cookie` request header values; later segments win on same cookie name.
 */
function mergeCookieHeader(
  a: string | null | undefined,
  b: string | null | undefined,
): string | undefined {
  const map = new Map<string, string>();
  for (const part of [a, b]) {
    if (!part?.trim()) continue;
    for (const pair of part.split(";")) {
      const bit = pair.trim();
      if (!bit) continue;
      const eq = bit.indexOf("=");
      if (eq === -1) continue;
      const name = bit.slice(0, eq).trim();
      const value = bit.slice(eq + 1).trim();
      if (!name) continue;
      map.set(name, value);
    }
  }
  if (map.size === 0) return undefined;
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
