import type { Event } from "@/generated/prisma/client";

import { formatDayHeader, TZ } from "@/lib/time/window";

export interface DayGroup {
  key: string;
  label: string;
  events: Event[];
}

export function groupEventsByDay(rows: Event[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const row of rows) {
    const key = fmt.format(row.startAt);
    let group = map.get(key);
    if (!group) {
      group = { key, label: formatDayHeader(row.startAt), events: [] };
      map.set(key, group);
    }
    group.events.push(row);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}
