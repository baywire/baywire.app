import { Prisma } from "@/generated/prisma/client";

import type { CityKey } from "@/lib/cities";
import { normalizeCategoryTags as normalizeCategoryTagsShared } from "@/lib/events/tagCanonical";
import type { ExtractedEvent, PriceTier } from "@/lib/extract/schema";
import { TICKET_STATUSES } from "@/lib/extract/schema";
import { cleanInlineText, stripHtmlToText } from "@/lib/scrapers/text";
import { parseLocalDate } from "@/lib/time/window";

export interface NormalizeArgs {
  sourceId: string;
  sourceEventId: string;
  eventUrl: string;
  contentHash: string;
  extracted: ExtractedEvent;
}

export interface NormalizeResult {
  ok: true;
  row: Prisma.EventUncheckedCreateInput & { startAt: Date; endAt: Date | null };
}

export interface NormalizeError {
  ok: false;
  reason: string;
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

export function normalizeExtractedEvent(args: NormalizeArgs): NormalizeResult | NormalizeError {
  const { extracted } = args;
  const startAt = parseLocalDate(extracted.startLocal);
  if (!startAt) return { ok: false, reason: `invalid startLocal: ${extracted.startLocal}` };
  const endAt = parseLocalDate(extracted.endLocal);

  const title = cleanInlineText(extracted.title);
  if (!title) return { ok: false, reason: "empty title after sanitization" };

  const venueName = cleanInlineText(extracted.venueName) || null;
  const address = cleanInlineText(extracted.address) || null;
  const description = stripHtmlToText(extracted.description) || null;

  const city = refineCity(extracted.city, address ?? venueName ?? "");

  const categories = dedupeCategories(extracted.categories);

  const offer = extracted.offer;
  const ticketUrl = sanitizeHttpUrl(offer?.ticketUrl) ?? null;
  const ticketStatus = offer?.status && TICKET_STATUSES.includes(offer.status) ? offer.status : null;
  const ticketCurrency = offer?.currency?.toUpperCase().slice(0, 3) ?? null;
  const onSaleAt = offer?.onSaleLocal ? parseLocalDate(offer.onSaleLocal) ?? null : null;
  const validFromAt = offer?.validFromLocal ? parseLocalDate(offer.validFromLocal) ?? null : null;
  const priceTiers = normalizePriceTiers(offer?.tiers ?? null);

  const row: Prisma.EventUncheckedCreateInput & { startAt: Date; endAt: Date | null } = {
    sourceId: args.sourceId,
    sourceEventId: args.sourceEventId,
    title,
    description,
    startAt,
    endAt: endAt ?? null,
    allDay: extracted.allDay,
    venueName,
    address,
    city,
    lat: null,
    lng: null,
    priceMin: extracted.priceMin == null ? null : extracted.priceMin.toFixed(2),
    priceMax: extracted.priceMax == null ? null : extracted.priceMax.toFixed(2),
    isFree: extracted.isFree,
    ticketUrl,
    ticketStatus,
    ticketCurrency,
    onSaleAt,
    validFromAt,
    priceTiers: priceTiers ?? Prisma.DbNull,
    categories,
    imageUrl: sanitizeHttpUrl(extracted.imageUrl),
    eventUrl: args.eventUrl,
    contentHash: args.contentHash,
  };

  return { ok: true, row };
}

function refineCity(initial: CityKey, locationText: string): CityKey {
  if (initial !== "other") return initial;
  for (const { key, matchers } of CITY_HINTS) {
    if (matchers.some((m) => m.test(locationText))) return key;
  }
  return "other";
}

function sanitizeHttpUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const u = new URL(input);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function dedupeCategories(input: string[]): string[] {
  return normalizeCategoryTags(input, 6);
}

export function normalizeCategoryTags(input: readonly string[], limit = 6): string[] {
  return normalizeCategoryTagsShared(input, limit);
}

function normalizePriceTiers(tiers: PriceTier[] | null | undefined): PriceTier[] | null {
  if (!tiers || tiers.length === 0) return null;
  return tiers.slice(0, 8).map((t) => ({
    name: (t.name ?? "Ticket").slice(0, 80),
    min: typeof t.min === "number" && Number.isFinite(t.min) ? t.min : null,
    max: typeof t.max === "number" && Number.isFinite(t.max) ? t.max : null,
    currency: t.currency?.toUpperCase().slice(0, 3) ?? null,
  }));
}
