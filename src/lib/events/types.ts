import type { Event } from "@/generated/prisma/client";

/**
 * Serializable variant of the Prisma `Event` row used across React Server
 * Components and Client Components.
 *
 * Prisma returns `Decimal` instances for `priceMin` / `priceMax`, but those
 * cannot be serialized across the RSC boundary. We convert them to plain
 * numbers up front so every consumer (server or client) sees the same shape.
 */
export type AppEvent = Omit<Event, "priceMin" | "priceMax"> & {
  priceMin: number | null;
  priceMax: number | null;
  canonicalEventID?: string | null;
  editorialScore?: number | null;
  editorialUpdatedAt?: Date | null;
  whyItsCool?: string | null;
  vibes?: string[];
  audience?: string | null;
  indoorOutdoor?: string | null;
  alsoOnSources?: string[];
  duplicateCount?: number;
};

/**
 * Convert a Prisma `Event` (with `Decimal` price fields) into a fully
 * JSON-serializable `AppEvent`. Other scalar types (`Date`, `string`, etc.)
 * already cross the RSC boundary cleanly and are passed through.
 */
export function serializeEvent(event: Event): AppEvent {
  return {
    ...event,
    priceMin: decimalToNumber(event.priceMin),
    priceMax: decimalToNumber(event.priceMax),
  };
}

export function serializeEvents(events: Event[]): AppEvent[] {
  const out = new Array<AppEvent>(events.length);
  for (let i = 0; i < events.length; i++) out[i] = serializeEvent(events[i]);
  return out;
}

function decimalToNumber(value: Event["priceMin"]): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}
