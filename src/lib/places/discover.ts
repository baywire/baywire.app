import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import pLimit from "p-limit";

import type { CityKey } from "@/lib/cities";
import { CITIES } from "@/lib/cities";
import { logAiUsage } from "@/lib/extract/ai-usage";

const DEFAULT_MODEL = process.env.OPENAI_EXTRACT_MODEL ?? "gpt-4.1-mini";

export const SEARCH_TYPES = [
  "beaches",
  "bars",
  "restaurants",
  "breweries",
  "hidden_gems",
  "live_music",
] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

const SEARCH_QUERIES: Record<SearchType, string> = {
  beaches: "best beaches near",
  bars: "best bars and cocktail bars in",
  restaurants: "best restaurants to eat at in",
  breweries: "best breweries and craft beer spots in",
  hidden_gems: "hidden gem spots locals love in",
  live_music: "best live music venues in",
};

const DiscoveredPlaceSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  city: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  address: z.string().max(300).nullable(),
  websiteUrl: z.string().max(500).nullable(),
});

const DiscoveryResultSchema = z.object({
  places: z.array(DiscoveredPlaceSchema).max(25),
});

export type DiscoveredPlace = z.infer<typeof DiscoveredPlaceSchema> & {
  searchType: SearchType;
  cityKey: CityKey;
};

const SYSTEM_PROMPT = `You are a local guide for the Tampa Bay area in Florida. Given web search results about local places, extract a structured list of real places.

Rules:
- Only include real, currently operating places. No chains unless they have a unique local presence.
- Include name, category (restaurant, bar, brewery, beach, cafe, venue, attraction, park, shop, gallery, museum, bakery, other), city, a brief description, address if found, and website URL if found.
- Do not invent places. Only extract places that appear in the search results.
- Prefer places with strong local reputation or unique character.
- If a list of existing places is provided, DO NOT include any of them. Focus exclusively on new discoveries not already in our database.
- Respect the requested limit on number of places to return.`;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  client = new OpenAI({ apiKey, baseURL });
  return client;
}

export interface DiscoverOptions {
  cities?: CityKey[];
  searchTypes?: SearchType[];
  concurrency?: number;
  /** Existing place names per city key — passed to the AI so it prioritizes new finds. */
  existingByCity?: Map<string, string[]>;
  /** Max new places to return per search query. Defaults to 15. */
  limitPerQuery?: number;
}

export async function discoverPlaces(opts: DiscoverOptions = {}): Promise<DiscoveredPlace[]> {
  const cities = opts.cities
    ? CITIES.filter((c) => opts.cities!.includes(c.key))
    : CITIES;
  const types = opts.searchTypes ?? [...SEARCH_TYPES];
  const limit = pLimit(opts.concurrency ?? 3);
  const openai = getClient();
  const maxPerQuery = opts.limitPerQuery ?? 15;

  const tasks: Promise<DiscoveredPlace[]>[] = [];
  for (const city of cities) {
    const existing = opts.existingByCity?.get(city.key) ?? [];
    for (const searchType of types) {
      tasks.push(limit(() => searchForPlaces(openai, city.key, city.label, searchType, existing, maxPerQuery)));
    }
  }

  const results = await Promise.allSettled(tasks);
  const all: DiscoveredPlace[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.warn("[discover] search failed:", r.reason);
  }
  return all;
}

async function searchForPlaces(
  openai: OpenAI,
  cityKey: CityKey,
  cityLabel: string,
  searchType: SearchType,
  existingNames: string[],
  maxPlaces: number,
): Promise<DiscoveredPlace[]> {
  const query = `${SEARCH_QUERIES[searchType]} ${cityLabel}, Florida`;
  const format = zodTextFormat(DiscoveryResultSchema, "discoveryResult");
  const startMs = Date.now();

  const exclusionBlock = existingNames.length > 0
    ? `\n\nWe already have these places — do NOT include them, focus on NEW discoveries:\n${existingNames.map((n) => `- ${n}`).join("\n")}`
    : "";

  try {
    const response = await openai.responses.parse({
      model: DEFAULT_MODEL,
      tools: [{ type: "web_search_preview" }],
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Search for: ${query}\n\nExtract up to ${maxPlaces} places found into structured data.${exclusionBlock}`,
        },
      ],
      text: { format },
    });

    const parsed = response.output_parsed;
    if (!parsed) throw new Error("No parsed output from discovery search");

    logAiUsage({
      feature: "extract_place",
      model: DEFAULT_MODEL,
      usage: response.usage,
      latencyMs: Date.now() - startMs,
      success: true,
      meta: { stage: "discover", cityKey, searchType },
    });

    return parsed.places.map((p) => ({ ...p, searchType, cityKey }));
  } catch (err) {
    logAiUsage({
      feature: "extract_place",
      model: DEFAULT_MODEL,
      usage: null,
      latencyMs: Date.now() - startMs,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      meta: { stage: "discover", cityKey, searchType },
    });
    throw err;
  }
}

export function deduplicateCandidates(candidates: DiscoveredPlace[]): DiscoveredPlace[] {
  const seen = new Map<string, DiscoveredPlace>();
  for (const c of candidates) {
    const key = normalizeName(c.name) + "|" + c.cityKey;
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()];
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}
