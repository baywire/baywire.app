import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import {
  extractJsonLdEvents,
  findIcsLink,
  icsEventToExtracted,
  jsonLdEventToExtracted,
  parseICalFeed,
  type IcsEvent,
} from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const ORIGIN = "https://www.tampa.gov";
const LISTING_URL = `${ORIGIN}/calendar`;

const DETAIL_RE = /^\/events\/([a-z0-9-]+)\/(\d+)$/i;

/**
 * City of Tampa calendar (Drupal). Listing is HTML and links to
 * `/events/{slug}/{id}` detail pages, which embed schema.org/Event JSON-LD.
 * We prefer JSON-LD via `tryStructured` (zero LLM cost) and fall back to
 * HTML+LLM only if the page lacks structured data. We also opportunistically
 * harvest the calendar's iCal export when advertised so detail-page fetches
 * can hit a structured cache instead of going to the LLM.
 */
export const tampaGovAdapter: SourceAdapter = {
  slug: "tampa_gov",
  label: "City of Tampa Calendar",
  baseUrl: ORIGIN,

  async listEvents({ signal }) {
    icsCache.clear();
    const html = await politeFetch(LISTING_URL, { signal });
    const items = parseListing(html);

    const ics = findIcsLink(html, LISTING_URL);
    if (ics) {
      try {
        const body = await politeFetch(ics, {
          signal,
          headers: { Accept: "text/calendar" },
        });
        for (const ev of parseICalFeed(body)) {
          const id = idFromUrl(ev.url);
          if (id) icsCache.set(id, ev);
        }
      } catch (err) {
        console.warn("[tampa_gov] iCal probe failed:", err instanceof Error ? err.message : err);
      }
    }

    return items;
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const cached = icsCache.get(item.sourceEventId);
    if (cached) {
      const extracted = icsEventToExtracted(cached);
      if (extracted) return { event: extracted, canonicalUrl: cached.url || item.url };
    }
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

const icsCache = new Map<string, IcsEvent>();

function idFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url, ORIGIN);
  } catch {
    return null;
  }
  const match = DETAIL_RE.exec(parsed.pathname.replace(/\/+$/, ""));
  if (!match) return null;
  const [, slug, id] = match;
  return `${slug}-${id}`;
}

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
    if (absolute.host !== "www.tampa.gov") return;
    const path = absolute.pathname.replace(/\/+$/, "");
    const match = DETAIL_RE.exec(path);
    if (!match) return;
    const [, slug, id] = match;
    const url = `${ORIGIN}${path}`;
    const sourceEventId = `${slug}-${id}`;
    if (!out.has(url)) out.set(url, { sourceEventId, url });
  });

  return Array.from(out.values());
}
