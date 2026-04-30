import { formatInTimeZone } from "date-fns-tz";

import type { CityKey } from "@/lib/cities";
import type { ExtractedEvent, ExtractedOffer, PriceTier, TicketStatusValue } from "@/lib/extract/schema";
import { TZ } from "@/lib/time/window";

import { loadHtml } from "./parse";
import { cleanInlineText, stripHtmlToText } from "./text";

/**
 * Subset of schema.org/Event we actually consume. The full vocabulary is
 * enormous; we keep this loose so adapters can hand us anything that vaguely
 * matches and we'll do our best to convert it.
 */
export interface SchemaOrgEvent {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string | null;
  url?: string;
  image?: string | string[] | { url?: string } | { url?: string }[];
  isAccessibleForFree?: boolean | string;
  offers?: SchemaOrgOffer | SchemaOrgOffer[];
  location?: SchemaOrgPlace | string | (SchemaOrgPlace | string)[];
  keywords?: string | string[];
  about?: { name?: string } | { name?: string }[];
  performer?: { name?: string } | { name?: string }[];
  eventStatus?: string;
}

export interface SchemaOrgPlace {
  "@type"?: string;
  name?: string;
  address?: SchemaOrgAddress | string;
}

export interface SchemaOrgAddress {
  "@type"?: string;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
}

export interface SchemaOrgOffer {
  "@type"?: string;
  url?: string;
  name?: string;
  price?: string | number;
  highPrice?: string | number;
  lowPrice?: string | number;
  priceCurrency?: string;
  availability?: string;
  validFrom?: string;
}

const EVENT_TYPE_RE = /event$/i;
const KNOWN_EVENT_TYPES = new Set([
  "Event",
  "Festival",
  "Hackathon",
]);

function isEventType(t: string | string[] | undefined): boolean {
  if (!t) return false;
  const arr = Array.isArray(t) ? t : [t];
  return arr.some(
    (v) => typeof v === "string" && (KNOWN_EVENT_TYPES.has(v) || EVENT_TYPE_RE.test(v)),
  );
}

/**
 * Extracts every schema.org/Event-shaped object from the JSON-LD blocks of an
 * HTML document, including those nested under `@graph`.
 */
export function extractJsonLdEvents(html: string): SchemaOrgEvent[] {
  const $ = loadHtml(html);
  const out: SchemaOrgEvent[] = [];

  $("script[type='application/ld+json']").each((_, el) => {
    const txt = $(el).text().trim();
    if (!txt) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(txt);
    } catch (err) {
      console.warn(
        `[structured] warn="invalid JSON-LD block" bytes=${txt.length} error="${err instanceof Error ? err.message : String(err)}"`,
      );
      return;
    }
    walkJsonLd(parsed, out);
  });

  return out;
}

function walkJsonLd(node: unknown, out: SchemaOrgEvent[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, out);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj["@graph"])) walkJsonLd(obj["@graph"], out);
  if (isEventType(obj["@type"] as string | string[] | undefined)) {
    out.push(obj as SchemaOrgEvent);
  }
}

/**
 * Looks for a calendar feed advertised by the page (RFC 5988 link element)
 * and returns the absolute URL. Falls back to common WordPress / CivicPlus
 * patterns when no explicit `<link rel="alternate">` exists.
 */
export function findIcsLink(html: string, baseUrl: string): string | null {
  const $ = loadHtml(html);
  let found: string | null = null;
  $('link[rel="alternate"]').each((_, el) => {
    if (found) return;
    const type = ($(el).attr("type") ?? "").toLowerCase();
    const href = $(el).attr("href");
    if (!href) return;
    if (type.includes("calendar") || type.includes("ical")) {
      found = absolutize(href, baseUrl);
    }
  });
  if (found) return found;

  $('a[href]').each((_, el) => {
    if (found) return;
    const href = $(el).attr("href") ?? "";
    if (/\.ics(?:$|[?#])/i.test(href) || /[?&]format=ical/i.test(href)) {
      found = absolutize(href, baseUrl);
    }
  });
  return found;
}

function absolutize(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

export interface IcsDateTime {
  /** Raw ICS value, e.g. "20260502T193000" or "20260502". */
  value: string;
  /** Optional TZID parameter. */
  tzid?: string;
  /** True for `VALUE=DATE` (all-day) dates. */
  isDate: boolean;
  /** True when the value ends with Z (UTC). */
  isUtc: boolean;
}

export interface IcsEvent {
  uid: string;
  summary?: string;
  description?: string;
  dtStart: IcsDateTime;
  dtEnd?: IcsDateTime;
  location?: string;
  url?: string;
  categories?: string[];
}

/**
 * Minimal RFC 5545 parser. Handles the property subset Baywire needs:
 * UID/SUMMARY/DESCRIPTION/DTSTART/DTEND/LOCATION/URL/CATEGORIES, including
 * line unfolding and the most common parameters (`TZID`, `VALUE=DATE`).
 */
export function parseICalFeed(text: string): IcsEvent[] {
  const lines = unfold(text);
  const out: IcsEvent[] = [];
  let current: Partial<IcsEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.uid && current.dtStart) {
        out.push(current as IcsEvent);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const head = line.slice(0, colon);
    const value = unescapeIcsText(line.slice(colon + 1));
    const [name, ...paramParts] = head.split(";");
    const params = parseParams(paramParts);
    const upper = name.toUpperCase();

    switch (upper) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.summary = value;
        break;
      case "DESCRIPTION":
        current.description = value;
        break;
      case "LOCATION":
        current.location = value;
        break;
      case "URL":
        current.url = value;
        break;
      case "CATEGORIES":
        current.categories = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "DTSTART":
        current.dtStart = toIcsDateTime(value, params);
        break;
      case "DTEND":
        current.dtEnd = toIcsDateTime(value, params);
        break;
    }
  }

  return out;
}

function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

function parseParams(parts: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    out[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return out;
}

function toIcsDateTime(value: string, params: Record<string, string>): IcsDateTime {
  const isDate = (params["VALUE"] ?? "").toUpperCase() === "DATE" || /^\d{8}$/.test(value);
  return {
    value,
    tzid: params["TZID"],
    isDate,
    isUtc: value.endsWith("Z"),
  };
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Converts a JSON-LD Event into an ExtractedEvent. Returns null when the
 * event lacks the minimum required fields (title + start). City defaults to
 * `other`; the pipeline's `refineCity` does the address-aware fill-in.
 */
export function jsonLdEventToExtracted(ev: SchemaOrgEvent): ExtractedEvent | null {
  if (!ev.name || !ev.startDate) return null;

  const startLocal = isoToLocalNyString(ev.startDate);
  if (!startLocal) return null;
  const endLocal = ev.endDate ? isoToLocalNyString(ev.endDate) : null;

  const startHasTime = /T\d/.test(ev.startDate);
  const allDay = !startHasTime && /^\d{4}-\d{2}-\d{2}$/.test(ev.startDate);

  const place = pickPlace(ev.location);
  const venueName = cleanInlineText(place?.name) || null;
  const address = cleanInlineText(formatSchemaAddress(place?.address)) || null;

  const offers = pickOffer(ev.offers);
  const priceMin = parsePrice(offers?.lowPrice ?? offers?.price);
  const priceMax =
    parsePrice(offers?.highPrice) ?? parsePrice(offers?.price) ?? priceMin;
  const isFree =
    ev.isAccessibleForFree === true ||
    /^true$/i.test(String(ev.isAccessibleForFree ?? "")) ||
    (priceMin === 0 && priceMax === 0);

  const imageUrl = pickImage(ev.image);
  const cityHint = `${venueName ?? ""} ${address ?? ""}`;
  const offer = buildOfferFromJsonLd(ev, isFree);

  return {
    title: cleanInlineText(ev.name).slice(0, 300),
    description: stripHtmlToText(ev.description).slice(0, 2000) || null,
    startLocal,
    endLocal,
    allDay,
    venueName: venueName ? venueName.slice(0, 200) : null,
    address: address ? address.slice(0, 300) : null,
    city: detectCity(cityHint),
    priceMin: priceMin ?? null,
    priceMax: priceMax ?? null,
    isFree: Boolean(isFree),
    categories: dedupeCategories(collectKeywords(ev)),
    imageUrl,
    offer,
  };
}

/**
 * Converts an ICS VEVENT into an ExtractedEvent. Untimed dates become all-day
 * 00:00. Time zone resolution: `TZID=America/New_York` and floating values
 * are treated as already-local; UTC values are converted via date-fns-tz.
 */
export function icsEventToExtracted(ev: IcsEvent): ExtractedEvent | null {
  if (!ev.summary || !ev.dtStart) return null;

  const startLocal = icsToLocalNyString(ev.dtStart);
  if (!startLocal) return null;
  const endLocal = ev.dtEnd ? icsToLocalNyString(ev.dtEnd) : null;
  const allDay = ev.dtStart.isDate;

  const description = stripHtmlToText(ev.description).slice(0, 2000) || null;
  const location = cleanInlineText(ev.location);
  const venueName = cleanInlineText(ev.location?.split(",")[0]).slice(0, 200) || null;
  const address = location.slice(0, 300) || null;
  const cityHint = location;

  return {
    title: cleanInlineText(ev.summary).slice(0, 300),
    description,
    startLocal,
    endLocal,
    allDay,
    venueName,
    address,
    city: detectCity(cityHint),
    priceMin: null,
    priceMax: null,
    isFree: false,
    categories: dedupeCategories(ev.categories ?? []),
    imageUrl: null,
    offer: null,
  };
}

function isoToLocalNyString(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00`;

  const hasOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  if (!hasOffset) {
    const m = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/);
    if (!m) return null;
    return m[1].length === 16 ? `${m[1]}:00` : m[1];
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function icsToLocalNyString(d: IcsDateTime): string | null {
  if (d.isDate) {
    const m = d.value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}T00:00:00`;
  }
  const m = d.value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return null;
  const [, y, mo, da, h, mi, s] = m;
  if (d.isUtc) {
    const date = new Date(`${y}-${mo}-${da}T${h}:${mi}:${s}Z`);
    if (Number.isNaN(date.getTime())) return null;
    return formatInTimeZone(date, TZ, "yyyy-MM-dd'T'HH:mm:ss");
  }
  // Floating, or TZID we trust as NY-equivalent for our scope.
  return `${y}-${mo}-${da}T${h}:${mi}:${s}`;
}

function pickPlace(loc: SchemaOrgEvent["location"]): SchemaOrgPlace | null {
  if (!loc) return null;
  if (Array.isArray(loc)) return pickPlace(loc[0] as SchemaOrgPlace | string | undefined);
  if (typeof loc === "string") return { name: loc };
  return loc;
}

function formatSchemaAddress(addr: SchemaOrgPlace["address"] | undefined): string | null {
  if (!addr) return null;
  if (typeof addr === "string") return addr.trim() || null;
  const parts = [
    addr.streetAddress,
    addr.addressLocality,
    addr.addressRegion,
    addr.postalCode,
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function pickOffer(input: SchemaOrgEvent["offers"]): SchemaOrgOffer | null {
  if (!input) return null;
  return Array.isArray(input) ? input[0] ?? null : input;
}

function parsePrice(input: string | number | undefined): number | null {
  if (input == null) return null;
  const n = typeof input === "number" ? input : Number(String(input).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pickImage(input: SchemaOrgEvent["image"]): string | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const url = pickImage(item as SchemaOrgEvent["image"]);
      if (url) return url;
    }
    return null;
  }
  if (typeof input === "string") return sanitizeHttp(input);
  if (typeof input === "object" && "url" in input && typeof input.url === "string") {
    return sanitizeHttp(input.url);
  }
  return null;
}

function sanitizeHttp(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function collectKeywords(ev: SchemaOrgEvent): string[] {
  const out: string[] = [];
  if (typeof ev.keywords === "string") {
    out.push(...ev.keywords.split(",").map((s) => s.trim()));
  } else if (Array.isArray(ev.keywords)) {
    out.push(...ev.keywords);
  }
  const about = Array.isArray(ev.about) ? ev.about : ev.about ? [ev.about] : [];
  for (const a of about) {
    if (a?.name) out.push(a.name);
  }
  return out.filter(Boolean) as string[];
}

function dedupeCategories(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 6) break;
  }
  return out;
}

const AVAILABILITY_TO_STATUS: Record<string, TicketStatusValue> = {
  "https://schema.org/InStock": "on_sale",
  "https://schema.org/SoldOut": "sold_out",
  "https://schema.org/PreOrder": "not_yet",
  "https://schema.org/LimitedAvailability": "on_sale",
  "https://schema.org/OnlineOnly": "on_sale",
  "https://schema.org/Discontinued": "cancelled",
  InStock: "on_sale",
  SoldOut: "sold_out",
  PreOrder: "not_yet",
  LimitedAvailability: "on_sale",
  Discontinued: "cancelled",
};

function buildOfferFromJsonLd(ev: SchemaOrgEvent, isFree: boolean): ExtractedOffer | null {
  const allOffers = normalizeOfferArray(ev.offers);
  if (allOffers.length === 0 && !isFree) return null;

  const first = allOffers[0] ?? null;
  const ticketUrl = (first?.url ? sanitizeHttp(first.url) : null) ?? (ev.url ? sanitizeHttp(ev.url) : null);
  const currency = first?.priceCurrency?.toUpperCase().slice(0, 3) ?? null;

  let status: TicketStatusValue | null = null;
  if (isFree) {
    status = "free";
  } else if (first?.availability) {
    status = AVAILABILITY_TO_STATUS[first.availability] ?? "unknown";
  }

  const validFromLocal = first?.validFrom ? isoToLocalNyString(first.validFrom) : null;

  let tiers: PriceTier[] | null = null;
  if (allOffers.length > 1) {
    const built: PriceTier[] = [];
    for (const o of allOffers) {
      const min = parsePrice(o.lowPrice ?? o.price);
      const max = parsePrice(o.highPrice ?? o.price) ?? min;
      if (min == null && max == null) continue;
      built.push({
        name: o.name ?? o["@type"] ?? "Ticket",
        min: min ?? null,
        max: max ?? null,
        currency: o.priceCurrency?.toUpperCase().slice(0, 3) ?? currency,
      });
    }
    if (built.length > 1) tiers = built.slice(0, 8);
  }

  if (!ticketUrl && !status && !tiers) return null;

  return {
    ticketUrl,
    status,
    currency,
    onSaleLocal: null,
    validFromLocal,
    tiers,
  };
}

function normalizeOfferArray(input: SchemaOrgEvent["offers"]): SchemaOrgOffer[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
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
