import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const ORIGIN = "https://www.visittampabay.com";
const LISTING_URL = `${ORIGIN}/events/`;

/**
 * Visit Tampa Bay (Simpleview CMS). The dynamic event calendar is JS-rendered,
 * but server-rendered detail pages live at `/tampa-events/{section}/{slug}/`
 * (e.g. festival pages with year-specific dates). Category indexes and utility
 * paths under `/tampa-events/` are excluded.
 */
const SKIP_SECTIONS = new Set([
  "all-events",
  "submit-an-event",
  "tampa-music-festivals",
]);
const SECTION_INDEX_RE = /-events$/i;

export const visitTampaBayAdapter: SourceAdapter = {
  slug: "visit_tampa_bay",
  label: "Visit Tampa Bay",
  baseUrl: ORIGIN,

  async listEvents({ signal }) {
    const html = await politeFetch(LISTING_URL, { signal });
    return parseListing(html);
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const html = await politeFetch(item.url, { signal });
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
    const html = await politeFetch(item.url, { signal });
    return {
      reducedHtml: reduceHtml(html, item.url),
      canonicalUrl: item.url,
    };
  },
};

function parseListing(html: string): ListingItem[] {
  const $ = loadHtml(html);
  const out = new Map<string, ListingItem>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let absolute: URL;
    try {
      absolute = new URL(href, ORIGIN);
    } catch {
      return;
    }
    if (absolute.host !== "www.visittampabay.com") return;
    const segments = absolute.pathname.split("/").filter(Boolean);
    if (segments.length < 3) return;
    if (segments[0] !== "tampa-events") return;
    const [, section, slug] = segments;
    if (SKIP_SECTIONS.has(section)) return;
    if (SECTION_INDEX_RE.test(section) && segments.length === 2) return;
    if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return;

    const url = `${ORIGIN}/${segments.join("/")}`;
    if (!out.has(url)) out.set(url, { sourceEventId: `${section}-${slug}`, url });
  });

  return Array.from(out.values());
}
