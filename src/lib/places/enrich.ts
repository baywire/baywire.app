import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import pLimit from "p-limit";

import { logAiUsage } from "@/lib/extract/ai-usage";
import type { DiscoveredPlace } from "./discover";

const DEFAULT_MODEL = process.env.OPENAI_EXTRACT_MODEL ?? "gpt-4.1-mini";

const EnrichedPlaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  address: z.string().max(300).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  phoneNumber: z.string().max(30).nullable(),
  websiteUrl: z.string().max(500).nullable(),
  imageUrl: z.string().max(1000).nullable(),
  priceRange: z.string().max(4).nullable(),
  hoursJson: z.array(z.string()).nullable(),
  webRating: z.number().min(0).max(5).nullable(),
  webReviewCount: z.number().int().min(0).nullable(),
});

export type EnrichedPlace = z.infer<typeof EnrichedPlaceSchema> & DiscoveredPlace;

const SYSTEM_PROMPT = `You are enriching a local place record with detailed information from web search results.

Rules:
- Extract the most accurate and complete information from search results.
- latitude / longitude: extract the exact GPS coordinates from Google Maps, Yelp, or other sources. These are critical for mapping. Null only if truly not available.
- webRating should be on a 1-5 scale (Google/Yelp/TripAdvisor style). Use the most prominent rating found.
- webReviewCount is the total number of reviews found across sources.
- imageUrl should be a direct URL to a high-quality photo of the place (not a logo). Null if not found.
- hoursJson should be an array of strings like ["Mon-Fri 11am-10pm", "Sat 10am-11pm"]. Null if not found.
- priceRange should be "$", "$$", "$$$", or "$$$$". Null if unknown.
- Do not invent data. If information is not found in search results, use null.`;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  client = new OpenAI({ apiKey, baseURL });
  return client;
}

export interface EnrichOptions {
  concurrency?: number;
}

export async function enrichPlaces(
  candidates: DiscoveredPlace[],
  opts: EnrichOptions = {},
): Promise<EnrichedPlace[]> {
  const limit = pLimit(opts.concurrency ?? 5);
  const openai = getClient();

  const tasks = candidates.map((c) =>
    limit(() => enrichSingle(openai, c)),
  );

  const results = await Promise.allSettled(tasks);
  const enriched: EnrichedPlace[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) enriched.push(r.value);
    else if (r.status === "rejected") console.warn("[enrich] failed:", r.reason);
  }
  return enriched;
}

async function enrichSingle(
  openai: OpenAI,
  candidate: DiscoveredPlace,
): Promise<EnrichedPlace | null> {
  const query = `${candidate.name} ${candidate.city} Florida reviews rating address hours`;
  const format = zodTextFormat(EnrichedPlaceSchema, "enrichedPlace");
  const startMs = Date.now();

  try {
    const response = await openai.responses.parse({
      model: DEFAULT_MODEL,
      tools: [{ type: "web_search_preview" }],
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Search for detailed info about: ${query}`,
            "",
            `Known data:`,
            `Name: ${candidate.name}`,
            candidate.address ? `Address: ${candidate.address}` : null,
            candidate.websiteUrl ? `Website: ${candidate.websiteUrl}` : null,
            candidate.description ? `Description: ${candidate.description}` : null,
            "",
            `Extract the most complete and accurate details from search results.`,
          ].filter(Boolean).join("\n"),
        },
      ],
      text: { format },
    });

    const parsed = response.output_parsed;
    if (!parsed) return null;

    logAiUsage({
      feature: "extract_place",
      model: DEFAULT_MODEL,
      usage: response.usage,
      latencyMs: Date.now() - startMs,
      success: true,
      meta: { stage: "enrich", name: candidate.name, city: candidate.cityKey },
    });

    return { ...candidate, ...parsed };
  } catch (err) {
    logAiUsage({
      feature: "extract_place",
      model: DEFAULT_MODEL,
      usage: null,
      latencyMs: Date.now() - startMs,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      meta: { stage: "enrich", name: candidate.name, city: candidate.cityKey },
    });
    return null;
  }
}
