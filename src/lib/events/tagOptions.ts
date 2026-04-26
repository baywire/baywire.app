import type { Event } from "@/generated/prisma/client";

export interface TagOption {
  tag: string;
  count: number;
}

/**
 * Counts non-empty, lowercased category tags across a list of events.
 */
export function buildTagOptions(events: Event[]): TagOption[] {
  const map = new Map<string, number>();
  for (const e of events) {
    for (const raw of e.categories) {
      const t = raw.trim().toLowerCase();
      if (!t) continue;
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function eventMatchesTopTags(
  event: Event,
  topTags: readonly string[] | Set<string>,
): boolean {
  const set = topTags instanceof Set ? topTags : new Set(topTags);
  if (set.size === 0) return true;
  for (const c of event.categories) {
    if (set.has(c.trim().toLowerCase())) return true;
  }
  return false;
}
