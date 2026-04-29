import type { AppEvent } from "@/lib/events/types";

/**
 * Reorders `events` to follow `orderedIds`, dropping unknown UUIDs. Order is
 * the user's plan order (e.g. route order, not wall-clock time).
 */
export function sortEventsByPlanOrder(orderedIds: string[], events: AppEvent[]): AppEvent[] {
  const map = new Map(events.map((e) => [e.id, e] as [string, AppEvent]));
  const out: AppEvent[] = [];
  for (const id of orderedIds) {
    const e = map.get(id);
    if (e) out.push(e);
  }
  return out;
}

const MAX_PLAN = 80;

/**
 * If `id` is new and the list is at capacity, returns `ordered` unchanged.
 * If `id` is already in the list, it is removed and re-appended (move to end).
 */
export function appendOrMoveToEnd(ordered: string[], id: string, max: number = MAX_PLAN): string[] {
  const filtered = ordered.filter((x) => x !== id);
  if (!ordered.includes(id) && filtered.length >= max) return ordered;
  return [...filtered, id];
}

/**
 * Insert `event` into `ordered` at a chronologically correct position based on
 * `startAt`. All-day events and items without a specific time (future: places)
 * append to the end so the user can freely position them.
 */
export function insertChronologically(
  ordered: string[],
  event: AppEvent,
  knownEvents: ReadonlyMap<string, AppEvent>,
  max: number = MAX_PLAN,
): string[] {
  const filtered = ordered.filter((x) => x !== event.id);
  if (!ordered.includes(event.id) && filtered.length >= max) return ordered;

  if (event.allDay) return [...filtered, event.id];

  const ts = event.startAt.getTime();
  let insertIdx = filtered.length;
  for (let i = 0; i < filtered.length; i++) {
    const existing = knownEvents.get(filtered[i]!);
    if (!existing || existing.allDay) continue;
    if (existing.startAt.getTime() > ts) {
      insertIdx = i;
      break;
    }
  }

  const out = [...filtered];
  out.splice(insertIdx, 0, event.id);
  return out;
}
