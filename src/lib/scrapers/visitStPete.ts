import { politeFetch } from "./fetch";
import { loadHtml } from "./parse";
import { reduceHtml } from "./reduce";
import { extractJsonLdEvents, jsonLdEventToExtracted } from "./structured";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

const ORIGIN = "https://www.visitstpeteclearwater.com";

/**
 * Visit St. Pete / Clearwater. Two listing pages share the same /event/{slug}/{id}
 * detail-page format, so we crawl both and dedupe on URL: the general events
 * index plus the curated festivals page.
 */
const LISTING_URLS = [
  `${ORIGIN}/events`,
  `${ORIGIN}/events-festivals`,
];
const DETAIL_REFERER = `${ORIGIN}/events`;
const SLUG = "visit_st_pete_clearwater";

export const visitStPeteAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Visit St. Pete/Clearwater",
  baseUrl: ORIGIN,

  async listEvents({ signal }) {
    const merged = new Map<string, ListingItem>();
    let lastError: unknown = null;
    let anyOk = false;
    for (const url of LISTING_URLS) {
      try {
        const html = await politeFetch(url, {
          signal,
          referer: "https://www.google.com/",
          label: `${SLUG}:list`,
        });
        anyOk = true;
        for (const item of parseListing(html)) {
          if (!merged.has(item.url)) merged.set(item.url, item);
        }
      } catch (err) {
        lastError = err;
      }
    }
    if (!anyOk) throw lastError instanceof Error ? lastError : new Error(String(lastError));
    return Array.from(merged.values());
  },

  async tryStructured(item, signal): Promise<StructuredEvent | null> {
    const html = await politeFetch(item.url, {
      signal,
      referer: DETAIL_REFERER,
      label: `${SLUG}:structured`,
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
    const html = await politeFetch(item.url, {
      signal,
      referer: DETAIL_REFERER,
      label: `${SLUG}:detail`,
    });
    return {
      reducedHtml: reduceHtml(html, item.url),
      canonicalUrl: item.url,
    };
  },
};

function parseListing(html: string): ListingItem[] {
  const $ = loadHtml(html);
  const out = new Map<string, ListingItem>();

  $("a[href*='/event']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const absolute = href.startsWith("http") ? href : new URL(href, ORIGIN).toString();
    const clean = absolute.split("?")[0].replace(/\/$/, "");
    if (!/\/events?\/[a-z0-9-]+/i.test(clean)) return;
    if (/\/events?\/?$/i.test(clean)) return;
    const id = clean.split("/").filter(Boolean).pop();
    if (!id) return;
    if (!out.has(clean)) out.set(clean, { sourceEventId: id, url: clean });
  });

  return Array.from(out.values());
}
