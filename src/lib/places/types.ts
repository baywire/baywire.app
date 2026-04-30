import type { Place } from "@/prisma/client";

import type { CityKey } from "@/lib/cities";

export type { PlaceCategoryValue } from "@/lib/extract/schemaPlace";

export interface AppPlace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  city: CityKey;
  address: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  websiteUrl: string | null;
  phoneNumber: string | null;
  priceRange: string | null;
  hoursJson: unknown;
  sourceUrl: string;
  searchType: string | null;
  verified: boolean;
  webRating: number | null;
  webReviewCount: number | null;
  summary: string | null;
  vibes: string[];
  tags: string[];
  whyItsCool: string | null;
  editorialScore: number | null;
}

export function serializePlace(place: Place): AppPlace {
  return {
    id: place.id,
    name: place.name,
    slug: place.slug,
    description: place.description,
    category: place.category,
    city: place.city as CityKey,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    imageUrl: place.imageUrl,
    websiteUrl: place.websiteUrl,
    phoneNumber: place.phoneNumber,
    priceRange: place.priceRange,
    hoursJson: place.hoursJson,
    sourceUrl: place.sourceUrl,
    searchType: place.searchType,
    verified: place.verified,
    webRating: place.webRating,
    webReviewCount: place.webReviewCount,
    summary: place.summary,
    vibes: place.vibes,
    tags: place.tags,
    whyItsCool: place.whyItsCool,
    editorialScore: place.editorialScore,
  };
}

export function serializePlaces(places: Place[]): AppPlace[] {
  return places.map(serializePlace);
}
