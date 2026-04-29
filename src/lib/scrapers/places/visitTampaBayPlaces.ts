import { politeFetch } from "../fetch";
import { loadHtml } from "../parse";
import { reduceHtml } from "../reduce";
import { extractJsonLdPlaces, jsonLdPlaceToExtracted } from "./structured";
import type { PlaceAdapter, PlaceListingItem, StructuredPlace } from "./types";

const ORIGIN = "https://www.visittampabay.com";
const SLUG = "visit_tampa_bay_places";

const LISTING_SECTIONS = [
  "/restaurants/",
  "/dining/",
  "/things-to-do/attractions/",
  "/things-to-do/arts-culture/",
  "/things-to-do/outdoor-activities/",
  "/nightlife/",
  "/shopping/",
];

const SKIP_SLUGS = new Set([
  "events",
  "hotels",
  "plan-your-trip",
  "meetings",
  "sports",
  "about",
  "media",
  "blog",
  "partners",
]);

export const visitTampaBayPlacesAdapter: PlaceAdapter = {
  slug: SLUG,
  label: "Visit Tampa Bay (Places)",
  baseUrl: ORIGIN,

  async listPlaces({ signal }) {
    const items = new Map<string, PlaceListingItem>();

    for (const section of LISTING_SECTIONS) {
      try {
        const html = await politeFetch(`${ORIGIN}${section}`, {
          signal,
          referer: "https://www.google.com/",
          label: `${SLUG}:listing`,
        });
        extractLinkedPlaces(html, items);
      } catch {
        // section may not exist
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
    if (absolute.host !== "www.visittampabay.com") return;
    const segments = absolute.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return;
    if (SKIP_SLUGS.has(segments[0])) return;
    if (absolute.pathname.endsWith("/events/")) return;

    const slug = segments.join("-");
    const url = `${ORIGIN}/${segments.join("/")}/`;
    if (!out.has(url)) {
      out.set(url, { sourcePlaceId: slug, url });
    }
  });
}
