"use server";

import { type CityKey, isCityKey } from "@/lib/cities";
import { listEvents } from "@/lib/db/queries";
import type { AppEvent } from "@/lib/events/types";
import { eventMatchesTopTags } from "@/lib/events/tagOptions";
import { rerankWithAI } from "@/lib/search/ai";
import { normalizeSearchQuery, rankDeterministic } from "@/lib/search/rank";
import type { SearchMode, SearchResponse } from "@/lib/search/types";
import { type WindowKey } from "@/lib/time/window";

const VALID_WINDOWS = new Set<WindowKey>(["tonight", "weekend", "week"]);
const MAX_CANDIDATES = 40;
const DIRECT_MATCH_LIMIT = 60;
const AI_TIMEOUT_MS = 3500;

export interface SearchEventsInput {
  query: string;
  window: WindowKey;
  city: CityKey | "all";
  freeOnly: boolean;
  tags: readonly string[];
  savedOnly: boolean;
  savedIDs: readonly string[];
}

export async function searchEvents(input: SearchEventsInput): Promise<SearchResponse> {
  const startedAt = Date.now();
  const query = normalizeSearchQuery(input.query ?? "");
  if (query.length < 2) {
    return buildEmpty(query, "idle", startedAt, false, false);
  }

  const window: WindowKey = VALID_WINDOWS.has(input.window) ? input.window : "weekend";
  const city = input.city && input.city !== "all" && isCityKey(input.city) ? input.city : null;
  const tags = normalizeStringArray(input.tags);
  const savedIDs = new Set(normalizeStringArray(input.savedIDs));

  const rows = await listEvents({
    window,
    cities: city ? [city] : undefined,
    freeOnly: Boolean(input.freeOnly),
    limit: 200,
  });

  const filtered = rows.filter((event) => {
    if (tags.length > 0 && !eventMatchesTopTags(event, new Set(tags))) return false;
    if (input.savedOnly && !savedIDs.has(event.id)) return false;
    return true;
  });

  const deduped = deduplicateEvents(filtered);
  const ranked = rankDeterministic(deduped, query);
  const directMatchIDs = ranked.slice(0, DIRECT_MATCH_LIMIT).map((row) => row.eventID);
  if (directMatchIDs.length === 0) {
    return buildEmpty(query, "fallback", startedAt, false, false);
  }

  const candidateIDs = ranked.slice(0, MAX_CANDIDATES).map((row) => row.eventID);
  const byID = new Map(deduped.map((event) => [event.id, event]));
  const candidates = candidateIDs
    .map((id) => byID.get(id))
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
  const aiEnabled = process.env.SEARCH_AI_ENABLED !== "false" && Boolean(process.env.OPENAI_API_KEY);
  const truncated = ranked.length > MAX_CANDIDATES;

  if (!aiEnabled) {
    return {
      query,
      intentLine: null,
      aiPickIDs: [],
      directMatchIDs,
      reasonByID: {},
      metadata: buildMetadata("fallback", startedAt, false, truncated),
    };
  }

  try {
    const ai = await Promise.race([
      rerankWithAI(query, candidates),
      timeoutReject(AI_TIMEOUT_MS),
    ]);
    const aiPickIDs = uniqueStable(
      ai.aiPickIDs.filter((id) => candidateIDs.includes(id)),
    ).slice(0, 5);
    const reasonByID: Record<string, string> = {};
    for (const id of aiPickIDs) {
      const reason = ai.reasonByID[id];
      if (reason) reasonByID[id] = reason;
    }
    return {
      query,
      intentLine: ai.intentLine,
      aiPickIDs,
      directMatchIDs,
      reasonByID,
      metadata: buildMetadata("ai", startedAt, true, truncated),
    };
  } catch (err) {
    console.warn(
      `[search] AI rerank failed for q="${query}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      query,
      intentLine: null,
      aiPickIDs: [],
      directMatchIDs,
      reasonByID: {},
      metadata: buildMetadata("fallback", startedAt, false, truncated),
    };
  }
}

function normalizeStringArray(input: readonly string[] | undefined): string[] {
  if (!input) return [];
  return input.map((value) => value.trim()).filter(Boolean);
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

function buildEmpty(
  query: string,
  mode: SearchMode,
  startedAt: number,
  aiUsed: boolean,
  truncatedCandidates: boolean,
): SearchResponse {
  return {
    query,
    intentLine: null,
    aiPickIDs: [],
    directMatchIDs: [],
    reasonByID: {},
    metadata: buildMetadata(mode, startedAt, aiUsed, truncatedCandidates),
  };
}

function buildMetadata(
  mode: SearchMode,
  startedAt: number,
  aiUsed: boolean,
  truncatedCandidates: boolean,
) {
  return {
    mode,
    latencyMs: Date.now() - startedAt,
    aiUsed,
    truncatedCandidates,
  };
}

function timeoutReject(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`search ai timeout (${ms}ms)`)), ms);
  });
}

/**
 * Two-pass dedup: first collapse by canonicalEventID, then collapse
 * survivors by normalized title so near-identical events from separate
 * canonical groups still merge.
 */
function deduplicateEvents(events: AppEvent[]): AppEvent[] {
  const byCanonical = new Map<string, AppEvent>();
  const noCanonical: AppEvent[] = [];

  for (const event of events) {
    const key = event.canonicalEventID;
    if (key) {
      const existing = byCanonical.get(key);
      if (!existing || isBetterDisplay(event, existing)) {
        byCanonical.set(key, event);
      }
    } else {
      noCanonical.push(event);
    }
  }

  const afterCanonical = [...byCanonical.values(), ...noCanonical];

  const byTitle = new Map<string, AppEvent>();
  for (const event of afterCanonical) {
    const key = normalizeForDedup(event.title);
    const existing = byTitle.get(key);
    if (!existing || isBetterDisplay(event, existing)) {
      byTitle.set(key, event);
    }
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
  const imgA = a.imageUrl ? 1 : 0;
  const imgB = b.imageUrl ? 1 : 0;
  return imgA > imgB;
}
