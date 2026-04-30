import type { CityKey } from "@/lib/cities";
import { normalizeCategoryTags } from "@/lib/events/tagCanonical";
import type { ExtractedEvent, ExtractedOffer, PriceTier, TicketStatusValue } from "@/lib/extract/schema";

import { politeFetch } from "./fetch";
import { cleanInlineText, stripHtmlToText } from "./text";
import type { ListingItem, SourceAdapter, StructuredEvent } from "./types";

/**
 * Ticketmaster Discovery API. Their public `/discover/tampa` page is
 * Akamai/PerimeterX-protected and JS-rendered, so we drive the official free
 * Discovery API instead. One call returns the entire venue+date+price+image
 * payload in a single JSON document, which means structured-first with zero
 * LLM cost. Free tier is 5,000 requests/day; we issue ~3 per scrape (one
 * listing fetch, plus retries on cold cache).
 *
 * DMA 635 = "Tampa-St. Petersburg-Sarasota", which covers every city the
 * aggregator displays. Page size is capped at 200 by the API. We stay on the
 * structured path entirely; `fetchAndReduce` is a defensive fallback that
 * synthesizes a JSON-LD blob from the cached payload so the LLM path keeps
 * working if `tryStructured` ever returns null.
 */

interface TicketmasterImage {
  url?: string;
  width?: number;
  height?: number;
  ratio?: string;
}

interface TicketmasterClassification {
  primary?: boolean;
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
  type?: { name?: string };
  subType?: { name?: string };
}

interface TicketmasterPriceRange {
  type?: string;
  currency?: string;
  min?: number;
  max?: number;
}

interface TicketmasterVenue {
  name?: string;
  city?: { name?: string };
  state?: { name?: string; stateCode?: string };
  postalCode?: string;
  address?: { line1?: string; line2?: string };
  location?: { longitude?: string; latitude?: string };
}

interface TicketmasterDates {
  start?: {
    localDate?: string;
    localTime?: string;
    dateTime?: string;
    dateTBD?: boolean;
    dateTBA?: boolean;
    timeTBA?: boolean;
    noSpecificTime?: boolean;
  };
  end?: {
    localDate?: string;
    localTime?: string;
    dateTime?: string;
    approximate?: boolean;
    noSpecificTime?: boolean;
  };
  timezone?: string;
  status?: { code?: string };
}

interface TicketmasterSales {
  public?: {
    startDateTime?: string;
    endDateTime?: string;
    startTBD?: boolean;
    startTBA?: boolean;
  };
}

interface TicketmasterEvent {
  id: string;
  name: string;
  url?: string;
  info?: string;
  description?: string;
  pleaseNote?: string;
  images?: TicketmasterImage[];
  classifications?: TicketmasterClassification[];
  priceRanges?: TicketmasterPriceRange[];
  dates?: TicketmasterDates;
  sales?: TicketmasterSales;
  _embedded?: { venues?: TicketmasterVenue[] };
}

interface TicketmasterListResponse {
  _embedded?: { events?: TicketmasterEvent[] };
  page?: { number?: number; totalPages?: number };
}

const SLUG = "ticketmaster";
const API_ORIGIN = "https://app.ticketmaster.com";
const DMA_ID = 635;
const PAGE_SIZE = 200;
const MAX_PAGES = 1;

const cache = new Map<string, TicketmasterEvent>();

export const ticketmasterAdapter: SourceAdapter = {
  slug: SLUG,
  label: "Ticketmaster",
  baseUrl: "https://www.ticketmaster.com",

  async listEvents({ windowStart, windowEnd, signal }) {
    const apiKey = process.env.TICKETMASTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "TICKETMASTER_API_KEY is not set. Get a free key at https://developer.ticketmaster.com/.",
      );
    }

    cache.clear();
    const out: ListingItem[] = [];
    const startDateTime = formatApiDate(windowStart);
    const endDateTime = formatApiDate(windowEnd);

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = buildListUrl({ apiKey, page, startDateTime, endDateTime });
      const body = await politeFetch(url, {
        signal,
        headers: { Accept: "application/json" },
        label: `${SLUG}:list:p${page}`,
      });

      let parsed: TicketmasterListResponse;
      try {
        parsed = JSON.parse(body) as TicketmasterListResponse;
      } catch (err) {
        console.warn(
          `[${SLUG}] warn="listing JSON parse failed" page=${page} bytes=${body.length} error="${err instanceof Error ? err.message : String(err)}"`,
        );
        break;
      }

      const events = parsed._embedded?.events ?? [];
      if (events.length === 0) break;

      for (const ev of events) {
        if (!ev?.id || !ev.name) continue;
        if (cache.has(ev.id)) continue;
        cache.set(ev.id, ev);
        out.push({ sourceEventId: ev.id, url: ev.url ?? `${API_ORIGIN}/event/${ev.id}` });
      }

      const totalPages = parsed.page?.totalPages ?? 1;
      if (page + 1 >= totalPages) break;
    }

    return out;
  },

  async tryStructured(item): Promise<StructuredEvent | null> {
    const event = cache.get(item.sourceEventId);
    if (!event) return null;
    const extracted = ticketmasterEventToExtracted(event);
    if (!extracted) return null;
    return { event: extracted, canonicalUrl: event.url ?? item.url };
  },

  async fetchAndReduce(item) {
    const event = cache.get(item.sourceEventId);
    if (!event) {
      return { reducedHtml: "", canonicalUrl: item.url };
    }
    return {
      reducedHtml: synthesizeReducedBlob(event),
      canonicalUrl: event.url ?? item.url,
    };
  },
};

function buildListUrl(opts: {
  apiKey: string;
  page: number;
  startDateTime: string;
  endDateTime: string;
}): string {
  const params = new URLSearchParams({
    apikey: opts.apiKey,
    dmaId: String(DMA_ID),
    size: String(PAGE_SIZE),
    page: String(opts.page),
    sort: "date,asc",
    startDateTime: opts.startDateTime,
    endDateTime: opts.endDateTime,
  });
  return `${API_ORIGIN}/discovery/v2/events.json?${params.toString()}`;
}

/**
 * Discovery API rejects ISO strings with milliseconds. Trim to second
 * precision and force UTC `Z`.
 */
function formatApiDate(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

function ticketmasterEventToExtracted(event: TicketmasterEvent): ExtractedEvent | null {
  if (!event.name || !event.dates?.start) return null;

  const start = event.dates.start;
  const startLocal = pickLocalIso(start.localDate, start.localTime);
  if (!startLocal) return null;

  const end = event.dates.end;
  const endLocal = end?.localDate ? pickLocalIso(end.localDate, end.localTime) : null;

  const allDay = Boolean(start.noSpecificTime) || !start.localTime;
  const venue = event._embedded?.venues?.[0];
  const venueName = cleanInlineText(venue?.name) || null;
  const address = venue ? cleanInlineText(formatAddress(venue)) || null : null;

  const description = composeDescription(event);
  const imageUrl = pickBestImage(event.images);
  const cityHint = `${venueName ?? ""} ${address ?? ""}`;
  const priceRange = pickPriceRange(event.priceRanges);

  const isFree = priceRange ? priceRange.min === 0 && (priceRange.max ?? 0) === 0 : false;
  const offer = buildTicketmasterOffer(event, isFree);

  return {
    title: cleanInlineText(event.name).slice(0, 300),
    description: description ? description.slice(0, 2000) : null,
    startLocal,
    endLocal,
    allDay,
    venueName: venueName ? venueName.slice(0, 200) : null,
    address: address ? address.slice(0, 300) : null,
    city: detectCity(cityHint),
    priceMin: priceRange?.min ?? null,
    priceMax: priceRange?.max ?? priceRange?.min ?? null,
    isFree,
    categories: collectCategories(event),
    imageUrl,
    offer,
  };
}

function pickLocalIso(date: string | undefined, time: string | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!time) return `${date}T00:00:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return `${date}T${time}`;
  if (/^\d{2}:\d{2}$/.test(time)) return `${date}T${time}:00`;
  return `${date}T00:00:00`;
}

function formatAddress(venue: TicketmasterVenue): string {
  const parts = [
    venue.address?.line1,
    venue.address?.line2,
    venue.city?.name,
    venue.state?.stateCode ?? venue.state?.name,
    venue.postalCode,
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.join(", ");
}

function composeDescription(event: TicketmasterEvent): string {
  const segments = [event.description, event.info, event.pleaseNote]
    .map((s) => stripHtmlToText(s))
    .filter(Boolean);
  if (segments.length === 0) return "";
  return segments.join("\n\n");
}

function pickBestImage(images: TicketmasterImage[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  let best: TicketmasterImage | null = null;
  let bestArea = -1;
  for (const img of images) {
    if (!img.url) continue;
    const area = (img.width ?? 0) * (img.height ?? 0);
    if (area > bestArea) {
      best = img;
      bestArea = area;
    }
  }
  return sanitizeHttp(best?.url);
}

function sanitizeHttp(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function pickPriceRange(ranges: TicketmasterPriceRange[] | undefined): { min: number; max?: number } | null {
  if (!ranges || ranges.length === 0) return null;
  // Prefer "standard" tier; fall back to whatever is first.
  const std = ranges.find((r) => r.type === "standard") ?? ranges[0];
  if (typeof std.min !== "number" || !Number.isFinite(std.min)) return null;
  const max = typeof std.max === "number" && Number.isFinite(std.max) ? std.max : undefined;
  return { min: std.min, max };
}

function collectCategories(event: TicketmasterEvent): string[] {
  const rawTags: string[] = [];
  for (const c of event.classifications ?? []) {
    if (c.segment?.name) rawTags.push(c.segment.name);
    if (c.genre?.name) rawTags.push(c.genre.name);
    if (c.subGenre?.name) rawTags.push(c.subGenre.name);
  }
  return normalizeCategoryTags(rawTags, 6);
}

function synthesizeReducedBlob(event: TicketmasterEvent): string {
  const venue = event._embedded?.venues?.[0];
  const venueName = cleanInlineText(venue?.name);
  const address = venue ? cleanInlineText(formatAddress(venue)) : "";
  const description = composeDescription(event);
  const start = event.dates?.start;
  const end = event.dates?.end;
  const startLocal = start ? pickLocalIso(start.localDate, start.localTime) ?? "" : "";
  const endLocal = end ? pickLocalIso(end.localDate, end.localTime) ?? "" : "";
  const priceRange = pickPriceRange(event.priceRanges);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: cleanInlineText(event.name),
    description,
    startDate: startLocal,
    endDate: endLocal || null,
    url: event.url,
    image: pickBestImage(event.images),
    location: venue
      ? {
        "@type": "Place",
        name: venueName || null,
        address: address || null,
      }
      : null,
    offers: priceRange
      ? {
        "@type": "AggregateOffer",
        priceCurrency: event.priceRanges?.[0]?.currency ?? "USD",
        lowPrice: priceRange.min,
        highPrice: priceRange.max ?? priceRange.min,
      }
      : null,
    keywords: collectCategories(event),
  };

  const lines: string[] = [
    "Source: Ticketmaster",
    `Title: ${cleanInlineText(event.name)}`,
  ];
  if (venueName) lines.push(`Venue: ${venueName}`);
  if (address) lines.push(`Address: ${address}`);
  if (startLocal) lines.push(`Starts (local): ${startLocal}`);
  if (endLocal) lines.push(`Ends (local): ${endLocal}`);
  if (priceRange) {
    lines.push(`Price: $${priceRange.min}${priceRange.max && priceRange.max !== priceRange.min ? ` – $${priceRange.max}` : ""}`);
  }
  if (description) lines.push("", description);

  return [
    "JSON-LD:",
    JSON.stringify(jsonLd, null, 2),
    "",
    "Text:",
    lines.join("\n"),
  ].join("\n");
}

const TM_STATUS_MAP: Record<string, TicketStatusValue> = {
  onsale: "on_sale",
  offsale: "not_yet",
  cancelled: "cancelled",
  postponed: "not_yet",
  rescheduled: "on_sale",
};

function buildTicketmasterOffer(event: TicketmasterEvent, isFree: boolean): ExtractedOffer {
  const ticketUrl = sanitizeHttp(event.url) ?? null;
  const currency = event.priceRanges?.[0]?.currency?.toUpperCase().slice(0, 3) ?? "USD";

  let status: TicketStatusValue = "unknown";
  if (isFree) {
    status = "free";
  } else {
    const code = event.dates?.status?.code?.toLowerCase() ?? "";
    status = TM_STATUS_MAP[code] ?? "on_sale";
  }

  let onSaleLocal: string | null = null;
  const publicStart = event.sales?.public?.startDateTime;
  if (publicStart) {
    const d = new Date(publicStart);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      onSaleLocal = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    }
  }

  let tiers: PriceTier[] | null = null;
  if (event.priceRanges && event.priceRanges.length > 1) {
    const built: PriceTier[] = [];
    for (const r of event.priceRanges) {
      if (typeof r.min !== "number" || !Number.isFinite(r.min)) continue;
      built.push({
        name: r.type ?? "Ticket",
        min: r.min,
        max: typeof r.max === "number" && Number.isFinite(r.max) ? r.max : r.min,
        currency: r.currency?.toUpperCase().slice(0, 3) ?? currency,
      });
    }
    if (built.length > 1) tiers = built.slice(0, 8);
  }

  return {
    ticketUrl,
    status,
    currency,
    onSaleLocal,
    validFromLocal: null,
    tiers,
  };
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
