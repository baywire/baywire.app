import { addHours, endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import type { AppEvent } from "@/lib/events/types";

import { TZ } from "@/lib/time/window";

/**
 * Inferred display interval for conflict checks.
 * - All-day: local calendar day in America/New_York (start inclusive, end inclusive wall-clock, compared as [start, end) using end = next ms after EOD to avoid false overlap with next day).
 * - Timed: `endAt` if set, else `startAt + 1h` so bare listings still participate in conflict detection.
 */
export function getEffectiveInterval(event: AppEvent): { start: Date; end: Date } {
  if (event.allDay) {
    const local = toZonedTime(event.startAt, TZ);
    const s = startOfDay(local);
    const e = endOfDay(local);
    const startUtc = fromZonedTime(s, TZ);
    const endExclusive = new Date(fromZonedTime(e, TZ).getTime() + 1);
    return { start: startUtc, end: endExclusive };
  }
  const end = event.endAt ?? addHours(event.startAt, 1);
  return { start: event.startAt, end };
}

/** Half-open [a,b) and [c,d) overlap when a < d and c < b. */
export function halfOpenRangesOverlap(
  a: Date,
  b: Date,
  c: Date,
  d: Date,
): boolean {
  return a.getTime() < d.getTime() && c.getTime() < b.getTime();
}

export function eventsTimeOverlap(e1: AppEvent, e2: AppEvent): boolean {
  if (e1.id === e2.id) return false;
  const A = getEffectiveInterval(e1);
  const B = getEffectiveInterval(e2);
  return halfOpenRangesOverlap(A.start, A.end, B.start, B.end);
}

/**
 * For each event id, the *other* events on the same local day whose effective
 * interval overlaps it. Used to surface specific conflicting titles in the UI
 * instead of a generic "overlaps another item" string.
 */
export function findConflictMap(ordered: AppEvent[]): Map<string, AppEvent[]> {
  const byDay = groupIdsByLocalDay(ordered);
  const map = new Map<string, AppEvent[]>();
  const push = (id: string, other: AppEvent) => {
    let arr = map.get(id);
    if (!arr) {
      arr = [];
      map.set(id, arr);
    }
    arr.push(other);
  };
  for (const list of byDay) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (eventsTimeOverlap(a, b)) {
          push(a.id, b);
          push(b.id, a);
        }
      }
    }
  }
  return map;
}

function groupIdsByLocalDay(events: AppEvent[]): AppEvent[][] {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map = new Map<string, AppEvent[]>();
  for (const e of events) {
    const k = fmt.format(e.startAt);
    let a = map.get(k);
    if (!a) {
      a = [];
      map.set(k, a);
    }
    a.push(e);
  }
  return Array.from(map.values());
}
