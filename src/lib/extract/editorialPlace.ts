import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { logAiUsage } from "./ai-usage";

const DEFAULT_MODEL =
  process.env.OPENAI_EDITORIAL_MODEL ?? process.env.OPENAI_EXTRACT_MODEL ?? "gpt-4.1-mini";
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

const VIBE_VALUES = [
  "dog_friendly",
  "outdoor_seating",
  "kid_friendly",
  "family",
  "late_night",
  "romantic",
  "hidden_gem",
  "waterfront",
  "live_music",
  "craft_beer",
  "brunch",
  "vegan_friendly",
  "pet_friendly",
  "scenic_views",
] as const;

const PlaceEditorialResultSchema = z.object({
  summary: z.string().min(1).max(200),
  vibes: z.array(z.enum(VIBE_VALUES)).min(1).max(5),
  tags: z.array(z.string().min(1).max(30)).min(1).max(6),
  whyItsCool: z.string().max(200).nullable(),
  editorialScore: z.number().min(0).max(1),
});

export type PlaceEditorialResult = z.infer<typeof PlaceEditorialResultSchema>;

export interface PlaceEditorialInput {
  placeID: string;
  name: string;
  description: string | null;
  category: string;
  city: string;
  address: string | null;
  webRating: number | null;
  webReviewCount: number | null;
}

const EDITORIAL_SYSTEM_PROMPT = `You are the Baywire editorial curation pass for local places (restaurants, bars, breweries, beaches, etc.) in the Tampa Bay area.

Rules:
- Use only information present in the provided data.
- Write concise, natural copy. No fluff.
- summary must be one or two sentences, <= 200 chars.
- tags should describe cuisine, specialty, or notable features (e.g. "seafood", "cocktails", "rooftop", "brunch").
- vibes must include 1-5 values from the provided vibe enum.
- whyItsCool is optional and only for distinctive places.
- editorialScore: 1.0 = must-visit destination, 0.0 = generic or low-interest.
- If web rating and review count are provided, factor them into the score. High ratings with many reviews indicate popular, well-regarded spots.
- Places with ratings above 4.5 and 100+ reviews are strong candidates for higher scores.`;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  client = new OpenAI({ apiKey, baseURL });
  return client;
}

export async function curatePlaceEditorial(
  input: PlaceEditorialInput,
): Promise<PlaceEditorialResult> {
  const openai = getClient();
  const format = zodTextFormat(PlaceEditorialResultSchema, "placeEditorial");

  const userContent = [
    `Place: ${input.name}`,
    `Category: ${input.category}`,
    `City: ${input.city}`,
    input.address ? `Address: ${input.address}` : null,
    input.description ? `Description: ${input.description}` : null,
    input.webRating != null ? `Web Rating: ${input.webRating}/5` : null,
    input.webReviewCount != null ? `Review Count: ${input.webReviewCount}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const startMs = Date.now();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await openai.responses.parse({
        model: DEFAULT_MODEL,
        input: [
          { role: "system", content: EDITORIAL_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        text: { format },
      });
      const parsed = response.output_parsed;
      if (!parsed) throw new Error("OpenAI returned no parsed output");
      logAiUsage({
        feature: "editorial_place",
        model: DEFAULT_MODEL,
        usage: response.usage,
        latencyMs: Date.now() - startMs,
        success: true,
        meta: { placeID: input.placeID },
      });
      return PlaceEditorialResultSchema.parse(parsed);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === 2) break;
      await sleep(500 * Math.pow(2, attempt));
    }
  }

  logAiUsage({
    feature: "editorial_place",
    model: DEFAULT_MODEL,
    usage: null,
    latencyMs: Date.now() - startMs,
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    meta: { placeID: input.placeID },
  });
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function isRetryable(err: unknown): boolean {
  if (err instanceof z.ZodError) return false;
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status?: number }).status;
    return typeof status === "number" && RETRYABLE_STATUSES.has(status);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
