import type { City, Event } from "@/generated/prisma/client";

import type { CityKey } from "@/lib/cities";
import { getWindow, type WindowKey } from "@/lib/time/window";

import { prisma } from "./client";

const READ_CACHE = { ttl: 60, swr: 300 };

export interface EventListFilters {
  window: WindowKey;
  cities?: CityKey[];
  freeOnly?: boolean;
  limit?: number;
}

export async function listEvents(filters: EventListFilters): Promise<Event[]> {
  const window = getWindow(filters.window);
  return prisma.event.findMany({
    where: {
      startAt: { gte: window.startAt, lte: window.endAt },
      ...(filters.cities && filters.cities.length > 0
        ? { city: { in: filters.cities } }
        : {}),
      ...(filters.freeOnly ? { isFree: true } : {}),
    },
    orderBy: { startAt: "asc" },
    take: filters.limit ?? 200,
    cacheStrategy: READ_CACHE,
  });
}

export async function getEventById(id: string): Promise<Event | null> {
  return prisma.event.findUnique({
    where: { id },
    cacheStrategy: READ_CACHE,
  });
}

export interface CityFacet {
  city: CityKey;
  count: number;
}

export async function countEventsByCity(window: WindowKey): Promise<CityFacet[]> {
  const w = getWindow(window);
  // Accelerate's extended client narrows groupBy's inferred shape to `{}`,
  // so we project the row shape we actually asked for ourselves.
  const groups = (await prisma.event.groupBy({
    by: ["city"],
    where: { startAt: { gte: w.startAt, lte: w.endAt } },
    _count: { _all: true },
    cacheStrategy: READ_CACHE,
  })) as Array<{ city: City; _count: { _all: number } }>;
  return groups.map((g) => ({ city: g.city as CityKey, count: g._count._all }));
}

export async function totalEventsInWindow(window: WindowKey): Promise<number> {
  const w = getWindow(window);
  return prisma.event.count({
    where: { startAt: { gte: w.startAt, lte: w.endAt } },
    cacheStrategy: READ_CACHE,
  });
}
