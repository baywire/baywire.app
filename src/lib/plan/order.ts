import type { Event } from "@/generated/prisma/client";

/**
 * Reorders `events` to follow `orderedIds`, dropping unknown UUIDs. Order is
 * the user's plan order (e.g. route order, not wall-clock time).
 */
export function sortEventsByPlanOrder(orderedIds: string[], events: Event[]): Event[] {
  const map = new Map(events.map((e) => [e.id, e] as [string, Event]));
  const out: Event[] = [];
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
