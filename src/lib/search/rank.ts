import type { AppEvent } from "@/lib/events/types";

export interface RankedEvent {
  eventID: string;
  score: number;
}

export function normalizeSearchQuery(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function tokenizeSearchQuery(input: string): string[] {
  const normalized = normalizeSearchQuery(input);
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length > 1);
}

export function rankDeterministic(
  events: readonly AppEvent[],
  query: string,
): RankedEvent[] {
  const normalized = normalizeSearchQuery(query);
  const tokens = tokenizeSearchQuery(normalized);
  if (!normalized || tokens.length === 0) return [];
  const out: RankedEvent[] = [];
  for (const event of events) {
    const score = scoreEvent(event, normalized, tokens);
    if (score <= 0) continue;
    out.push({ eventID: event.id, score });
  }
  out.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.eventID.localeCompare(b.eventID);
  });
  return out;
}

function scoreEvent(event: AppEvent, normalized: string, tokens: string[]): number {
  const title = normalizeSearchQuery(event.title);
  const description = normalizeSearchQuery(event.description ?? "");
  const venueName = normalizeSearchQuery(event.venueName ?? "");
  const city = normalizeSearchQuery(event.city ?? "");
  const categories = event.categories.map((tag) => normalizeSearchQuery(tag));
  const whyItsCool = normalizeSearchQuery(event.whyItsCool ?? "");
  const vibes = (event.vibes ?? []).map((v) => normalizeSearchQuery(v));

  let score = 0;
  if (title.startsWith(normalized)) score += 100;
  if (title.includes(normalized)) score += 70;
  if (venueName.includes(normalized)) score += 40;
  if (city.includes(normalized)) score += 25;
  if (categories.some((tag) => tag.includes(normalized))) score += 30;
  if (description.includes(normalized)) score += 20;
  if (whyItsCool.includes(normalized)) score += 15;
  if (vibes.some((v) => v.includes(normalized))) score += 12;

  for (const token of tokens) {
    if (title.includes(token)) score += 28;
    if (venueName.includes(token)) score += 18;
    if (categories.some((tag) => tag.includes(token))) score += 14;
    if (description.includes(token)) score += 8;
    if (whyItsCool.includes(token)) score += 6;
    if (vibes.some((v) => v.includes(token))) score += 5;
  }

  if (score <= 0) return 0;
  if (typeof event.editorialScore === "number") {
    score += event.editorialScore * 10;
  }
  return score;
}
