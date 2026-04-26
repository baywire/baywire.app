import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  addDays,
  endOfDay,
  endOfWeek,
  isFriday,
  isSaturday,
  isSunday,
  nextFriday,
  startOfDay,
} from "date-fns";

export const TZ = "America/New_York";

export type WindowKey = "tonight" | "weekend" | "week";

export interface DateWindow {
  key: WindowKey;
  startAt: Date;
  endAt: Date;
  label: string;
}

/**
 * Returns the requested browse window with both bounds expressed as UTC
 * `Date` instances anchored to the wall clock in `America/New_York`.
 *
 * `tonight`  → now → end of today (local)
 * `weekend`  → upcoming Fri 00:00 → Sun 23:59 (or current Fri/Sat/Sun)
 * `week`     → today 00:00 → +7 days 23:59
 */
export function getWindow(key: WindowKey, now: Date = new Date()): DateWindow {
  const localNow = toZonedTime(now, TZ);

  switch (key) {
    case "tonight": {
      const end = endOfDay(localNow);
      return {
        key,
        startAt: now,
        endAt: fromZonedTime(end, TZ),
        label: "Tonight",
      };
    }
    case "weekend": {
      const fri = isFriday(localNow) || isSaturday(localNow) || isSunday(localNow)
        ? startOfDay(localNow)
        : startOfDay(nextFriday(localNow));
      const sun = endOfDay(addDays(fri, 2));
      return {
        key,
        startAt: fromZonedTime(fri, TZ),
        endAt: fromZonedTime(sun, TZ),
        label: "This Weekend",
      };
    }
    case "week": {
      const start = startOfDay(localNow);
      const end = endOfDay(addDays(start, 7));
      return {
        key,
        startAt: fromZonedTime(start, TZ),
        endAt: fromZonedTime(end, TZ),
        label: "This Week",
      };
    }
  }
}

/**
 * Window used when scraping. Always the next 14 days from now, in UTC, so we
 * pull a bit more than we display (gives weekend/week filters something to
 * work with even if a scrape run is briefly delayed).
 */
export function getScrapeWindow(now: Date = new Date()): DateWindow {
  const localNow = toZonedTime(now, TZ);
  const start = startOfDay(localNow);
  const end = endOfDay(addDays(start, 14));
  return {
    key: "week",
    startAt: fromZonedTime(start, TZ),
    endAt: fromZonedTime(end, TZ),
    label: "Next 14 days",
  };
}

/** Returns true when `weekStart`/`weekEnd` overlap with `start`/`end`. */
export function overlapsWindow(
  start: Date,
  end: Date | null,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  const e = end ?? start;
  return start <= windowEnd && e >= windowStart;
}

/**
 * Parses an ISO-8601 string in `America/New_York` (no offset) into a UTC Date.
 * Returns null on invalid input.
 */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD".
  const withTime = trimmed.length <= 10 ? `${trimmed}T00:00:00` : trimmed;
  try {
    const date = fromZonedTime(withTime, TZ);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/** Formats a UTC Date for display in the Tampa Bay timezone. */
export function formatLocal(date: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: TZ }).format(date);
}

export function formatDayHeader(date: Date): string {
  return formatLocal(date, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatTimeRange(start: Date, end: Date | null, allDay: boolean): string {
  if (allDay) return "All day";
  const startStr = formatLocal(start, { hour: "numeric", minute: "2-digit" });
  if (!end) return startStr;
  const sameDay =
    formatLocal(start, { year: "numeric", month: "2-digit", day: "2-digit" }) ===
    formatLocal(end, { year: "numeric", month: "2-digit", day: "2-digit" });
  if (sameDay) {
    const endStr = formatLocal(end, { hour: "numeric", minute: "2-digit" });
    return `${startStr} – ${endStr}`;
  }
  const endStr = formatLocal(end, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startStr} → ${endStr}`;
}

export function endOfWeekLocal(now: Date = new Date()): Date {
  const local = toZonedTime(now, TZ);
  return fromZonedTime(endOfWeek(local, { weekStartsOn: 0 }), TZ);
}
