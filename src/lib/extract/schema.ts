import { z } from "zod";

import { CITY_KEYS } from "@/lib/cities";

export const TICKET_STATUSES = [
  "on_sale",
  "sold_out",
  "not_yet",
  "cancelled",
  "free",
  "rsvp",
  "unknown",
] as const;

export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

const PriceTierSchema = z.object({
  name: z.string().max(80).describe("Tier name, e.g. 'General Admission', 'VIP'."),
  min: z.number().nullable().describe("Minimum price for this tier in the given currency."),
  max: z.number().nullable().describe("Maximum price for this tier."),
  currency: z.string().max(3).nullable().describe("ISO 4217 currency code, e.g. 'USD'."),
});

export type PriceTier = z.infer<typeof PriceTierSchema>;

const OfferSchema = z.object({
  ticketUrl: z
    .string()
    .nullable()
    .describe(
      "Absolute URL where tickets can be purchased or RSVP can be completed. " +
      "This is the buy/RSVP link, NOT the event info page itself.",
    ),
  status: z
    .enum(TICKET_STATUSES)
    .nullable()
    .describe("Ticket availability status. Use 'on_sale' if tickets are available, 'sold_out' if sold out, 'not_yet' if announced but not on sale, 'free' if free admission, 'rsvp' if RSVP-only. Null if unknown."),
  currency: z
    .string()
    .max(3)
    .nullable()
    .describe("ISO 4217 currency code for prices, e.g. 'USD'. Null if unknown."),
  onSaleLocal: z
    .string()
    .nullable()
    .describe("When tickets go on sale, as ISO 8601 local time (America/New_York, no offset). Null if unknown or already on sale."),
  validFromLocal: z
    .string()
    .nullable()
    .describe("Earliest date tickets are valid for entry, as ISO 8601 local time. Null if same as event start or unknown."),
  tiers: z
    .array(PriceTierSchema)
    .max(8)
    .nullable()
    .describe("Per-tier price breakdown when multiple tiers exist (GA, VIP, etc.). Null if only a single price range."),
});

export type ExtractedOffer = z.infer<typeof OfferSchema>;

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
    .describe("Raw plain-text event description from the page. Keep sentence boundaries; null if absent."),
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
    .nullable()
    .describe(
      "Absolute http(s) URL of the hero image, or null. Do not include relative paths or data URIs.",
    ),
  offer: OfferSchema.nullable().describe(
    "Ticket/RSVP offer details. Null if no ticket information is found on the page.",
  ),
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
