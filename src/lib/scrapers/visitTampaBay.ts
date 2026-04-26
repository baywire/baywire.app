import * as cheerio from "cheerio";

import { politeFetch } from "./fetch";
import { reduceHtml } from "./reduce";
import type { ListingItem, SourceAdapter } from "./types";

const LISTING_URL = "https://www.visittampabay.com/events/";

/**
 * Visit Tampa Bay is the official tourism site. Their /events/ index links to
 * event detail pages with rich descriptions and structured venue data.
 */
export const visitTampaBayAdapter: SourceAdapter = {
  slug: "visit_tampa_bay",
  label: "Visit Tampa Bay",
  baseUrl: "https://www.visittampabay.com",

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

  $("a[href*='/event/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const absolute = href.startsWith("http")
      ? href
      : new URL(href, "https://www.visittampabay.com").toString();
    const url = stripTrailingSlash(absolute.split("?")[0]);
    if (!/\/event\/[a-z0-9-]+\/?[a-z0-9-]+/i.test(url)) return;
    const id = url.split("/").filter(Boolean).pop();
    if (!id) return;
    if (!out.has(url)) out.set(url, { sourceEventId: id, url });
  });

  return Array.from(out.values());
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
