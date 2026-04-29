import { Prisma } from "@/generated/prisma/client";

import type { CityKey } from "@/lib/cities";
import type { ExtractedPlace } from "@/lib/extract/schemaPlace";
import { PLACE_CATEGORIES } from "@/lib/extract/schemaPlace";
import { cleanInlineText, stripHtmlToText } from "@/lib/scrapers/text";

export interface NormalizePlaceArgs {
  sourceId: string;
  sourcePlaceId: string;
  sourceUrl: string;
  contentHash: string;
  extracted: ExtractedPlace;
}

export interface NormalizePlaceResult {
  ok: true;
  row: Prisma.PlaceUncheckedCreateInput;
}

export interface NormalizePlaceError {
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

export function normalizeExtractedPlace(
  args: NormalizePlaceArgs,
): NormalizePlaceResult | NormalizePlaceError {
  const { extracted } = args;

  const name = cleanInlineText(extracted.name);
  if (!name) return { ok: false, reason: "empty name after sanitization" };

  const description = stripHtmlToText(extracted.description) || null;
  const address = cleanInlineText(extracted.address) || null;
  const city = refineCity(extracted.city, `${name} ${address ?? ""}`);
  const category =
    PLACE_CATEGORIES.includes(extracted.category) ? extracted.category : "other";
  const slug = slugify(name);
  const imageUrl = sanitizeHttpUrl(extracted.imageUrl);
  const websiteUrl = sanitizeHttpUrl(extracted.websiteUrl);
  const phoneNumber = cleanInlineText(extracted.phoneNumber)?.slice(0, 30) || null;
  const priceRange = validPriceRange(extracted.priceRange);
  const hoursJson = extracted.hoursJson;

  const row: Prisma.PlaceUncheckedCreateInput = {
    sourceId: args.sourceId,
    sourcePlaceId: args.sourcePlaceId,
    name,
    slug,
    description,
    category,
    city,
    address,
    lat: typeof extracted.lat === "number" && Number.isFinite(extracted.lat) ? extracted.lat : null,
    lng: typeof extracted.lng === "number" && Number.isFinite(extracted.lng) ? extracted.lng : null,
    imageUrl,
    websiteUrl,
    phoneNumber,
    priceRange,
    hoursJson: hoursJson ?? Prisma.DbNull,
    sourceUrl: args.sourceUrl,
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

function validPriceRange(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  return /^\${1,4}$/.test(trimmed) ? trimmed : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

