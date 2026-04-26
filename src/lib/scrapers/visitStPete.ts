import * as cheerio from "cheerio";

import { politeFetch } from "./fetch";
import { reduceHtml } from "./reduce";
import type { ListingItem, SourceAdapter } from "./types";

const LISTING_URL = "https://www.visitstpeteclearwater.com/events";

/**
 * Visit St. Pete / Clearwater. Their events index uses a similar pattern to
 * Visit Tampa Bay — list of cards linking to /events/{slug} detail pages.
 */
export const visitStPeteAdapter: SourceAdapter = {
  slug: "visit_st_pete_clearwater",
  label: "Visit St. Pete/Clearwater",
  baseUrl: "https://www.visitstpeteclearwater.com",

  async listEvents({ signal }) {
    const html = await politeFetch(LISTING_URL, { signal });
    return parseListing(html);
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
  const $ = cheerio.load(html);
  const out = new Map<string, ListingItem>();

  $("a[href*='/event']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const absolute = href.startsWith("http")
      ? href
      : new URL(href, "https://www.visitstpeteclearwater.com").toString();
    const clean = absolute.split("?")[0].replace(/\/$/, "");
    if (!/\/events?\/[a-z0-9-]+/i.test(clean)) return;
    if (/\/events?\/?$/i.test(clean)) return;
    const id = clean.split("/").filter(Boolean).pop();
    if (!id) return;
    if (!out.has(clean)) out.set(clean, { sourceEventId: id, url: clean });
  });

  return Array.from(out.values());
}
