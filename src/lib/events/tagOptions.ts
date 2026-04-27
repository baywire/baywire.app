import type { AppEvent } from "@/lib/events/types";
import { normalizeCategoryTags } from "@/lib/events/tagCanonical";

export interface TagOption {
  tag: string;
  count: number;
}

function canonicalTag(raw: string): string {
  return normalizeCategoryTags([raw], 1)[0] ?? "";
}

/**
 * Counts canonical category tags across a list of events.
 */
export function buildTagOptions(events: AppEvent[]): TagOption[] {
  const map = new Map<string, number>();
  for (const e of events) {
    const seen = new Set<string>();
    for (const raw of e.categories) {
      const t = canonicalTag(raw);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function eventMatchesTopTags(
  event: AppEvent,
  topTags: readonly string[] | Set<string>,
): boolean {
  const set = topTags instanceof Set ? topTags : new Set(topTags);
  if (set.size === 0) return true;
  for (const c of event.categories) {
    if (set.has(canonicalTag(c))) return true;
  }
  return false;
}
