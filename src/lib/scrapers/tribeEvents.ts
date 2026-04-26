import { politeFetch } from "./fetch";
import type { ListingItem, SourceAdapter } from "./types";

/**
 * Adapter factory for sites running The Events Calendar (Tribe) WordPress
 * plugin. Tribe ships a public REST API at /wp-json/tribe/events/v1/events
 * which returns fully structured event records (start/end in local time,
 * venue, image, cost, categories), so we synthesize a JSON-LD-style blob and
 * feed it through the existing reduce/extract path. This keeps the pipeline
 * uniform (content-hash dedupe, city refinement, category normalization)
 * with effectively zero per-event LLM context overhead.
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

    async fetchAndReduce(item, signal) {
      let event = cache.get(item.sourceEventId);
      if (!event) {
        const body = await politeFetch(`${apiBase}/${item.sourceEventId}`, {
          signal,
          headers: { Accept: "application/json" },
        });
        event = JSON.parse(body) as TribeEvent;
      }
      return {
        reducedHtml: synthesizeReducedBlob(event, cfg.label),
        canonicalUrl: event.url || item.url,
      };
    },
  };
}

function synthesizeReducedBlob(event: TribeEvent, sourceLabel: string): string {
  const venue = pickVenue(event.venue);
  const description = stripHtml(event.description ?? event.excerpt ?? "");

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description,
    startDate: toIso(event.start_date),
    endDate: toIso(event.end_date),
    eventStatus: "EventScheduled",
    eventAttendanceMode: "OfflineEventAttendanceMode",
    url: event.url,
    image: pickImage(event.image),
    isAccessibleForFree: detectFree(event.cost),
    offers: buildOffers(event),
    location: venue
      ? {
          "@type": "Place",
          name: venue.venue ?? null,
          address: formatAddress(venue) || null,
        }
      : null,
    keywords: collectKeywords(event),
  };

  const meta: string[] = [
    `og:title: ${event.title ?? ""}`,
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
    `Title: ${event.title ?? ""}`,
  ];
  if (venue?.venue) textLines.push(`Venue: ${venue.venue}`);
  if (venue) {
    const addr = formatAddress(venue);
    if (addr) textLines.push(`Address: ${addr}`);
  }
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

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.includes("T") ? value : value.replace(" ", "T");
}

function detectFree(cost: string | undefined): boolean | null {
  if (!cost) return null;
  return /^\s*(free|0|0\.00|\$0)\s*$/i.test(cost) ? true : null;
}

function buildOffers(event: TribeEvent): Record<string, unknown> | null {
  const raw = event.cost_details?.values ?? [];
  const numeric = raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
  if (numeric.length === 0) return null;
  return {
    "@type": "Offer",
    priceCurrency: event.cost_details?.currency_code ?? "USD",
    price: Math.min(...numeric),
    highPrice: Math.max(...numeric),
  };
}

function collectKeywords(event: TribeEvent): string[] {
  const out = new Set<string>();
  for (const c of event.categories ?? []) if (c?.name) out.add(c.name);
  for (const t of event.tags ?? []) if (t?.name) out.add(t.name);
  return Array.from(out);
}

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&#8217;": "\u2019",
  "&#8216;": "\u2018",
  "&#8211;": "\u2013",
  "&#8212;": "\u2014",
  "&#8230;": "\u2026",
};

function stripHtml(html: string): string {
  if (!html) return "";
  let out = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    out = out.split(entity).join(replacement);
  }
  return out
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
