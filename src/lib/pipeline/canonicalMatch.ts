import type { Event } from "@/generated/prisma/client";

const TZ = "America/New_York";
const MATCH_WINDOW_HOURS = 12;
const ALLDAY_MATCH_WINDOW_HOURS = 48;

export function isLikelySameEvent(a: Event, b: Event): boolean {
  const hoursApart = Math.abs(a.startAt.getTime() - b.startAt.getTime()) / (60 * 60 * 1000);
  const requiresDayBasedMatch = isAllDayOrMultiDay(a) || isAllDayOrMultiDay(b);
  const maxWindow = requiresDayBasedMatch ? ALLDAY_MATCH_WINDOW_HOURS : MATCH_WINDOW_HOURS;
  if (hoursApart > maxWindow) return false;

  const aTitle = normalizeMatchText(a.title);
  const bTitle = normalizeMatchText(b.title);
  if (!aTitle || !bTitle) return false;
  if (aTitle === bTitle) return true;

  const score = titleSimilarityScore(aTitle, bTitle);
  const venueMatch = locationMatches(a.venueName, b.venueName);
  const addressMatch = locationMatches(a.address, b.address);
  const locationAligned = venueMatch || addressMatch;

  if (requiresDayBasedMatch) {
    if (!dayRangesOverlap(a, b)) return false;
    if (score >= 0.67 && locationAligned) return true;
    if (score >= 0.82) return true;
    return false;
  }

  if (score >= 0.88 && hoursApart <= 6) return true;
  if (score >= 0.75 && hoursApart <= 3 && locationAligned) return true;
  if (score >= 0.67 && hoursApart <= 2 && locationAligned) return true;
  return false;
}

export function titleSimilarityScore(aTitle: string, bTitle: string): number {
  const aTokens = tokenize(aTitle);
  const bTokens = tokenize(bTitle);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = new Set([...aSet, ...bSet]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  if (aTitle.includes(bTitle) || bTitle.includes(aTitle)) {
    return Math.max(jaccard, 0.9);
  }
  return jaccard;
}

export function normalizeMatchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function locationMatches(aRaw: string | null, bRaw: string | null): boolean {
  const a = normalizeMatchText(aRaw ?? "");
  const b = normalizeMatchText(bRaw ?? "");
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

function tokenize(input: string): string[] {
  return input
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function isAllDayOrMultiDay(e: Event): boolean {
  if (e.allDay) return true;
  if (!e.endAt) return false;
  const spanHours = Math.abs(e.endAt.getTime() - e.startAt.getTime()) / (60 * 60 * 1000);
  // Treat anything spanning ~20h+ as multi-day for matching purposes.
  return spanHours >= 20;
}

function dayRangesOverlap(a: Event, b: Event): boolean {
  const [aStart, aEnd] = localDayRange(a);
  const [bStart, bEnd] = localDayRange(b);
  return maxDay(aStart, bStart) <= minDay(aEnd, bEnd);
}

function localDayRange(e: Event): [string, string] {
  const start = localDayKey(e.startAt);
  const end = localDayKey(e.endAt ?? e.startAt);
  return start <= end ? [start, end] : [end, start];
}

function localDayKey(d: Date): string {
  // en-CA yields YYYY-MM-DD in a stable order.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function maxDay(a: string, b: string): string {
  return a >= b ? a : b;
}

function minDay(a: string, b: string): string {
  return a <= b ? a : b;
}
