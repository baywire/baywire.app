import { politeFetch } from "../fetch";
import { loadHtml } from "../parse";
import { reduceHtml } from "../reduce";
import { extractJsonLdPlaces, jsonLdPlaceToExtracted } from "./structured";
import type { PlaceAdapter, PlaceListingItem, StructuredPlace } from "./types";

const ORIGIN = "https://ilovetheburg.com";
const SLUG = "ilovetheburg_places";

const SEED_PATHS = [
  "/best-restaurants-st-pete/",
  "/best-breweries-st-pete/",
  "/best-coffee-shops-st-pete/",
  "/best-bars-st-pete/",
  "/best-brunch-spots-st-pete/",
  "/best-things-to-do-st-pete/",
  "/best-restaurants-in-st-petersburg-fl/",
  "/best-breweries-in-st-petersburg-fl/",
  "/best-happy-hours-st-pete/",
  "/best-date-night-st-pete/",
];

export const iLoveTheBurgPlacesAdapter: PlaceAdapter = {
  slug: SLUG,
  label: "I Love the Burg (Places)",
  baseUrl: ORIGIN,

  async listPlaces({ signal }) {
    const items = new Map<string, PlaceListingItem>();

    for (const path of SEED_PATHS) {
      try {
        const html = await politeFetch(`${ORIGIN}${path}`, {
          signal,
          referer: "https://www.google.com/",
          label: `${SLUG}:seed`,
        });
        extractLinkedPlaces(html, items);
      } catch {
        // seed page may 404
      }
    }

    return Array.from(items.values());
  },

  async tryStructured(item, signal): Promise<StructuredPlace | null> {
    const html = await politeFetch(item.url, {
      signal,
      referer: `${ORIGIN}/`,
      label: `${SLUG}:structured`,
    });
    const places = extractJsonLdPlaces(html);
    for (const biz of places) {
      const extracted = jsonLdPlaceToExtracted(biz);
      if (extracted) {
        return { place: extracted, canonicalUrl: item.url };
      }
    }
    return null;
  },

  async fetchAndReduce(item, signal) {
    const html = await politeFetch(item.url, {
      signal,
      referer: `${ORIGIN}/`,
      label: `${SLUG}:detail`,
    });
    return {
      reducedHtml: reduceHtml(html, item.url),
      canonicalUrl: item.url,
    };
  },
};

function extractLinkedPlaces(html: string, out: Map<string, PlaceListingItem>): void {
  const $ = loadHtml(html);

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let absolute: URL;
    try {
      absolute = new URL(href, ORIGIN);
    } catch {
      return;
    }
    if (absolute.host !== "ilovetheburg.com") return;
    const path = absolute.pathname;
    if (!path || path === "/") return;
    if (SEED_PATHS.includes(path)) return;
    if (!/^\/[a-z0-9-]+\/?$/i.test(path)) return;
    const slug = path.replace(/^\/|\/$/g, "");
    if (slug.length < 3) return;
    const url = `${ORIGIN}/${slug}/`;
    if (!out.has(url)) {
      out.set(url, { sourcePlaceId: slug, url });
    }
  });
}
