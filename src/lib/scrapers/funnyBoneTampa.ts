import { politeFetch, politeFetchWithMeta } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "funny_bone_tampa";
const BASE = "https://tampa.funnybone.com";
const HOME_URL = `${BASE}/`;
const LIST_URL = `${BASE}/shows/`;
const GOOGLE_REFERER = "https://www.google.com/";

let warmupCookie: { value: string; expiresAt: number } | null = null;
const WARMUP_TTL_MS = 10 * 60_000;

/**
 * Tampa Funny Bone. Uses plain HTTP with a homepage cookie warmup.
 * DataDome blocks headless browsers but passes properly-headered HTTP
 * requests, so we deliberately avoid the browser path here.
 */
export const funnyBoneTampaAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Tampa Funny Bone",
  baseUrl: BASE,

  async listEvents({ signal }) {
    const cookie = await requestCookieHeader(signal);
    const html = await politeFetch(LIST_URL, {
      signal,
      referer: HOME_URL,
      label: `${SLUG}:list`,
      headers: cookie ? { Cookie: cookie } : undefined,
    });

    if (looksLikeDataDomeChallenge(html)) {
      console.warn(
        `[${SLUG}] DataDome blocked listing page. Set FUNNYBONE_SCRAPE_COOKIE or expect 0 events.`,
      );
      return [];
    }

    return parseListingHtml(html);
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const cookie = await requestCookieHeader(signal);
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
    const cookie = await requestCookieHeader(signal);
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

async function requestCookieHeader(signal: AbortSignal | undefined): Promise<string | undefined> {
  const fromEnv = process.env.FUNNYBONE_SCRAPE_COOKIE?.trim();
  if (warmupCookie && warmupCookie.expiresAt > Date.now()) {
    return mergeCookieHeader(fromEnv, warmupCookie.value);
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
      warmupCookie = {
        value: meta.clientCookieHeader,
        expiresAt: Date.now() + WARMUP_TTL_MS,
      };
      warm = meta.clientCookieHeader;
    }
  } catch (err) {
    console.warn(
      `[${SLUG}] warn="warmup cookie fetch failed" error="${err instanceof Error ? err.message : String(err)}"`,
    );
  }

  return mergeCookieHeader(fromEnv, warm);
}

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

    // Single event: /event/<slug>/tampa-funny-bone/
    const single = u.pathname.match(/^\/event\/([^/]+)\/tampa-funny-bone\/?$/);
    if (single?.[1]) return single[1];

    // Multi-show series: /events/category/series/<slug>/tampa-funny-bone/
    const series = u.pathname.match(
      /^\/events\/category\/series\/([^/]+)\/tampa-funny-bone\/?$/,
    );
    if (series?.[1]) return series[1];

    return null;
  } catch {
    return null;
  }
}

function looksLikeDataDomeChallenge(html: string): boolean {
  if (/captcha-delivery\.com/i.test(html)) return true;
  // Real pages include DataDome's tracker script (js.datadome.co/tags.js);
  // only flag as a challenge when the page is a tiny interstitial stub.
  if (html.length < 5_000 && /datadome/i.test(html)) return true;
  return false;
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

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
