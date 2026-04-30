import pLimit from "p-limit";

import { CITIES, type CityKey } from "@/lib/cities";
import type { EnrichedPlace } from "./enrich";

const OVERTURE_API = "https://api.overturemapsapi.com";
const SEARCH_RADIUS_M = 15_000;
const RESULTS_PER_CITY = 1000;

export interface VerifiedPlace extends EnrichedPlace {
  overtureId: string | null;
  lat: number | null;
  lng: number | null;
  verified: boolean;
  overtureAddress: string | null;
}

interface OverturePlace {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: {
    names?: { primary?: string };
    categories?: { primary?: string; alternate?: string[] };
    addresses?: Array<{ freeform?: string; locality?: string; region?: string; postcode?: string }>;
    phones?: string[];
    websites?: string[];
  };
}

export interface VerifyOptions {
  concurrency?: number;
}

/**
 * Verify enriched places against the Overture Maps API. Batches lookups by
 * city (one API call per city, geo-radius search) then matches locally by
 * normalized name. This keeps API calls to ~7 instead of hundreds.
 */
export async function verifyPlaces(
  places: EnrichedPlace[],
  opts: VerifyOptions = {},
): Promise<VerifiedPlace[]> {
  const apiKey = process.env.OVERTURE_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[overture] OVERTURE_API_KEY not set — skipping verification");
    return places.map(fallback);
  }

  const byCity = new Map<CityKey, EnrichedPlace[]>();
  for (const p of places) {
    const list = byCity.get(p.cityKey) ?? [];
    list.push(p);
    byCity.set(p.cityKey, list);
  }

  const limit = pLimit(opts.concurrency ?? 3);
  const tasks: Promise<VerifiedPlace[]>[] = [];

  for (const [cityKey, cityPlaces] of byCity) {
    tasks.push(limit(() => verifyCity(apiKey, cityKey, cityPlaces)));
  }

  const results = await Promise.allSettled(tasks);
  const verified: VerifiedPlace[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") verified.push(...r.value);
    else console.warn("[overture] city batch failed:", r.reason);
  }
  return verified;
}

async function verifyCity(
  apiKey: string,
  cityKey: CityKey,
  places: EnrichedPlace[],
): Promise<VerifiedPlace[]> {
  const cityMeta = CITIES.find((c) => c.key === cityKey);
  if (!cityMeta) return places.map(fallback);

  let overturePlaces: OverturePlace[];
  try {
    overturePlaces = await fetchOvertureByGeo(
      apiKey,
      cityMeta.lat,
      cityMeta.lng,
      SEARCH_RADIUS_M,
      RESULTS_PER_CITY,
    );
    console.log(`[overture] ${cityKey}: fetched ${overturePlaces.length} places from API`);
  } catch (err) {
    console.warn(
      `[overture] fetch failed for ${cityKey}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return places.map(fallback);
  }

  const index = buildNameIndex(overturePlaces);

  let matched = 0;
  const results = places.map((p) => {
    const match = findMatch(p.name, index);
    if (!match) return fallback(p);

    matched++;
    const [lng, lat] = match.geometry.coordinates;
    const addr = match.properties.addresses?.[0];
    const overtureAddress = addr
      ? [addr.freeform, addr.locality, addr.region, addr.postcode].filter(Boolean).join(", ")
      : null;

    // Backfill phone and website from Overture if enrichment missed them
    const phone = p.phoneNumber ?? match.properties.phones?.[0] ?? null;
    const website = p.websiteUrl ?? match.properties.websites?.[0] ?? null;

    return {
      ...p,
      overtureId: match.id,
      lat,
      lng,
      verified: true,
      overtureAddress,
      phoneNumber: phone,
      websiteUrl: website,
    };
  });

  console.log(`[overture] ${cityKey}: matched ${matched}/${places.length} places`);
  return results;
}

async function fetchOvertureByGeo(
  apiKey: string,
  lat: number,
  lng: number,
  radius: number,
  limit: number,
): Promise<OverturePlace[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius),
    limit: String(limit),
    country: "US",
    format: "json",
  });

  const res = await fetch(`${OVERTURE_API}/places?${params}`, {
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Overture API ${res.status}: ${await res.text().catch(() => "")}`);
  }

  return (await res.json()) as OverturePlace[];
}

function buildNameIndex(places: OverturePlace[]): Map<string, OverturePlace> {
  const index = new Map<string, OverturePlace>();
  for (const p of places) {
    const name = p.properties.names?.primary;
    if (!name) continue;
    const key = normalize(name);
    if (!index.has(key)) index.set(key, p);
  }
  return index;
}

function findMatch(
  name: string,
  index: Map<string, OverturePlace>,
): OverturePlace | null {
  const norm = normalize(name);

  const exact = index.get(norm);
  if (exact) return exact;

  // Substring match — require the shorter string to be at least 4 chars
  // to avoid false positives on short names like "Bar" or "Cafe"
  if (norm.length >= 4) {
    for (const [key, place] of index) {
      if (key.length < 4) continue;
      if (key.includes(norm) || norm.includes(key)) return place;
    }
  }

  return null;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fallback(place: EnrichedPlace): VerifiedPlace {
  const hasEnrichedCoords =
    typeof place.latitude === "number" && typeof place.longitude === "number";

  return {
    ...place,
    overtureId: null,
    lat: hasEnrichedCoords ? place.latitude : null,
    lng: hasEnrichedCoords ? place.longitude : null,
    verified: false,
    overtureAddress: null,
  };
}
