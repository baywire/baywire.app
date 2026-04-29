import type { CityKey } from "@/lib/cities";
import type { ExtractedPlace, PlaceCategoryValue } from "@/lib/extract/schemaPlace";

import { loadHtml } from "../parse";
import { cleanInlineText, stripHtmlToText } from "../text";

export interface SchemaOrgLocalBusiness {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  url?: string;
  telephone?: string;
  image?: string | string[] | { url?: string } | { url?: string }[];
  address?: SchemaOrgAddress | string;
  geo?: { latitude?: string | number; longitude?: string | number };
  priceRange?: string;
  openingHours?: string | string[];
  servesCuisine?: string | string[];
  keywords?: string | string[];
}

interface SchemaOrgAddress {
  "@type"?: string;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
}

const BUSINESS_TYPES = new Set([
  "LocalBusiness",
  "Restaurant",
  "BarOrPub",
  "Brewery",
  "CafeOrCoffeeShop",
  "Bakery",
  "FoodEstablishment",
  "Store",
  "TouristAttraction",
  "Museum",
  "AmusementPark",
  "ArtGallery",
  "Park",
  "Beach",
  "NightClub",
  "Winery",
  "LodgingBusiness",
  "EventVenue",
  "MusicVenue",
  "PerformingArtsTheater",
]);

const BUSINESS_TYPE_RE = /(?:Business|Restaurant|Bar|Pub|Cafe|Bakery|Museum|Gallery|Park|Store|Shop|Attraction|Venue)$/i;

function isBusinessType(t: string | string[] | undefined): boolean {
  if (!t) return false;
  const arr = Array.isArray(t) ? t : [t];
  return arr.some(
    (v) => typeof v === "string" && (BUSINESS_TYPES.has(v) || BUSINESS_TYPE_RE.test(v)),
  );
}

export function extractJsonLdPlaces(html: string): SchemaOrgLocalBusiness[] {
  const $ = loadHtml(html);
  const out: SchemaOrgLocalBusiness[] = [];

  $("script[type='application/ld+json']").each((_, el) => {
    const txt = $(el).text().trim();
    if (!txt) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(txt);
    } catch {
      return;
    }
    walkJsonLd(parsed, out);
  });

  return out;
}

function walkJsonLd(node: unknown, out: SchemaOrgLocalBusiness[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, out);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj["@graph"])) walkJsonLd(obj["@graph"], out);
  if (isBusinessType(obj["@type"] as string | string[] | undefined)) {
    out.push(obj as SchemaOrgLocalBusiness);
  }
}

const TYPE_TO_CATEGORY: Record<string, PlaceCategoryValue> = {
  Restaurant: "restaurant",
  FoodEstablishment: "restaurant",
  BarOrPub: "bar",
  NightClub: "bar",
  Brewery: "brewery",
  Winery: "bar",
  CafeOrCoffeeShop: "cafe",
  Bakery: "bakery",
  Museum: "museum",
  ArtGallery: "gallery",
  Park: "park",
  Beach: "beach",
  Store: "shop",
  TouristAttraction: "attraction",
  AmusementPark: "attraction",
  EventVenue: "venue",
  MusicVenue: "venue",
  PerformingArtsTheater: "venue",
};

export function jsonLdPlaceToExtracted(biz: SchemaOrgLocalBusiness): ExtractedPlace | null {
  if (!biz.name) return null;
  const name = cleanInlineText(biz.name);
  if (!name) return null;

  const description = stripHtmlToText(biz.description).slice(0, 2000) || null;
  const address = formatSchemaAddress(biz.address);
  const cityHint = `${name} ${address ?? ""}`;

  const category = detectCategory(biz);
  const lat = parseCoord(biz.geo?.latitude);
  const lng = parseCoord(biz.geo?.longitude);
  const imageUrl = pickImage(biz.image);
  const websiteUrl = sanitizeHttp(biz.url) ?? null;
  const phoneNumber = cleanInlineText(biz.telephone) || null;
  const priceRange = cleanInlineText(biz.priceRange) || null;
  const vibes = collectVibesHints(biz);

  return {
    name: name.slice(0, 200),
    description,
    category,
    city: detectCity(cityHint),
    address: address ? address.slice(0, 300) : null,
    lat,
    lng,
    imageUrl,
    websiteUrl,
    phoneNumber,
    priceRange,
    hoursJson: parseOpeningHours(biz.openingHours),
    vibes,
  };
}

function detectCategory(biz: SchemaOrgLocalBusiness): PlaceCategoryValue {
  const types = Array.isArray(biz["@type"]) ? biz["@type"] : biz["@type"] ? [biz["@type"]] : [];
  for (const t of types) {
    const cat = TYPE_TO_CATEGORY[t];
    if (cat) return cat;
  }
  return "other";
}

function formatSchemaAddress(addr: SchemaOrgAddress | string | undefined): string | null {
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

function parseCoord(v: string | number | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickImage(input: SchemaOrgLocalBusiness["image"]): string | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const url = pickImage(item as SchemaOrgLocalBusiness["image"]);
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

function sanitizeHttp(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function parseOpeningHours(input: string | string[] | undefined): string[] | null {
  if (!input) return null;
  const arr = Array.isArray(input) ? input : [input];
  const out = arr.map((s) => s.trim()).filter(Boolean);
  return out.length > 0 ? out : null;
}

function collectVibesHints(biz: SchemaOrgLocalBusiness): string[] {
  const out: string[] = [];
  if (typeof biz.servesCuisine === "string") {
    out.push(...biz.servesCuisine.split(",").map((s) => s.trim().toLowerCase()));
  } else if (Array.isArray(biz.servesCuisine)) {
    out.push(...biz.servesCuisine.map((s) => s.trim().toLowerCase()));
  }
  if (typeof biz.keywords === "string") {
    out.push(...biz.keywords.split(",").map((s) => s.trim().toLowerCase()));
  } else if (Array.isArray(biz.keywords)) {
    out.push(...biz.keywords.map((s) => s.trim().toLowerCase()));
  }
  return dedupeStrings(out).slice(0, 10);
}

function dedupeStrings(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of input) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
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
