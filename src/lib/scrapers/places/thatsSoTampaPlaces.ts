import { politeFetch } from "../fetch";
import { loadHtml } from "../parse";
import { reduceHtml } from "../reduce";
import { extractJsonLdPlaces, jsonLdPlaceToExtracted } from "./structured";
import type { PlaceAdapter, PlaceListingItem, StructuredPlace } from "./types";

const ORIGIN = "https://thatssotampa.com";
const SLUG = "thats_so_tampa_places";

const SEED_PATHS = [
  "/best-restaurants-in-tampa/",
  "/best-breweries-in-tampa/",
  "/best-coffee-shops-in-tampa/",
  "/best-bars-in-tampa/",
  "/best-brunch-in-tampa/",
  "/best-things-to-do-in-tampa/",
  "/best-date-night-restaurants-tampa/",
  "/best-happy-hours-in-tampa/",
  "/best-bakeries-in-tampa/",
];

const PLACE_LISTICLE_RE =
  /\b(best|top|favorite|hidden.?gem|must.?visit|where.?to)\b.*\b(restaurant|bar|brew|cafe|coffee|bakery|brunch|taco|pizza|seafood|food|eat|drink|sushi|bbq|burger|ice.?cream|donut|dessert|rooftop|patio|happy.?hour|date.?night)\b/i;

export const thatsSoTampaPlacesAdapter: PlaceAdapter = {
  slug: SLUG,
  label: "That's So Tampa (Places)",
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
        // seed page may 404; continue with others
      }
    }

    try {
      const searchHtml = await politeFetch(`${ORIGIN}/?s=best+restaurants+breweries`, {
        signal,
        referer: `${ORIGIN}/`,
        label: `${SLUG}:search`,
      });
      extractListicleLinks(searchHtml, items);
    } catch {
      // search may fail
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
    if (absolute.host !== "thatssotampa.com") return;
    const path = absolute.pathname;
    if (!path || path === "/" || SEED_PATHS.includes(path)) return;
    if (!/^\/[a-z0-9-]+\/?$/i.test(path)) return;
    const slug = path.replace(/^\/|\/$/g, "");
    if (slug.length < 3) return;
    const url = `${ORIGIN}/${slug}/`;
    if (!out.has(url)) {
      out.set(url, { sourcePlaceId: slug, url });
    }
  });
}

function extractListicleLinks(html: string, out: Map<string, PlaceListingItem>): void {
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
    if (absolute.host !== "thatssotampa.com") return;
    const text = $(el).text();
    if (!PLACE_LISTICLE_RE.test(text) && !PLACE_LISTICLE_RE.test(href)) return;
    const path = absolute.pathname;
    const slug = path.replace(/^\/|\/$/g, "");
    if (slug.length < 3) return;
    const url = `${ORIGIN}/${slug}/`;
    if (!out.has(url)) {
      out.set(url, { sourcePlaceId: slug, url });
    }
  });
}
