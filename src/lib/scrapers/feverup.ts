import { browserFetch } from "./browser";
import { reduceHtml } from "./reduce";
import { extractListings } from "@/lib/extract/listings";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const SLUG = "feverup";
const BASE = "https://feverup.com";
const LISTING_URL = `${BASE}/en/tampa/plans`;

/**
 * Fever (feverup.com) Tampa experiences. Full SPA with no server-rendered
 * content — requires Playwright for everything. Uses AI listing extraction
 * since the SPA injects event cards dynamically via JavaScript.
 */
export const feverupAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Fever Tampa",
  baseUrl: BASE,
  needsBrowser: "render",

  async listEvents({ signal }) {
    const { html } = await browserFetch(LISTING_URL, {
      signal,
      label: `${SLUG}:list`,
      waitUntil: "networkidle",
      timeoutMs: 35_000,
    });

    let urls: string[];
    try {
      urls = await extractListings(html, BASE, "Fever Tampa");
    } catch (err) {
      console.warn(
        `[${SLUG}] AI listing extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }

    return urls
      .filter((url) => isFeverEventUrl(url))
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

function isFeverEventUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.host.includes("feverup.com")) return false;
    const segments = u.pathname.split("/").filter(Boolean);
    // Fever event URLs look like /en/tampa/plans/<slug> or /m/<id>
    if (segments.length >= 4 && segments[2] === "plans") return true;
    if (segments[0] === "m" && segments.length >= 2) return true;
    return false;
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
