import type { AppPlace } from "@/lib/places/types";
import { normalizeSearchQuery, tokenizeSearchQuery } from "@/lib/search/rank";

export interface RankedPlace {
  placeID: string;
  score: number;
}

export function rankDeterministicPlaces(
  places: readonly AppPlace[],
  query: string,
): RankedPlace[] {
  const normalized = normalizeSearchQuery(query);
  const tokens = tokenizeSearchQuery(normalized);
  if (!normalized || tokens.length === 0) return [];

  const out: RankedPlace[] = [];
  for (const place of places) {
    const score = scorePlace(place, normalized, tokens);
    if (score <= 0) continue;
    out.push({ placeID: place.id, score });
  }
  out.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.placeID.localeCompare(b.placeID);
  });
  return out;
}

function scorePlace(place: AppPlace, normalized: string, tokens: string[]): number {
  const name = normalizeSearchQuery(place.name);
  const description = normalizeSearchQuery(place.description ?? "");
  const summary = normalizeSearchQuery(place.summary ?? "");
  const category = normalizeSearchQuery(place.category);
  const city = normalizeSearchQuery(place.city);
  const address = normalizeSearchQuery(place.address ?? "");
  const whyItsCool = normalizeSearchQuery(place.whyItsCool ?? "");
  const vibes = place.vibes.map((v) => normalizeSearchQuery(v));
  const tags = place.tags.map((t) => normalizeSearchQuery(t));

  let score = 0;
  if (name.startsWith(normalized)) score += 100;
  if (name.includes(normalized)) score += 70;
  if (category.includes(normalized)) score += 35;
  if (city.includes(normalized)) score += 25;
  if (summary.includes(normalized)) score += 25;
  if (description.includes(normalized)) score += 20;
  if (address.includes(normalized)) score += 15;
  if (whyItsCool.includes(normalized)) score += 15;
  if (vibes.some((v) => v.includes(normalized))) score += 12;
  if (tags.some((t) => t.includes(normalized))) score += 12;

  for (const token of tokens) {
    if (name.includes(token)) score += 28;
    if (category.includes(token)) score += 16;
    if (summary.includes(token)) score += 10;
    if (description.includes(token)) score += 8;
    if (whyItsCool.includes(token)) score += 6;
    if (vibes.some((v) => v.includes(token))) score += 5;
    if (tags.some((t) => t.includes(token))) score += 5;
  }

  if (score <= 0) return 0;
  if (typeof place.editorialScore === "number") {
    score += place.editorialScore * 10;
  }
  return score;
}
