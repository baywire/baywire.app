import { browserFetch } from "./browser";
import { reduceHtml } from "./reduce";
import { extractListings } from "@/lib/extract/listings";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "dunedin_gov";
const BASE = "https://www.dunedinfl.net";
const CALENDAR_URL = `${BASE}/calendar`;

/**
 * City of Dunedin calendar. Akamai-protected and JS-rendered — requires a
 * real browser for both listing discovery and detail page access. Uses AI
 * listing extraction since the calendar widget injects events dynamically.
 */
export const dunedinGovAdapter: SourceAdapter = {
  slug: SLUG,
  label: "City of Dunedin",
  baseUrl: BASE,
  needsBrowser: "render",

  async listEvents({ signal }) {
    const { html } = await browserFetch(CALENDAR_URL, {
      signal,
      label: `${SLUG}:list`,
      waitUntil: "networkidle",
      timeoutMs: 30_000,
    });

    // AI-powered extraction: the calendar is JS-rendered with no stable CSS selectors
    let urls: string[];
    try {
      urls = await extractListings(html, BASE, "City of Dunedin");
    } catch (err) {
      console.warn(
        `[${SLUG}] AI listing extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }

    return urls
      .filter((url) => {
        try {
          return new URL(url).host === new URL(BASE).host;
        } catch {
          return false;
        }
      })
      .map((url) => ({
        sourceEventId: deriveEventId(url),
        url,
      }));
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

function deriveEventId(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, "").replace(/\/+$/, "").replace(/\//g, "-") || url;
  } catch {
    return url;
  }
}
