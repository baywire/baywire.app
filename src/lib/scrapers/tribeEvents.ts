import type { CityKey } from "@/lib/cities";
import type { ExtractedEvent } from "@/lib/extract/schema";

import { politeFetch } from "./fetch";
import { cleanInlineText, stripHtmlToText } from "./text";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

/**
 * Adapter factory for sites running The Events Calendar (Tribe) WordPress
 * plugin. Tribe ships a public REST API at /wp-json/tribe/events/v1/events
 * which returns fully structured records (start/end in local time, venue,
 * image, cost, categories), so we convert directly to an `ExtractedEvent`
 * and skip the LLM. The HTML fallback path is preserved for safety.
 */

interface TribeVenue {
  venue?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface TribeImage {
  url?: string;
}

interface TribeTaxonomy {
  name?: string;
  slug?: string;
}

interface TribeEvent {
  id: number;
  url: string;
  title: string;
  description?: string | null;
  excerpt?: string | null;
  start_date: string;
  end_date?: string | null;
  all_day?: boolean;
  timezone?: string;
  cost?: string;
  cost_details?: { values?: string[]; currency_code?: string };
  image?: TribeImage | false | null;
  venue?: TribeVenue | TribeVenue[] | unknown[];
  categories?: TribeTaxonomy[];
  tags?: TribeTaxonomy[];
  website?: string;
}

interface TribeListResponse {
  events?: TribeEvent[];
}

const PER_PAGE = 50;

export interface TribeAdapterConfig {
  slug: string;
  label: string;
  baseUrl: string;
}

export function createTribeEventsAdapter(cfg: TribeAdapterConfig): SourceAdapter {
  const apiBase = `${cfg.baseUrl.replace(/\/$/, "")}/wp-json/tribe/events/v1/events`;
  const cache = new Map<string, TribeEvent>();

  async function fetchEvent(id: string, signal?: AbortSignal): Promise<TribeEvent> {
    const cached = cache.get(id);
    if (cached) return cached;
    const body = await politeFetch(`${apiBase}/${id}`, {
      signal,
      headers: { Accept: "application/json" },
      label: `${cfg.slug}:tribe-event`,
    });
    const ev = JSON.parse(body) as TribeEvent;
    cache.set(id, ev);
    return ev;
  }

  return {
    slug: cfg.slug,
    label: cfg.label,
    baseUrl: cfg.baseUrl,

    async listEvents({ windowStart, signal }) {
      cache.clear();
      const startDate = windowStart.toISOString().slice(0, 10);
      const url = `${apiBase}?per_page=${PER_PAGE}&start_date=${encodeURIComponent(startDate)}`;

      const body = await politeFetch(url, {
        signal,
        headers: { Accept: "application/json" },
        label: `${cfg.slug}:tribe-list`,
      });

      let parsed: TribeListResponse;
      try {
        parsed = JSON.parse(body) as TribeListResponse;
      } catch {
        return [];
      }

      const out: ListingItem[] = [];
      for (const ev of parsed.events ?? []) {
        if (!ev || typeof ev.id !== "number" || !ev.url) continue;
        const id = String(ev.id);
        if (cache.has(id)) continue;
        cache.set(id, ev);
        out.push({ sourceEventId: id, url: ev.url });
      }
      return out;
    },

    async tryStructured(item, signal): Promise<StructuredEvent | null> {
      const event = await fetchEvent(item.sourceEventId, signal);
      const extracted = tribeEventToExtracted(event);
      if (!extracted) return null;
      return { event: extracted, canonicalUrl: event.url || item.url };
    },

    async fetchAndReduce(item, signal) {
      const event = await fetchEvent(item.sourceEventId, signal);
      return {
        reducedHtml: synthesizeReducedBlob(event, cfg.label),
        canonicalUrl: event.url || item.url,
      };
    },
  };
}

function tribeEventToExtracted(event: TribeEvent): ExtractedEvent | null {
  if (!event.title || !event.start_date) return null;

  const startLocal = toLocalIso(event.start_date);
  if (!startLocal) return null;
  const endLocal = event.end_date ? toLocalIso(event.end_date) : null;

  const venue = pickVenue(event.venue);
  const venueName = cleanInlineText(venue?.venue) || null;
  const address = venue ? cleanInlineText(formatAddress(venue)) || null : null;
  const description = stripHtmlToText(event.description ?? event.excerpt).slice(0, 2000);
  const imageUrl = pickImage(event.image);
  const cityHint = `${venueName ?? ""} ${address ?? ""}`;

  const offers = buildOffers(event);
  const priceMin = offers?.low ?? null;
  const priceMax = offers?.high ?? offers?.low ?? null;

  return {
    title: cleanInlineText(event.title).slice(0, 300),
    description: description || null,
    startLocal,
    endLocal,
    allDay: Boolean(event.all_day),
    venueName: venueName ? venueName.slice(0, 200) : null,
    address: address ? address.slice(0, 300) : null,
    city: detectCity(cityHint),
    priceMin,
    priceMax,
    isFree: detectFree(event.cost),
    categories: collectCategories(event),
    imageUrl,
  };
}

function synthesizeReducedBlob(event: TribeEvent, sourceLabel: string): string {
  const venue = pickVenue(event.venue);
  const cleanTitle = cleanInlineText(event.title);
  const description = stripHtmlToText(event.description ?? event.excerpt);
  const venueName = cleanInlineText(venue?.venue);
  const venueAddress = venue ? cleanInlineText(formatAddress(venue)) : "";

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: cleanTitle,
    description,
    startDate: toIso(event.start_date),
    endDate: toIso(event.end_date),
    eventStatus: "EventScheduled",
    eventAttendanceMode: "OfflineEventAttendanceMode",
    url: event.url,
    image: pickImage(event.image),
    isAccessibleForFree: detectFree(event.cost),
    offers: legacyOffer(event),
    location: venue
      ? {
          "@type": "Place",
          name: venueName || null,
          address: venueAddress || null,
        }
      : null,
    keywords: collectCategories(event),
  };

  const meta: string[] = [
    `og:title: ${cleanTitle}`,
    `og:url: ${event.url}`,
  ];
  const imageUrl = pickImage(event.image);
  if (imageUrl) meta.push(`og:image: ${imageUrl}`);
  meta.push(`event:start_time: ${toIso(event.start_date) ?? event.start_date}`);
  if (event.end_date) {
    meta.push(`event:end_time: ${toIso(event.end_date) ?? event.end_date}`);
  }
  if (event.timezone) meta.push(`event:timezone: ${event.timezone}`);
  if (event.cost) meta.push(`event:cost: ${event.cost}`);

  const textLines: string[] = [
    `Source: ${sourceLabel}`,
    `Title: ${cleanTitle}`,
  ];
  if (venueName) textLines.push(`Venue: ${venueName}`);
  if (venueAddress) textLines.push(`Address: ${venueAddress}`);
  if (event.cost) textLines.push(`Cost: ${event.cost}`);
  textLines.push(
    `Starts (local): ${event.start_date}${event.timezone ? ` ${event.timezone}` : ""}`,
  );
  if (event.end_date) textLines.push(`Ends (local): ${event.end_date}`);
  if (description) textLines.push("", description);

  return [
    "JSON-LD:",
    JSON.stringify(jsonLd, null, 2),
    "",
    "MetaTags:",
    meta.join("\n"),
    "",
    "Text:",
    textLines.join("\n"),
  ].join("\n");
}

function pickVenue(input: TribeEvent["venue"]): TribeVenue | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    const first = input[0];
    return first && typeof first === "object" ? (first as TribeVenue) : null;
  }
  return typeof input === "object" ? (input as TribeVenue) : null;
}

function pickImage(input: TribeEvent["image"]): string | null {
  if (!input || typeof input !== "object") return null;
  const url = (input as TribeImage).url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

function formatAddress(v: TribeVenue): string {
  return [v.address, v.city, v.state, v.zip]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

function toLocalIso(value: string): string | null {
  if (!value) return null;
  if (value.includes("T")) return value.length === 16 ? `${value}:00` : value;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value.replace(" ", "T");
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
    return `${value.replace(" ", "T")}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00`;
  return null;
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.includes("T") ? value : value.replace(" ", "T");
}

function detectFree(cost: string | undefined): boolean {
  if (!cost) return false;
  return /^\s*(free|0|0\.00|\$0)\s*$/i.test(cost);
}

interface PriceRange {
  low: number;
  high: number;
}

function buildOffers(event: TribeEvent): PriceRange | null {
  const raw = event.cost_details?.values ?? [];
  const numeric = raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
  if (numeric.length === 0) return null;
  return { low: Math.min(...numeric), high: Math.max(...numeric) };
}

function legacyOffer(event: TribeEvent): Record<string, unknown> | null {
  const range = buildOffers(event);
  if (!range) return null;
  return {
    "@type": "Offer",
    priceCurrency: event.cost_details?.currency_code ?? "USD",
    price: range.low,
    highPrice: range.high,
  };
}

function collectCategories(event: TribeEvent): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | undefined) => {
    if (!raw) return;
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag) || tag.length > 40) return;
    seen.add(tag);
    out.push(tag);
  };
  for (const c of event.categories ?? []) push(c?.name);
  for (const t of event.tags ?? []) push(t?.name);
  return out.slice(0, 6);
}

const CITY_HINTS: Array<{ key: CityKey; matchers: RegExp[] }> = [
  { key: "tampa", matchers: [/\btampa\b/i, /\bybor\b/i] },
  { key: "st_petersburg", matchers: [/st\.?\s*pete(rsburg)?/i, /\bgulfport\b/i] },
  { key: "clearwater", matchers: [/clearwater/i] },
  { key: "brandon", matchers: [/\bbrandon\b/i, /valrico/i, /riverview/i] },
  { key: "bradenton", matchers: [/bradenton/i, /palmetto/i, /anna maria/i] },
  { key: "safety_harbor", matchers: [/safety\s*harbor/i] },
  { key: "dunedin", matchers: [/\bdunedin\b/i, /palm\s*harbor/i] },
];

function detectCity(text: string): CityKey {
  if (!text) return "other";
  for (const { key, matchers } of CITY_HINTS) {
    if (matchers.some((m) => m.test(text))) return key;
  }
  return "other";
}
