import type { Place } from "@/generated/prisma/client";

export type { PlaceCategoryValue } from "@/lib/extract/schemaPlace";

export interface AppPlace extends Omit<Place, never> {
  canonicalPlaceID?: string | null;
  editorialScore?: number | null;
  editorialUpdatedAt?: Date | null;
  dedupedName?: string | null;
  summary?: string | null;
  whyItsCool?: string | null;
  vibes: string[];
  tags: string[];
  alsoOnSources?: string[];
  duplicateCount?: number;
}

export function serializePlace(place: Place): AppPlace {
  return { ...place, vibes: [], tags: [] };
}

export function serializePlaces(places: Place[]): AppPlace[] {
  return places.map(serializePlace);
}
