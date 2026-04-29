import type { PlaceAdapter } from "./types";

import { thatsSoTampaPlacesAdapter } from "./thatsSoTampaPlaces";
import { iLoveTheBurgPlacesAdapter } from "./iLoveTheBurgPlaces";
import { visitTampaBayPlacesAdapter } from "./visitTampaBayPlaces";

export const PLACE_ADAPTERS: readonly PlaceAdapter[] = [
  thatsSoTampaPlacesAdapter,
  iLoveTheBurgPlacesAdapter,
  visitTampaBayPlacesAdapter,
] as const;

export function getPlaceAdapter(slug: string): PlaceAdapter | undefined {
  return PLACE_ADAPTERS.find((a) => a.slug === slug);
}

export type { PlaceAdapter, PlaceListingItem } from "./types";
