import type { Prisma } from "@/generated/prisma/client";
import { prisma, type AppPrismaClient } from "@/lib/db/client";
import { sourcePriorityRank } from "@/lib/sources/priority";

import { refreshEditorialForCanonical } from "./editorial";
import { isLikelySameEvent } from "./canonicalMatch";
import { buildCandidateEventWhere } from "./canonicalWhere";

type CanonicalTx = Pick<AppPrismaClient, "event" | "canonicalEvent">;

type EventWithSource = Prisma.EventGetPayload<{
  include: { source: { select: { slug: true; enabled: true } } };
}>;

export async function resolveCanonicalEventForEvent(eventID: string): Promise<string | null> {
  const result = await prisma.$transaction(async (tx) => {
    return resolveCanonicalEventForEventTx(tx as unknown as CanonicalTx, eventID);
  });
  if (result?.editorial) {
    await refreshEditorialForCanonical(prisma, result.editorial.canonicalID, result.editorial.events, result.editorial.primary);
  }
  return result?.canonicalID ?? null;
}

export async function resolveCanonicalEventForEventTx(
  tx: CanonicalTx,
  eventID: string,
): Promise<{
  canonicalID: string;
  editorial: { canonicalID: string; events: EventWithSource[]; primary: EventWithSource } | null;
} | null> {
  const event = await tx.event.findUnique({
    where: { id: eventID },
    include: { source: { select: { slug: true, enabled: true } } },
  });
  if (!event) return null;
  if (!event.source.enabled) return null;

  const candidates = await findCandidateEvents(tx, event);
  const matched = candidates.filter((candidate) => isLikelySameEvent(event, candidate));
  const matchedIDs = new Set<string>([event.id]);
  const canonicalIDs = new Set<string>();
  if (event.canonicalId) canonicalIDs.add(event.canonicalId);

  for (const item of matched) {
    matchedIDs.add(item.id);
    if (item.canonicalId) canonicalIDs.add(item.canonicalId);
  }

  let targetCanonicalID: string;
  const sortedCanonicalIDs = Array.from(canonicalIDs).sort((a, b) => a.localeCompare(b));
  if (sortedCanonicalIDs.length > 0) {
    targetCanonicalID = sortedCanonicalIDs[0];
  } else {
    const created = await tx.canonicalEvent.create({ data: {} });
    targetCanonicalID = created.id;
  }

  const allMatchIDs = Array.from(matchedIDs);
  await tx.event.updateMany({
    where: { id: { in: allMatchIDs } },
    data: { canonicalId: targetCanonicalID },
  });

  const mergedCanonicalIDs = sortedCanonicalIDs.filter((id) => id !== targetCanonicalID);
  if (mergedCanonicalIDs.length > 0) {
    await tx.event.updateMany({
      where: { canonicalId: { in: mergedCanonicalIDs } },
      data: { canonicalId: targetCanonicalID },
    });
    await tx.canonicalEvent.deleteMany({
      where: { id: { in: mergedCanonicalIDs } },
    });
  }

  const editorial = await recomputeCanonicalPrimaryTx(tx, targetCanonicalID);
  return { canonicalID: targetCanonicalID, editorial };
}

async function findCandidateEvents(
  tx: CanonicalTx,
  event: EventWithSource,
): Promise<EventWithSource[]> {
  const where = buildCandidateEventWhere(event);
  const rows = await tx.event.findMany({
    where,
    include: { source: { select: { slug: true, enabled: true } } },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    take: 2000,
  });
  return rows as unknown as EventWithSource[];
}

async function recomputeCanonicalPrimaryTx(
  tx: CanonicalTx,
  canonicalID: string,
): Promise<{ canonicalID: string; events: EventWithSource[]; primary: EventWithSource } | null> {
  const events = await tx.event.findMany({
    where: { canonicalId: canonicalID, source: { enabled: true } },
    include: { source: { select: { slug: true, enabled: true } } },
  });
  if (events.length === 0) {
    await tx.canonicalEvent.delete({ where: { id: canonicalID } });
    return null;
  }
  const primary = choosePrimaryEvent(events);
  await tx.canonicalEvent.upsert({
    where: { id: canonicalID },
    create: { id: canonicalID, primaryEventId: primary.id },
    update: { primaryEventId: primary.id },
  });
  return { canonicalID, events, primary };
}

function choosePrimaryEvent(events: EventWithSource[]): EventWithSource {
  let best = events[0];
  for (let idx = 1; idx < events.length; idx += 1) {
    const next = events[idx];
    if (comparePrimaryCandidate(next, best) < 0) best = next;
  }
  return best;
}

function comparePrimaryCandidate(a: EventWithSource, b: EventWithSource): number {
  const imageA = hasImage(a.imageUrl);
  const imageB = hasImage(b.imageUrl);
  if (imageA !== imageB) return imageA ? -1 : 1;
  const rankA = sourcePriorityRank(a.source.slug);
  const rankB = sourcePriorityRank(b.source.slug);
  if (rankA !== rankB) return rankA - rankB;
  const timeA = a.startAt.getTime();
  const timeB = b.startAt.getTime();
  if (timeA !== timeB) return timeA - timeB;
  return a.id.localeCompare(b.id);
}

function hasImage(imageUrl: string | null): boolean {
  return typeof imageUrl === "string" && imageUrl.trim().length > 0;
}
