import type { Prisma } from "@/generated/prisma/client";
import { prisma, type AppPrismaClient } from "@/lib/db/client";
import { sourcePriorityRank } from "@/lib/sources/priority";

import { refreshEditorialForCanonicalPlace } from "./editorialPlace";

type CanonicalPlaceTx = Pick<AppPrismaClient, "place" | "canonicalPlace">;

type PlaceWithSource = Prisma.PlaceGetPayload<{
  include: { source: { select: { slug: true; enabled: true } } };
}>;

export async function resolveCanonicalPlaceForPlace(placeID: string): Promise<string | null> {
  const result = await prisma.$transaction(async (tx) => {
    return resolveCanonicalPlaceForPlaceTx(tx as unknown as CanonicalPlaceTx, placeID);
  });
  if (result?.editorial) {
    await refreshEditorialForCanonicalPlace(
      prisma,
      result.editorial.canonicalID,
      result.editorial.places,
      result.editorial.primary,
    );
  }
  return result?.canonicalID ?? null;
}

async function resolveCanonicalPlaceForPlaceTx(
  tx: CanonicalPlaceTx,
  placeID: string,
): Promise<{
  canonicalID: string;
  editorial: {
    canonicalID: string;
    places: PlaceWithSource[];
    primary: PlaceWithSource;
  } | null;
} | null> {
  const place = await tx.place.findUnique({
    where: { id: placeID },
    include: { source: { select: { slug: true, enabled: true } } },
  });
  if (!place) return null;
  if (!place.source.enabled) return null;

  const candidates = await findCandidatePlaces(tx, place);
  const matched = candidates.filter((c) => isLikelySamePlace(place, c));
  const matchedIDs = new Set<string>([place.id]);
  const canonicalIDs = new Set<string>();
  if (place.canonicalId) canonicalIDs.add(place.canonicalId);

  for (const item of matched) {
    matchedIDs.add(item.id);
    if (item.canonicalId) canonicalIDs.add(item.canonicalId);
  }

  let targetCanonicalID: string;
  const sorted = Array.from(canonicalIDs).sort((a, b) => a.localeCompare(b));
  if (sorted.length > 0) {
    targetCanonicalID = sorted[0];
  } else {
    const created = await tx.canonicalPlace.create({ data: {} });
    targetCanonicalID = created.id;
  }

  await tx.place.updateMany({
    where: { id: { in: Array.from(matchedIDs) } },
    data: { canonicalId: targetCanonicalID },
  });

  const mergedIDs = sorted.filter((id) => id !== targetCanonicalID);
  if (mergedIDs.length > 0) {
    await tx.place.updateMany({
      where: { canonicalId: { in: mergedIDs } },
      data: { canonicalId: targetCanonicalID },
    });
    await tx.canonicalPlace.deleteMany({ where: { id: { in: mergedIDs } } });
  }

  const editorial = await recomputePrimaryTx(tx, targetCanonicalID);
  return { canonicalID: targetCanonicalID, editorial };
}

async function findCandidatePlaces(
  tx: CanonicalPlaceTx,
  place: PlaceWithSource,
): Promise<PlaceWithSource[]> {
  const rows = await tx.place.findMany({
    where: {
      id: { not: place.id },
      city: place.city,
      category: place.category,
    },
    include: { source: { select: { slug: true, enabled: true } } },
    take: 500,
  });
  return rows as unknown as PlaceWithSource[];
}

function isLikelySamePlace(a: PlaceWithSource, b: PlaceWithSource): boolean {
  const normA = normalizeName(a.name);
  const normB = normalizeName(b.name);
  if (normA === normB) return true;
  if (normA.length >= 5 && normB.length >= 5) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }
  if (a.address && b.address && normalizeAddr(a.address) === normalizeAddr(b.address)) {
    return true;
  }
  return false;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\bthe\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function normalizeAddr(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function recomputePrimaryTx(
  tx: CanonicalPlaceTx,
  canonicalID: string,
): Promise<{
  canonicalID: string;
  places: PlaceWithSource[];
  primary: PlaceWithSource;
} | null> {
  const places = await tx.place.findMany({
    where: { canonicalId: canonicalID, source: { enabled: true } },
    include: { source: { select: { slug: true, enabled: true } } },
  });
  if (places.length === 0) {
    await tx.canonicalPlace.delete({ where: { id: canonicalID } });
    return null;
  }
  const primary = choosePrimary(places);
  await tx.canonicalPlace.upsert({
    where: { id: canonicalID },
    create: { id: canonicalID, primaryPlaceId: primary.id },
    update: { primaryPlaceId: primary.id },
  });
  return { canonicalID, places, primary };
}

function choosePrimary(places: PlaceWithSource[]): PlaceWithSource {
  let best = places[0];
  for (let i = 1; i < places.length; i++) {
    const next = places[i];
    if (comparePrimary(next, best) < 0) best = next;
  }
  return best;
}

function comparePrimary(a: PlaceWithSource, b: PlaceWithSource): number {
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
