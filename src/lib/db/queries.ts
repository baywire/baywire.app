import type { Prisma } from "@/generated/prisma/client";
import type { CityKey } from "@/lib/cities";
import { type AppEvent, serializeEvent, serializeEvents } from "@/lib/events/types";
import { getWindow, type WindowKey } from "@/lib/time/window";

import { prisma } from "./client";

const READ_CACHE = { ttl: 60, swr: 300 };
const SOURCE_PRIORITY = [
  "eventbrite",
  "visit_tampa_bay",
  "visit_st_pete_clearwater",
  "tampa_gov",
  "ilovetheburg",
  "thats_so_tampa",
  "tampa_bay_times",
  "tampa_bay_markets",
  "safety_harbor",
  "ticketmaster",
] as const;
const SOURCE_RANK = new Map<string, number>(SOURCE_PRIORITY.map((slug, idx) => [slug, idx]));
type EventWithSourceSlug = Prisma.EventGetPayload<{
  include: { source: { select: { slug: true } } };
}>;

type CanonicalWithEvents = Prisma.CanonicalEventGetPayload<{
  include: {
    events: {
      include: { source: { select: { slug: true } } };
    };
  };
}>;

export interface EventListFilters {
  window: WindowKey;
  cities?: CityKey[];
  freeOnly?: boolean;
  limit?: number;
}

export async function listEvents(filters: EventListFilters): Promise<AppEvent[]> {
  const window = getWindow(filters.window);
  const scopedWhere = buildEventWhere(window.startAt, window.endAt, filters);

  const canonicalRows: CanonicalWithEvents[] = await prisma.canonicalEvent.findMany({
    where: { events: { some: scopedWhere } },
    include: {
      events: {
        where: scopedWhere,
        include: { source: { select: { slug: true } } },
      },
    },
    cacheStrategy: READ_CACHE,
  });

  const out: AppEvent[] = [];
  for (const row of canonicalRows) {
    const display = choosePrimaryEvent(row.events);
    if (!display) continue;
    out.push(applyCanonicalOverlay(serializeEvent(display), row, display.id, row.events));
  }

  const legacyRows = await prisma.event.findMany({
    where: { ...scopedWhere, canonicalId: null },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    cacheStrategy: READ_CACHE,
  });
  for (const row of legacyRows) {
    out.push({
      ...serializeEvent(row),
      canonicalEventID: null,
      editorialScore: null,
      alsoOnSources: [],
      duplicateCount: 1,
    });
  }

  out.sort((a, b) => compareEvents(a, b));
  return out.slice(0, filters.limit ?? 200);
}

export async function getEventById(id: string): Promise<AppEvent | null> {
  const row = await prisma.event.findUnique({
    where: { id },
    include: {
      canonical: {
        select: {
          id: true,
          dedupedTitle: true,
          summary: true,
          tags: true,
          editorialScore: true,
        },
      },
    },
    cacheStrategy: READ_CACHE,
  });
  if (!row) return null;
  const serialized = serializeEvent(row);
  if (!row.canonical) return serialized;
  return {
    ...serialized,
    title: row.canonical.dedupedTitle ?? serialized.title,
    description: row.canonical.summary ?? serialized.description,
    categories: row.canonical.tags.length > 0 ? row.canonical.tags : serialized.categories,
    canonicalEventID: row.canonical.id,
    editorialScore: row.canonical.editorialScore ?? null,
  };
}

export interface CityFacet {
  city: CityKey;
  count: number;
}

export async function countEventsByCity(window: WindowKey): Promise<CityFacet[]> {
  const rows = await listEvents({ window, limit: 10000 });
  const map = new Map<CityKey, number>();
  for (const row of rows) {
    map.set(row.city as CityKey, (map.get(row.city as CityKey) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([city, count]) => ({ city, count }));
}

export async function totalEventsInWindow(window: WindowKey): Promise<number> {
  const rows = await listEvents({ window, limit: 10000 });
  return rows.length;
}

export async function listUpcomingEventsByIds(ids: string[]): Promise<AppEvent[]> {
  if (ids.length === 0) return [];
  const now = new Date();
  const rows = await prisma.event.findMany({
    where: { id: { in: ids }, startAt: { gte: now } },
    orderBy: { startAt: "asc" },
    cacheStrategy: READ_CACHE,
  });
  return serializeEvents(rows);
}

function buildEventWhere(
  startAt: Date,
  endAt: Date,
  filters: EventListFilters,
): Prisma.EventWhereInput {
  return {
    startAt: { gte: startAt, lte: endAt },
    ...(filters.cities && filters.cities.length > 0
      ? { city: { in: filters.cities } }
      : {}),
    ...(filters.freeOnly ? { isFree: true } : {}),
  };
}

function sourceRank(slug: string): number {
  return SOURCE_RANK.get(slug) ?? SOURCE_PRIORITY.length + 100;
}

function choosePrimaryEvent(
  events: EventWithSourceSlug[],
) {
  if (events.length === 0) return null;
  let best = events[0];
  for (let idx = 1; idx < events.length; idx += 1) {
    const next = events[idx];
    const nextHasImage = hasImage(next.imageUrl);
    const bestHasImage = hasImage(best.imageUrl);
    if (nextHasImage !== bestHasImage) {
      if (nextHasImage) best = next;
      continue;
    }
    const rankDiff = sourceRank(next.source.slug) - sourceRank(best.source.slug);
    if (rankDiff < 0) {
      best = next;
      continue;
    }
    if (rankDiff > 0) continue;
    if (next.startAt.getTime() < best.startAt.getTime()) {
      best = next;
      continue;
    }
    if (
      next.startAt.getTime() === best.startAt.getTime() &&
      next.id.localeCompare(best.id) < 0
    ) {
      best = next;
    }
  }
  return best;
}

function applyCanonicalOverlay(
  event: AppEvent,
  canonical: {
    id: string;
    dedupedTitle: string | null;
    summary: string | null;
    tags: string[];
    editorialScore: number | null;
  },
  displayEventID: string,
  groupedEvents: Array<{ id: string; source: { slug: string } }>,
): AppEvent {
  const sources = new Set<string>();
  for (const item of groupedEvents) {
    if (item.id === displayEventID) continue;
    sources.add(item.source.slug);
  }
  return {
    ...event,
    title: canonical.dedupedTitle ?? event.title,
    description: canonical.summary ?? event.description,
    categories: canonical.tags.length > 0 ? canonical.tags : event.categories,
    canonicalEventID: canonical.id,
    editorialScore: canonical.editorialScore ?? null,
    alsoOnSources: Array.from(sources).sort((a, b) => a.localeCompare(b)),
    duplicateCount: groupedEvents.length,
  };
}

function compareEvents(a: AppEvent, b: AppEvent): number {
  const scoreA = a.editorialScore ?? -1;
  const scoreB = b.editorialScore ?? -1;
  if (scoreA !== scoreB) return scoreB - scoreA;
  const timeA = a.startAt.getTime();
  const timeB = b.startAt.getTime();
  if (timeA !== timeB) return timeA - timeB;
  return a.id.localeCompare(b.id);
}

function hasImage(imageUrl: string | null): boolean {
  return typeof imageUrl === "string" && imageUrl.trim().length > 0;
}
