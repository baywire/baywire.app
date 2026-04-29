/**
 * Single source of truth for source display priority.
 *
 * Both the canonical resolver (which writes `CanonicalEvent.primaryEventId`)
 * and the read-path display picker (which selects which event in a canonical
 * group to render) consult this list. Earlier slugs win.
 *
 * If these two callers disagree about ordering, the city facet pills can
 * disagree with the rendered cards (the facet is computed off the DB primary,
 * the card is picked at read time).
 */
export const SOURCE_PRIORITY = [
  "eventbrite",
  "visit_tampa_bay",
  "visit_st_pete_clearwater",
  "tampa_gov",
  "ilovetheburg",
  "thats_so_tampa",
  "straz_center",
  "tampa_theatre",
  "side_splitters",
  "funny_bone_tampa",
  "dont_tell_comedy",
  "tampa_bay_times",
  "tampa_bay_markets",
  "safety_harbor",
  "ticketmaster",
] as const;

export type SourceSlug = (typeof SOURCE_PRIORITY)[number];

const SOURCE_RANK = new Map<string, number>(
  SOURCE_PRIORITY.map((slug, idx) => [slug, idx]),
);

const FALLBACK_RANK = SOURCE_PRIORITY.length + 100;

/**
 * Returns the display priority rank for a source slug. Lower wins. Unknown
 * slugs sort after every known source so a newly-added scraper never silently
 * outranks a curated source.
 */
export function sourcePriorityRank(slug: string): number {
  return SOURCE_RANK.get(slug) ?? FALLBACK_RANK;
}
