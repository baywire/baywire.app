import type { Prisma } from "@prisma/client";

import type { CityKey } from "@/lib/cities";
import type { ExtractedEvent } from "@/lib/extract/schema";
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
  { key: "clearwater", matchers: [/clearwater/i, /dunedin/i, /palm harbor/i] },
  { key: "brandon", matchers: [/\bbrandon\b/i, /valrico/i, /riverview/i] },
  { key: "bradenton", matchers: [/bradenton/i, /palmetto/i, /anna maria/i] },
];

export function normalizeExtractedEvent(args: NormalizeArgs): NormalizeResult | NormalizeError {
  const { extracted } = args;
  const startAt = parseLocalDate(extracted.startLocal);
  if (!startAt) return { ok: false, reason: `invalid startLocal: ${extracted.startLocal}` };
  const endAt = parseLocalDate(extracted.endLocal);

  const city = refineCity(extracted.city, extracted.address ?? extracted.venueName ?? "");

  const categories = dedupeCategories(extracted.categories);

  const row: Prisma.EventUncheckedCreateInput & { startAt: Date; endAt: Date | null } = {
    sourceId: args.sourceId,
    sourceEventId: args.sourceEventId,
    title: extracted.title.trim(),
    description: extracted.description?.trim() || null,
    startAt,
    endAt: endAt ?? null,
    allDay: extracted.allDay,
    venueName: extracted.venueName?.trim() || null,
    address: extracted.address?.trim() || null,
    city,
    lat: null,
    lng: null,
    priceMin: extracted.priceMin == null ? null : extracted.priceMin.toFixed(2),
    priceMax: extracted.priceMax == null ? null : extracted.priceMax.toFixed(2),
    isFree: extracted.isFree,
    categories,
    imageUrl: extracted.imageUrl ?? null,
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
