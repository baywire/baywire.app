import type { CityKey } from "@/lib/cities";
import type { PlaceCategoryValue } from "@/lib/extract/schemaPlace";
import { type AppPlace, serializePlace } from "@/lib/places/types";

import { prisma } from "./client";

const READ_CACHE = { ttl: 120, swr: 600 };

export interface PlaceListFilters {
  cities?: CityKey[];
  categories?: PlaceCategoryValue[];
  vibes?: string[];
  limit?: number;
}

function withReadCache<T extends object>(args: T): T {
  return { ...args, cacheStrategy: READ_CACHE } as T;
}

export async function listPlaces(filters: PlaceListFilters = {}): Promise<AppPlace[]> {
  const where: Record<string, unknown> = {};
  if (filters.cities?.length) where.city = { in: filters.cities };
  if (filters.categories?.length) where.category = { in: filters.categories };
  if (filters.vibes?.length) where.vibes = { hasSome: filters.vibes };

  const rows = await prisma.place.findMany(
    withReadCache({
      where,
      orderBy: [
        { editorialScore: { sort: "desc" as const, nulls: "last" as const } },
        { name: "asc" as const },
      ],
      take: filters.limit ?? 100,
    }),
  );

  return rows.map(serializePlace);
}

export async function countPlacesByCity(): Promise<{ city: string; count: number }[]> {
  const groups = await prisma.place.groupBy(
    withReadCache({
      by: ["city"] as const,
      _count: { _all: true },
    }),
  );
  return groups.map((g) => ({ city: g.city, count: g._count._all }));
}

export async function getPlaceBySlug(slug: string): Promise<AppPlace | null> {
  const row = await prisma.place.findUnique(
    withReadCache({ where: { slug } }),
  );
  return row ? serializePlace(row) : null;
}
