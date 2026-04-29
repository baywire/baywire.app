import type { Prisma } from "@/generated/prisma/client";
import type { CityKey } from "@/lib/cities";
import type { PlaceCategoryValue } from "@/lib/extract/schemaPlace";
import { type AppPlace, serializePlace } from "@/lib/places/types";
import { sourcePriorityRank } from "@/lib/sources/priority";

import { prisma } from "./client";

const READ_CACHE = { ttl: 120, swr: 600 };

type PlaceWithSourceSlug = Prisma.PlaceGetPayload<{
  include: { source: { select: { slug: true } } };
}>;

interface CanonicalWithPlaces {
  id: string;
  dedupedName: string | null;
  summary: string | null;
  vibes: string[];
  tags: string[];
  whyItsCool: string | null;
  editorialScore: number | null;
  editorialUpdatedAt: Date | null;
  places: PlaceWithSourceSlug[];
}

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
  const where = buildPlaceWhere(filters);

  const canonicalRows = (await prisma.canonicalPlace.findMany(
    withReadCache({
      where: { places: { some: where } },
      select: {
        id: true,
        dedupedName: true,
        summary: true,
        vibes: true,
        tags: true,
        whyItsCool: true,
        editorialScore: true,
        editorialUpdatedAt: true,
        places: {
          where,
          include: { source: { select: { slug: true } } },
        },
      },
    }),
  )) as CanonicalWithPlaces[];

  const out: AppPlace[] = [];
  for (const row of canonicalRows) {
    const primary = choosePrimaryPlace(row.places);
    if (!primary) continue;
    out.push(applyCanonicalOverlay(serializePlace(primary), row, primary.id, row.places));
  }

  const legacyRows = await prisma.place.findMany(
    withReadCache({
      where: { ...where, canonicalId: null },
      orderBy: [{ name: "asc" as const }, { id: "asc" as const }],
    }),
  );
  for (const row of legacyRows) {
    out.push({
      ...serializePlace(row),
      canonicalPlaceID: null,
      editorialScore: null,
      editorialUpdatedAt: null,
      whyItsCool: null,
      vibes: [],
      tags: [row.category],
      alsoOnSources: [],
      duplicateCount: 1,
    });
  }

  out.sort((a, b) => comparePlaces(a, b));

  if (filters.vibes?.length) {
    const vibeSet = new Set(filters.vibes);
    const filtered = out.filter((p) => p.vibes.some((v) => vibeSet.has(v)));
    return filtered.slice(0, filters.limit ?? 100);
  }

  return out.slice(0, filters.limit ?? 100);
}

export async function getPlaceBySlug(slug: string): Promise<AppPlace | null> {
  const row = await prisma.place.findFirst(
    withReadCache({
      where: { slug },
      include: {
        source: { select: { enabled: true } },
        canonical: {
          select: {
            id: true,
            dedupedName: true,
            summary: true,
            tags: true,
            vibes: true,
            whyItsCool: true,
            editorialScore: true,
            editorialUpdatedAt: true,
          },
        },
      },
    }),
  );
  if (!row) return null;

  const base = serializePlace(row);
  if (!row.canonical) {
    return {
      ...base,
      canonicalPlaceID: null,
      editorialScore: null,
      editorialUpdatedAt: null,
      whyItsCool: null,
      vibes: [],
      tags: [row.category],
      alsoOnSources: [],
      duplicateCount: 1,
    };
  }

  const canonical = row.canonical;
  const siblings = await prisma.place.findMany(
    withReadCache({
      where: { canonicalId: canonical.id },
      include: { source: { select: { slug: true } } },
    }),
  );

  return applyCanonicalOverlay(base, canonical as CanonicalWithPlaces, row.id, siblings);
}

function buildPlaceWhere(filters: PlaceListFilters): Prisma.PlaceWhereInput {
  const where: Prisma.PlaceWhereInput = {};
  if (filters.cities?.length) where.city = { in: filters.cities };
  if (filters.categories?.length) where.category = { in: filters.categories };
  return where;
}

function choosePrimaryPlace(places: PlaceWithSourceSlug[]): PlaceWithSourceSlug | null {
  if (places.length === 0) return null;
  let best = places[0];
  for (let i = 1; i < places.length; i++) {
    const next = places[i];
    if (comparePrimary(next, best) < 0) best = next;
  }
  return best;
}

function comparePrimary(a: PlaceWithSourceSlug, b: PlaceWithSourceSlug): number {
  const imgA = Boolean(a.imageUrl);
  const imgB = Boolean(b.imageUrl);
  if (imgA !== imgB) return imgA ? -1 : 1;
  const descA = Boolean(a.description);
  const descB = Boolean(b.description);
  if (descA !== descB) return descA ? -1 : 1;
  const rankA = sourcePriorityRank(a.source.slug);
  const rankB = sourcePriorityRank(b.source.slug);
  if (rankA !== rankB) return rankA - rankB;
  return a.id.localeCompare(b.id);
}

function applyCanonicalOverlay(
  base: AppPlace,
  canonical: CanonicalWithPlaces,
  displayID: string,
  siblings: PlaceWithSourceSlug[],
): AppPlace {
  return {
    ...base,
    canonicalPlaceID: canonical.id,
    editorialScore: canonical.editorialScore,
    editorialUpdatedAt: canonical.editorialUpdatedAt,
    dedupedName: canonical.dedupedName,
    summary: canonical.summary,
    whyItsCool: canonical.whyItsCool,
    vibes: canonical.vibes,
    tags: canonical.tags,
    alsoOnSources: siblings
      .filter((s) => s.id !== displayID)
      .map((s) => s.source.slug),
    duplicateCount: siblings.length,
  };
}

function comparePlaces(a: AppPlace, b: AppPlace): number {
  const scoreA = a.editorialScore ?? 0;
  const scoreB = b.editorialScore ?? 0;
  if (scoreA !== scoreB) return scoreB - scoreA;
  return a.name.localeCompare(b.name);
}
