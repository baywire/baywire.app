import type { ExtractedPlace } from "@/lib/extract/schemaPlace";

export interface PlaceListingItem {
  sourcePlaceId: string;
  url: string;
  hint?: string;
}

export interface StructuredPlace {
  place: ExtractedPlace;
  canonicalUrl?: string;
  contentHash?: string;
}

export interface PlaceAdapter {
  slug: string;
  label: string;
  baseUrl: string;
  listPlaces(args: { signal?: AbortSignal }): Promise<PlaceListingItem[]>;
  tryStructured?(
    item: PlaceListingItem,
    signal?: AbortSignal,
  ): Promise<StructuredPlace | null>;
  fetchAndReduce(
    item: PlaceListingItem,
    signal?: AbortSignal,
  ): Promise<{ reducedHtml: string; canonicalUrl: string }>;
}
