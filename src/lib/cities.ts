/**
 * Cities covered by the aggregator. The "city" enum is shared between the DB
 * schema, the LLM extraction schema, and the UI filter so changes propagate
 * automatically.
 */
export const CITY_KEYS = [
  "tampa",
  "st_petersburg",
  "clearwater",
  "brandon",
  "bradenton",
  "safety_harbor",
  "dunedin",
  "other",
] as const;

export type CityKey = (typeof CITY_KEYS)[number];

export interface CityMeta {
  key: CityKey;
  label: string;
  /** Approximate center used by geo-aware adapters such as Eventbrite. */
  lat: number;
  lng: number;
  /** Eventbrite "place" slug. */
  eventbriteSlug: string;
}

export const CITIES: readonly CityMeta[] = [
  {
    key: "tampa",
    label: "Tampa",
    lat: 27.9506,
    lng: -82.4572,
    eventbriteSlug: "fl--tampa",
  },
  {
    key: "st_petersburg",
    label: "St. Petersburg",
    lat: 27.7676,
    lng: -82.6403,
    eventbriteSlug: "fl--saint-petersburg",
  },
  {
    key: "clearwater",
    label: "Clearwater",
    lat: 27.9659,
    lng: -82.8001,
    eventbriteSlug: "fl--clearwater",
  },
  {
    key: "brandon",
    label: "Brandon",
    lat: 27.9378,
    lng: -82.2859,
    eventbriteSlug: "fl--brandon",
  },
  {
    key: "bradenton",
    label: "Bradenton",
    lat: 27.4989,
    lng: -82.5748,
    eventbriteSlug: "fl--bradenton",
  },
  {
    key: "safety_harbor",
    label: "Safety Harbor",
    lat: 28.0108,
    lng: -82.6929,
    eventbriteSlug: "fl--safety-harbor",
  },
  {
    key: "dunedin",
    label: "Dunedin",
    lat: 28.0197,
    lng: -82.7720,
    eventbriteSlug: "fl--dunedin",
  },
] as const;

const CITY_LABEL_MAP: Record<CityKey, string> = {
  tampa: "Tampa",
  st_petersburg: "St. Petersburg",
  clearwater: "Clearwater",
  brandon: "Brandon",
  bradenton: "Bradenton",
  safety_harbor: "Safety Harbor",
  dunedin: "Dunedin",
  other: "Other",
};

export function cityLabel(key: CityKey): string {
  return CITY_LABEL_MAP[key];
}

export function isCityKey(value: string): value is CityKey {
  return (CITY_KEYS as readonly string[]).includes(value);
}

/**
 * Returns the nearest CityKey for a given lat/lng based on Haversine distance.
 * Returns null if coords are missing/invalid.
 */
export function nearestCity(lat: number | null, lng: number | null): CityKey | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let best: CityKey = "other";
  let bestDist = Infinity;

  for (const city of CITIES) {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    if (d < bestDist) {
      bestDist = d;
      best = city.key;
    }
  }

  return best;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
