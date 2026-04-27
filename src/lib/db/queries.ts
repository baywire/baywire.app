import type { Prisma } from "@/generated/prisma/client";
import type { CityKey } from "@/lib/cities";
import { type AppEvent, serializeEvent, serializeEvents } from "@/lib/events/types";
import { getWindow, type WindowKey } from "@/lib/time/window";

import { prisma } from "./client";
import { buildVisibleEventWhere } from "./eventWhere";

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
  return out.slice(0, filters.limit ?? 200);
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

export interface CurationCoverage {
  visibleCount: number;
  curatedCount: number;
  coveragePct: number;
  refreshedAt: Date | null;
}

export async function getCurationCoverage(filters: EventListFilters): Promise<CurationCoverage> {
  const rows = await listEvents({ ...filters, limit: 10000 });
  let curatedCount = 0;
  let refreshedAt: Date | null = null;
  for (const row of rows) {
    const updatedAt = row.editorialUpdatedAt ?? null;
    if (updatedAt && (!refreshedAt || updatedAt.getTime() > refreshedAt.getTime())) {
      refreshedAt = updatedAt;
    }
    if (isEditorialFresh(updatedAt) && typeof row.editorialScore === "number") {
      curatedCount += 1;
    }
  }
  const visibleCount = rows.length;
  const coveragePct = visibleCount === 0 ? 0 : Math.round((curatedCount / visibleCount) * 100);
  return { visibleCount, curatedCount, coveragePct, refreshedAt };
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
