import { z } from "zod";

import { CITY_KEYS } from "@/lib/cities";

export const PLACE_CATEGORIES = [
  "restaurant",
  "brewery",
  "bar",
  "cafe",
  "bakery",
  "museum",
  "gallery",
  "park",
  "beach",
  "shop",
  "venue",
  "attraction",
  "other",
] as const;

export type PlaceCategoryValue = (typeof PLACE_CATEGORIES)[number];

export const PLACE_VIBES = [
  "dog_friendly",
  "outdoor_seating",
  "kid_friendly",
  "family",
  "late_night",
  "romantic",
  "hidden_gem",
  "waterfront",
  "live_music",
  "craft_beer",
  "brunch",
  "vegan_friendly",
  "pet_friendly",
  "scenic_views",
] as const;

export const ExtractedPlaceSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .describe("Name of the place (restaurant, bar, brewery, etc.)."),
  description: z
    .string()
    .max(2000)
    .nullable()
    .describe("Brief description of the place. Keep faithful source wording."),
  category: z
    .enum(PLACE_CATEGORIES)
    .describe("Primary category. Use 'other' only if none match."),
  city: z
    .enum(CITY_KEYS)
    .describe("Best-fit city among Tampa Bay area cities. Use 'other' only if none match."),
  address: z.string().max(300).nullable(),
  lat: z.number().nullable().describe("Latitude, or null if unknown."),
  lng: z.number().nullable().describe("Longitude, or null if unknown."),
  imageUrl: z
    .string()
    .nullable()
    .describe("Absolute http(s) URL of the main image, or null."),
  websiteUrl: z
    .string()
    .nullable()
    .describe("Official website URL of the place, or null."),
  phoneNumber: z.string().max(30).nullable(),
  priceRange: z
    .string()
    .max(4)
    .nullable()
    .describe("Price range: '$', '$$', '$$$', or '$$$$'. Null if unknown."),
  hoursJson: z
    .array(z.string())
    .nullable()
    .describe("Opening hours as strings, e.g. ['Mon-Fri 11am-10pm', 'Sat 10am-11pm']. Null if unknown."),
  vibes: z
    .array(z.string().max(30))
    .max(10)
    .describe(
      "Vibes / attributes from this set: dog_friendly, outdoor_seating, kid_friendly, family, late_night, romantic, hidden_gem, waterfront, live_music, craft_beer, brunch, vegan_friendly, pet_friendly, scenic_views. Lowercase, no duplicates.",
    ),
});

export type ExtractedPlace = z.infer<typeof ExtractedPlaceSchema>;

export const PlaceExtractionResultSchema = z.object({
  isPlace: z.boolean(),
  reason: z.string().nullable(),
  place: ExtractedPlaceSchema.nullable(),
});

export type PlaceExtractionResult = z.infer<typeof PlaceExtractionResultSchema>;
