import { z } from "zod";

import { CITY_KEYS } from "@/lib/cities";

/**
 * Schema for an event extracted by the LLM from a single event detail page.
 *
 * The LLM is instructed to return one ISO-8601 string in `America/New_York`
 * local time (no offset). The pipeline then converts to UTC for storage.
 */
export const ExtractedEventSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(300)
    .describe("Short, human-friendly title of the event."),
  description: z
    .string()
    .max(2000)
    .nullable()
    .describe("1-3 sentence summary, plain text. null if not present."),
  startLocal: z
    .string()
    .describe(
      "Local start as ISO 8601 in America/New_York with no offset, e.g. 2026-05-02T19:30:00. Use 00:00 for all-day events.",
    ),
  endLocal: z
    .string()
    .nullable()
    .describe(
      "Local end as ISO 8601 in America/New_York with no offset, or null if unknown.",
    ),
  allDay: z.boolean().describe("True if the event is all day."),
  venueName: z.string().max(200).nullable(),
  address: z.string().max(300).nullable(),
  city: z
    .enum(CITY_KEYS)
    .describe(
      "Best-fit city among Tampa Bay area cities. Use 'other' only if none match.",
    ),
  priceMin: z
    .number()
    .nullable()
    .describe("Lower bound of ticket price in USD, or null if unknown."),
  priceMax: z.number().nullable(),
  isFree: z.boolean().describe("True only if the page explicitly says free."),
  categories: z
    .array(z.string().max(40))
    .max(6)
    .describe(
      "Up to 6 short tags such as 'music', 'family', 'outdoors', 'food', 'art', 'nightlife'. Lowercase, no duplicates.",
    ),
  imageUrl: z
    .string()
    .url()
    .nullable()
    .describe("Absolute URL of the hero image, or null."),
});

export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;

/**
 * Wrapper schema. We require the LLM to either return an event or explicitly
 * mark the page as not an event so we can drop it without parsing failures.
 */
export const ExtractionResultSchema = z.object({
  isEvent: z.boolean(),
  reason: z.string().nullable(),
  event: ExtractedEventSchema.nullable(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
