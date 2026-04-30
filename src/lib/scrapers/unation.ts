import { browserFetch } from "./browser";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import { extractListings } from "@/lib/extract/listings";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "unation";
const BASE = "https://www.unation.com";
const LISTING_URL = `${BASE}/tampa/events`;

/**
 * Unation Tampa events. Cloudflare-protected — requires a real browser to
 * solve the bot challenge. Listing page links are parsed with Cheerio first;
 * falls back to AI extraction if no links are found.
 */
export const unationAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Unation Tampa",
  baseUrl: BASE,
  needsBrowser: "render",

  async listEvents({ signal }) {
    const { html } = await browserFetch(LISTING_URL, {
      signal,
      label: `${SLUG}:list`,
      waitUntil: "networkidle",
      timeoutMs: 30_000,
    });

    // Try CSS selectors first
    const items = parseListingHtml(html);
    if (items.length > 0) return items;

    // Fallback to AI extraction
    try {
      const urls = await extractListings(html, BASE, "Unation Tampa");
      return urls
        .filter((url) => isEventUrl(url))
        .map((url) => ({
          sourceEventId: deriveEventId(url),
          url,
        }));
    } catch (err) {
      console.warn(
        `[${SLUG}] AI listing extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
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
      if (extracted) {
        return { event: extracted, canonicalUrl: ev.url || item.url };
      }
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

  $("a[href*='/events/'], a[href*='/event/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let url: string;
    try {
      url = new URL(href, BASE).toString();
    } catch {
      return;
    }
    if (!isEventUrl(url)) return;
    const id = deriveEventId(url);
    if (!out.has(url)) out.set(url, { sourceEventId: id, url });
  });

  return Array.from(out.values());
}

function isEventUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Must be on unation.com and look like an individual event
    if (!u.host.includes("unation.com")) return false;
    const segments = u.pathname.split("/").filter(Boolean);
    return segments.length >= 2 && (segments.includes("events") || segments.includes("event"));
  } catch {
    return false;
  }
}

function deriveEventId(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? url;
  } catch {
    return url;
  }
}
