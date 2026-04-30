import type { City, Prisma } from "@/prisma/client";

import type { CityKey } from "@/lib/cities";

export interface EventListFilterInput {
  cities?: CityKey[];
  freeOnly?: boolean;
}

export function buildVisibleEventWhere(
  startAt: Date,
  endAt: Date,
  filters: EventListFilterInput,
): Prisma.EventWhereInput {
  return {
    startAt: { gte: startAt, lte: endAt },
    source: { enabled: true },
    ...(filters.cities && filters.cities.length > 0
      ? { city: { in: filters.cities as unknown as City[] } }
      : {}),
    ...(filters.freeOnly ? { isFree: true } : {}),
  };
}
