import * as cheerio from "cheerio";

import { politeFetch } from "./fetch";
import { reduceHtml } from "./reduce";
import type { ListingItem, SourceAdapter } from "./types";

const LISTING_URL = "https://www.tampabay.com/things-to-do/";

/**
 * Tampa Bay Times "Things to Do" section. The index lists weekly roundup
 * articles like "Best things to do in Tampa Bay this weekend." We treat each
 * roundup as a single source page; the LLM extracts one event per article
 * (the headline pick) — duplicates from other sources will dedupe out.
 */
export const tampaBayTimesAdapter: SourceAdapter = {
  slug: "tampa_bay_times",
  label: "Tampa Bay Times — Things to Do",
  baseUrl: "https://www.tampabay.com",

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

  $("a[href*='tampabay.com']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (!/\/things-to-do\//.test(href)) return;
    const absolute = href.startsWith("http")
      ? href
      : new URL(href, "https://www.tampabay.com").toString();
    const clean = absolute.split("?")[0].replace(/\/$/, "");
    if (clean === LISTING_URL.replace(/\/$/, "")) return;
    if (!/\/things-to-do\/[a-z0-9-]+/i.test(clean)) return;
    const id = clean.split("/").filter(Boolean).pop();
    if (!id) return;
    if (!out.has(clean)) out.set(clean, { sourceEventId: id, url: clean });
  });

  return Array.from(out.values());
}
