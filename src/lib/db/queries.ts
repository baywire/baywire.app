import type { Prisma } from "@/prisma/client";
import type { CityKey } from "@/lib/cities";
import { type AppEvent, serializeEvent, serializeEvents } from "@/lib/events/types";
import { sourcePriorityRank } from "@/lib/sources/priority";
import { getWindow, type WindowKey } from "@/lib/time/window";

import { prisma } from "./client";
import { buildVisibleEventWhere } from "./eventWhere";

const READ_CACHE = { ttl: 60, swr: 300 };
type EventWithSourceSlug = Prisma.EventGetPayload<{
  include: { source: { select: { slug: true } } };
}>;

interface CanonicalWithEvents {
  id: string;
  dedupedTitle: string | null;
  summary: string | null;
  vibes: string[];
  audience: string | null;
  indoorOutdoor: string | null;
  tags: string[];
  whyItsCool: string | null;
  editorialScore: number | null;
  editorialUpdatedAt: Date | null;
  events: EventWithSourceSlug[];
}

type EventByIDRow = Prisma.EventGetPayload<{
  include: {
    source: {
      select: {
        enabled: true;
      };
    };
    canonical: {
      select: {
        id: true;
        dedupedTitle: true;
        summary: true;
        tags: true;
        vibes: true;
        audience: true;
        indoorOutdoor: true;
        whyItsCool: true;
        editorialScore: true;
        editorialUpdatedAt: true;
      };
    };
  };
}>;

export interface EventListFilters {
  window: WindowKey;
  cities?: CityKey[];
  freeOnly?: boolean;
  limit?: number;
}

const FRESH_EDITORIAL_WINDOW_HOURS = 48;

function withReadCache<T extends object>(args: T): T {
  return { ...args, cacheStrategy: READ_CACHE } as T;
}

export async function listEvents(filters: EventListFilters): Promise<AppEvent[]> {
  const window = getWindow(filters.window);
  const scopedWhere = buildVisibleEventWhere(window.startAt, window.endAt, filters);

  const canonicalRows = (await prisma.canonicalEvent.findMany(withReadCache({
    where: { events: { some: scopedWhere } },
    select: {
      id: true,
      dedupedTitle: true,
      summary: true,
      vibes: true,
      audience: true,
      indoorOutdoor: true,
      tags: true,
      whyItsCool: true,
      editorialScore: true,
      editorialUpdatedAt: true,
      events: {
        where: scopedWhere,
        include: { source: { select: { slug: true } } },
      },
    },
  }))) as CanonicalWithEvents[];

  const out: AppEvent[] = [];
  for (const row of canonicalRows) {
    const display = choosePrimaryEvent(row.events);
    if (!display) continue;
    out.push(applyCanonicalOverlay(serializeEvent(display), row, display.id, row.events));
  }

  const legacyRows = await prisma.event.findMany(withReadCache({
    where: { ...scopedWhere, canonicalId: null },
    orderBy: [{ startAt: "asc" as const }, { id: "asc" as const }],
  }));
  for (const row of legacyRows) {
    out.push({
      ...serializeEvent(row),
      canonicalEventID: null,
      editorialScore: null,
      editorialUpdatedAt: null,
      whyItsCool: null,
      vibes: [],
      audience: null,
      indoorOutdoor: null,
      alsoOnSources: [],
      duplicateCount: 1,
    });
  }

  out.sort((a, b) => compareEvents(a, b));
  return out.slice(0, filters.limit ?? 100);
}

export async function getEventById(id: string): Promise<AppEvent | null> {
  const row = (await prisma.event.findUnique(withReadCache({
    where: { id },
    include: {
      source: { select: { enabled: true } },
      canonical: {
        select: {
          id: true,
          dedupedTitle: true,
          summary: true,
          tags: true,
          vibes: true,
          audience: true,
          indoorOutdoor: true,
          whyItsCool: true,
          editorialScore: true,
          editorialUpdatedAt: true,
        },
      },
    },
  }))) as EventByIDRow | null;
  if (!row) return null;
  if (!row.source.enabled) return null;
  const serialized = serializeEvent(row);
  const canonical = row.canonical;
  if (!canonical) return serialized;
  return {
    ...serialized,
    title: canonical.dedupedTitle ?? serialized.title,
    description: canonical.summary ?? serialized.description,
    categories: canonical.tags.length > 0 ? canonical.tags : serialized.categories,
    canonicalEventID: canonical.id,
    editorialScore: canonical.editorialScore ?? null,
    editorialUpdatedAt: canonical.editorialUpdatedAt ?? null,
    whyItsCool: canonical.whyItsCool ?? null,
    vibes: canonical.vibes,
    audience: canonical.audience ?? null,
    indoorOutdoor: canonical.indoorOutdoor ?? null,
  };
}

export interface CityFacet {
  city: CityKey;
  count: number;
}

export interface CityFacetFilters {
  window: WindowKey;
  freeOnly?: boolean;
}

/**
 * Counts visible events per city for the facet pills. Each pill shows
 * "events I'd see if this city were selected", so the active `cities` filter
 * is intentionally NOT applied; `freeOnly` IS applied so the pills agree with
 * the rendered list.
 *
 * Counted by city of any visible event in a canonical group (one contribution
 * per group, deterministic on tied multi-city groups), so a disabled primary
 * never skews the facet. Legacy (un-canonicalized) events each contribute
 * once by their own city.
 */
export async function countEventsByCity(filters: CityFacetFilters): Promise<CityFacet[]> {
  const w = getWindow(filters.window);
  const visible: Prisma.EventWhereInput = {
    startAt: { gte: w.startAt, lte: w.endAt },
    source: { enabled: true },
    ...(filters.freeOnly ? { isFree: true } : {}),
  };

  const [canonicalPairs, legacyGroups] = await Promise.all([
    prisma.event.groupBy(withReadCache({
      by: ["canonicalId", "city"] as const,
      where: { ...visible, canonicalId: { not: null } },
      _count: { _all: true },
    })),
    prisma.event.groupBy(withReadCache({
      by: ["city"] as const,
      where: { ...visible, canonicalId: null },
      _count: { _all: true },
    })),
  ]);

  const cityByCanonical = new Map<string, string>();
  for (const row of canonicalPairs) {
    if (!row.canonicalId) continue;
    const existing = cityByCanonical.get(row.canonicalId);
    if (!existing || row.city < existing) cityByCanonical.set(row.canonicalId, row.city);
  }

  const counts = new Map<CityKey, number>();
  for (const city of cityByCanonical.values()) {
    const key = city as CityKey;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const row of legacyGroups) {
    const key = row.city as CityKey;
    counts.set(key, (counts.get(key) ?? 0) + row._count._all);
  }
  return Array.from(counts, ([city, count]) => ({ city, count }));
}

export async function totalEventsInWindow(window: WindowKey): Promise<number> {
  const w = getWindow(window);
  const visible: Prisma.EventWhereInput = {
    startAt: { gte: w.startAt, lte: w.endAt },
    source: { enabled: true },
  };

  const [canonicalCount, legacyCount] = await Promise.all([
    prisma.canonicalEvent.count(withReadCache({
      where: { events: { some: visible } },
    })),
    prisma.event.count(withReadCache({
      where: { ...visible, canonicalId: null },
    })),
  ]);
  return canonicalCount + legacyCount;
}

export interface CurationCoverage {
  visibleCount: number;
  curatedCount: number;
  coveragePct: number;
  refreshedAt: Date | null;
}

/**
 * Computes editorial coverage with four parallel aggregate queries instead of
 * loading every row in the window. `filters.limit` is intentionally ignored —
 * coverage is always computed against the full window.
 */
export async function getCurationCoverage(filters: EventListFilters): Promise<CurationCoverage> {
  const w = getWindow(filters.window);
  const visible = buildVisibleEventWhere(w.startAt, w.endAt, filters);
  const freshCutoff = new Date(Date.now() - FRESH_EDITORIAL_WINDOW_HOURS * 60 * 60 * 1000);

  const [canonicalCount, legacyCount, curatedCount, refreshed] = await Promise.all([
    prisma.canonicalEvent.count(withReadCache({
      where: { events: { some: visible } },
    })),
    prisma.event.count(withReadCache({
      where: { ...visible, canonicalId: null },
    })),
    prisma.canonicalEvent.count(withReadCache({
      where: {
        editorialScore: { not: null },
        editorialUpdatedAt: { gte: freshCutoff },
        events: { some: visible },
      },
    })),
    prisma.canonicalEvent.aggregate(withReadCache({
      _max: { editorialUpdatedAt: true },
      where: { events: { some: visible } },
    })),
  ]);

  const visibleCount = canonicalCount + legacyCount;
  const coveragePct = visibleCount === 0 ? 0 : Math.round((curatedCount / visibleCount) * 100);
  return {
    visibleCount,
    curatedCount,
    coveragePct,
    refreshedAt: refreshed._max.editorialUpdatedAt ?? null,
  };
}

export async function listUpcomingEventsByIds(ids: string[]): Promise<AppEvent[]> {
  if (ids.length === 0) return [];
  const now = new Date();
  const rows = await prisma.event.findMany(withReadCache({
    where: {
      id: { in: ids },
      startAt: { gte: now },
      source: { enabled: true },
    },
    orderBy: { startAt: "asc" as const },
  }));
  return serializeEvents(rows);
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
    const rankDiff = sourcePriorityRank(next.source.slug) - sourcePriorityRank(best.source.slug);
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
    vibes: string[];
    audience: string | null;
    indoorOutdoor: string | null;
    whyItsCool: string | null;
    tags: string[];
    editorialScore: number | null;
    editorialUpdatedAt: Date | null;
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
    editorialUpdatedAt: canonical.editorialUpdatedAt ?? null,
    whyItsCool: canonical.whyItsCool ?? null,
    vibes: canonical.vibes,
    audience: canonical.audience ?? null,
    indoorOutdoor: canonical.indoorOutdoor ?? null,
    alsoOnSources: Array.from(sources).sort((a, b) => a.localeCompare(b)),
    duplicateCount: groupedEvents.length,
  };
}

function compareEvents(a: AppEvent, b: AppEvent): number {
  const scoreA = effectiveEditorialScore(a);
  const scoreB = effectiveEditorialScore(b);
  if (scoreA !== scoreB) return scoreB - scoreA;
  const timeA = a.startAt.getTime();
  const timeB = b.startAt.getTime();
  if (timeA !== timeB) return timeA - timeB;
  return a.id.localeCompare(b.id);
}

function hasImage(imageUrl: string | null): boolean {
  return typeof imageUrl === "string" && imageUrl.trim().length > 0;
}

function effectiveEditorialScore(event: AppEvent): number {
  if (typeof event.editorialScore !== "number") return -1;
  let score = event.editorialScore;
  if (!isEditorialFresh(event.editorialUpdatedAt ?? null)) {
    score -= 0.2;
  }
  if (isLikelyLowConfidenceEditorial(event)) {
    score -= 0.1;
  }
  return score;
}

function isLikelyLowConfidenceEditorial(event: AppEvent): boolean {
  return (event.editorialScore ?? 0) <= 0.55 && !event.whyItsCool;
}

function isEditorialFresh(updatedAt: Date | null): boolean {
  if (!updatedAt) return false;
  const ageMs = Date.now() - updatedAt.getTime();
  return ageMs <= FRESH_EDITORIAL_WINDOW_HOURS * 60 * 60 * 1000;
}
