import type { City, Prisma } from "@/prisma/client";

const MATCH_WINDOW_HOURS = 12;
const ALLDAY_MATCH_WINDOW_HOURS = 48;

interface CandidateSeedEvent {
  id: string;
  city: City;
  allDay: boolean;
  startAt: Date;
  endAt: Date | null;
}

export function buildCandidateEventWhere(
  event: CandidateSeedEvent,
): Prisma.EventWhereInput {
  const shortWindowStart = new Date(
    event.startAt.getTime() - MATCH_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const shortWindowEnd = new Date(
    event.startAt.getTime() + MATCH_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const longWindowStart = new Date(
    event.startAt.getTime() - ALLDAY_MATCH_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const longWindowEnd = new Date(
    event.startAt.getTime() + ALLDAY_MATCH_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const where: Prisma.EventWhereInput = {
    id: { not: event.id },
    source: { enabled: true },
    ...(event.city !== "other" ? { city: event.city } : {}),
  };
  if (isLongSpanCandidate(event)) {
    where.startAt = { gte: longWindowStart, lte: longWindowEnd };
  } else {
    where.OR = [
      { startAt: { gte: shortWindowStart, lte: shortWindowEnd } },
      { allDay: true, startAt: { gte: longWindowStart, lte: longWindowEnd } },
    ];
  }
  return where;
}

function chooseCandidateWindowHours(event: CandidateSeedEvent): number {
  if (event.allDay) return ALLDAY_MATCH_WINDOW_HOURS;
  if (event.endAt) {
    const spanHours = Math.abs(event.endAt.getTime() - event.startAt.getTime()) / (60 * 60 * 1000);
    if (spanHours >= 20) return ALLDAY_MATCH_WINDOW_HOURS;
  }
  return MATCH_WINDOW_HOURS;
}

function isLongSpanCandidate(event: CandidateSeedEvent): boolean {
  return chooseCandidateWindowHours(event) === ALLDAY_MATCH_WINDOW_HOURS;
}
