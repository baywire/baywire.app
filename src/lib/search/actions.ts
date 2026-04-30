"use server";

import { listEvents } from "@/lib/db/queries";
import { listPlaces } from "@/lib/db/queriesPlaces";
import type { AppEvent } from "@/lib/events/types";
import type { AppPlace } from "@/lib/places/types";
import { type SearchCandidate, rerankWithAI } from "@/lib/search/ai";
import { normalizeSearchQuery, rankDeterministic } from "@/lib/search/rank";
import { rankDeterministicPlaces } from "@/lib/search/rankPlaces";
import type { AIPick, SearchMode, SearchResponse } from "@/lib/search/types";

const MAX_EVENT_CANDIDATES = 30;
const MAX_PLACE_CANDIDATES = 10;
const EVENT_RESULT_LIMIT = 40;
const PLACE_RESULT_LIMIT = 15;
const AI_TIMEOUT_MS = 3500;

export interface SearchInput {
  query: string;
}

export async function search(input: SearchInput): Promise<SearchResponse> {
  const startedAt = Date.now();
  const query = normalizeSearchQuery(input.query ?? "");
  if (query.length < 2) {
    return buildEmpty(query, "idle", startedAt);
  }

  const [eventRows, placeRows] = await Promise.all([
    listEvents({ window: "week", limit: 400 }),
    listPlaces({ limit: 300 }),
  ]);

  const deduped = deduplicateEvents(eventRows);
  const rankedEvents = rankDeterministic(deduped, query);
  const rankedPlaces = rankDeterministicPlaces(placeRows, query);

  const eventByID = new Map(deduped.map((e) => [e.id, e]));
  const placeByID = new Map(placeRows.map((p) => [p.id, p]));

  const topEventIDs = rankedEvents.slice(0, EVENT_RESULT_LIMIT).map((r) => r.eventID);
  const topPlaceIDs = rankedPlaces.slice(0, PLACE_RESULT_LIMIT).map((r) => r.placeID);

  const resolveEvents = (ids: string[]) =>
    ids.map((id) => eventByID.get(id)).filter((e): e is AppEvent => Boolean(e));
  const resolvePlaces = (ids: string[]) =>
    ids.map((id) => placeByID.get(id)).filter((p): p is AppPlace => Boolean(p));

  if (topEventIDs.length === 0 && topPlaceIDs.length === 0) {
    return buildEmpty(query, "fallback", startedAt);
  }

  const aiEnabled = process.env.SEARCH_AI_ENABLED !== "false" && Boolean(process.env.OPENAI_API_KEY);

  if (!aiEnabled) {
    return {
      query,
      intentLine: null,
      aiPicks: [],
      events: resolveEvents(topEventIDs),
      places: resolvePlaces(topPlaceIDs),
      reasonByID: {},
      metadata: buildMetadata("fallback", startedAt, false),
    };
  }

  const eventCandidateIDs = rankedEvents.slice(0, MAX_EVENT_CANDIDATES).map((r) => r.eventID);
  const placeCandidateIDs = rankedPlaces.slice(0, MAX_PLACE_CANDIDATES).map((r) => r.placeID);

  const candidates: SearchCandidate[] = [
    ...resolveEvents(eventCandidateIDs).map(eventToCandidate),
    ...resolvePlaces(placeCandidateIDs).map(placeToCandidate),
  ];

  const candidateIDSet = new Set(candidates.map((c) => c.id));

  try {
    const ai = await Promise.race([
      rerankWithAI(query, candidates),
      timeoutReject(AI_TIMEOUT_MS),
    ]);

    const aiPickIDs = uniqueStable(
      ai.aiPickIDs.filter((id) => candidateIDSet.has(id)),
    ).slice(0, 5);

    const reasonByID: Record<string, string> = {};
    for (const id of aiPickIDs) {
      const reason = ai.reasonByID[id];
      if (reason) reasonByID[id] = reason;
    }

    const aiSet = new Set(aiPickIDs);
    const aiPicks: AIPick[] = [];
    for (const id of aiPickIDs) {
      const event = eventByID.get(id);
      if (event) {
        aiPicks.push({ type: "event", event, reason: reasonByID[id] });
        continue;
      }
      const place = placeByID.get(id);
      if (place) {
        aiPicks.push({ type: "place", place, reason: reasonByID[id] });
      }
    }

    return {
      query,
      intentLine: ai.intentLine,
      aiPicks,
      events: resolveEvents(topEventIDs.filter((id) => !aiSet.has(id))),
      places: resolvePlaces(topPlaceIDs.filter((id) => !aiSet.has(id))),
      reasonByID,
      metadata: buildMetadata("ai", startedAt, true),
    };
  } catch (err) {
    console.warn(
      `[search] AI rerank failed for q="${query}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      query,
      intentLine: null,
      aiPicks: [],
      events: resolveEvents(topEventIDs),
      places: resolvePlaces(topPlaceIDs),
      reasonByID: {},
      metadata: buildMetadata("fallback", startedAt, false),
    };
  }
}

function eventToCandidate(e: AppEvent): SearchCandidate {
  return {
    id: e.id,
    type: "event",
    title: e.title,
    summary: e.description ?? "",
    categories: e.categories,
    city: e.city,
    venueName: e.venueName ?? "",
    editorialScore: e.editorialScore ?? null,
    vibes: e.vibes ?? [],
    audience: e.audience ?? null,
  };
}

function placeToCandidate(p: AppPlace): SearchCandidate {
  return {
    id: p.id,
    type: "place",
    title: p.name,
    summary: p.summary ?? p.description ?? "",
    categories: [p.category],
    city: p.city,
    venueName: "",
    editorialScore: p.editorialScore ?? null,
    vibes: p.vibes,
    audience: null,
  };
}

function uniqueStable(input: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function buildEmpty(query: string, mode: SearchMode, startedAt: number): SearchResponse {
  return {
    query,
    intentLine: null,
    aiPicks: [],
    events: [],
    places: [],
    reasonByID: {},
    metadata: buildMetadata(mode, startedAt, false),
  };
}

function buildMetadata(mode: SearchMode, startedAt: number, aiUsed: boolean) {
  return { mode, latencyMs: Date.now() - startedAt, aiUsed };
}

function timeoutReject(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`search ai timeout (${ms}ms)`)), ms);
  });
}

function deduplicateEvents(events: AppEvent[]): AppEvent[] {
  const byCanonical = new Map<string, AppEvent>();
  const noCanonical: AppEvent[] = [];
  for (const event of events) {
    const key = event.canonicalEventID;
    if (key) {
      const existing = byCanonical.get(key);
      if (!existing || isBetterDisplay(event, existing)) byCanonical.set(key, event);
    } else {
      noCanonical.push(event);
    }
  }
  const afterCanonical = [...byCanonical.values(), ...noCanonical];
  const byTitle = new Map<string, AppEvent>();
  for (const event of afterCanonical) {
    const key = normalizeForDedup(event.title);
    const existing = byTitle.get(key);
    if (!existing || isBetterDisplay(event, existing)) byTitle.set(key, event);
  }
  return [...byTitle.values()];
}

function normalizeForDedup(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b\d{4}\b/g, "")
    .replace(/tampa\s*bay/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isBetterDisplay(a: AppEvent, b: AppEvent): boolean {
  const scoreA = a.editorialScore ?? -1;
  const scoreB = b.editorialScore ?? -1;
  if (scoreA !== scoreB) return scoreA > scoreB;
  return (a.imageUrl ? 1 : 0) > (b.imageUrl ? 1 : 0);
}
