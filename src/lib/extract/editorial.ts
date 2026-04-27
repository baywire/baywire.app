import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const DEFAULT_MODEL = process.env.OPENAI_EDITORIAL_MODEL ?? process.env.OPENAI_EXTRACT_MODEL ?? "gpt-4.1-mini";
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

const VIBE_VALUES = [
  "family",
  "date_night",
  "chill",
  "high_energy",
  "cultural",
  "outdoorsy",
  "late_night",
  "educational",
] as const;

const AUDIENCE_VALUES = ["all_ages", "kids", "21_plus", "adults"] as const;
const INDOOR_OUTDOOR_VALUES = ["indoor", "outdoor", "both"] as const;

const EditorialResultSchema = z.object({
  summary: z.string().min(1).max(140),
  dedupedTitle: z.string().min(1).max(120),
  vibes: z.array(z.enum(VIBE_VALUES)).min(1).max(2),
  audience: z.enum(AUDIENCE_VALUES),
  indoorOutdoor: z.enum(INDOOR_OUTDOOR_VALUES),
  tags: z.array(z.string().min(1).max(16)).min(1).max(4),
  whyItsCool: z.string().max(200).nullable(),
  editorialScore: z.number().min(0).max(1),
});

export type EditorialResult = z.infer<typeof EditorialResultSchema>;

export interface EditorialInput {
  canonicalID: string;
  sourceSlugs: string[];
  titles: string[];
  descriptions: string[];
  venueName: string | null;
  city: string;
  startAtIso: string;
  categoryHints: string[];
}

const EDITORIAL_SYSTEM_PROMPT = `You are the Baywire editorial curation pass.

Rules:
- You are curating one canonical local event from multiple source records.
- Use only information present in the provided source data.
- Write concise, natural copy. No fluff. Avoid phrases like "join us for".
- summary must be one sentence, <= 140 chars.
- dedupedTitle should be the cleanest canonical title across variants.
- tags must come only from this set: music, food, drinks, family, outdoors, sports, art, theater, comedy, nightlife, festival, market, wellness, education, free, holiday, film.
- vibes must include 1-2 values from the provided vibe enum.
- whyItsCool is optional and only for distinctive events.
- editorialScore is a ranking score where 1.0 is a standout event and 0 is low-priority filler.`;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  client = new OpenAI({ apiKey, baseURL });
  return client;
}

export async function curateCanonicalEvent(input: EditorialInput): Promise<EditorialResult> {
  const openai = getClient();
  const format = zodTextFormat(EditorialResultSchema, "editorial");
  const userPrompt = buildUserPrompt(input);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await openai.responses.parse({
        model: DEFAULT_MODEL,
        input: [
          { role: "system", content: EDITORIAL_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        text: { format },
      });
      const parsed = response.output_parsed;
      if (!parsed) throw new Error("OpenAI returned no parsed output");
      return EditorialResultSchema.parse(parsed);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === 2) break;
      await sleep(500 * Math.pow(2, attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildUserPrompt(input: EditorialInput): string {
  const safeDescriptions = input.descriptions.length
    ? input.descriptions
    : ["(No description text provided by upstream sources.)"];
  return [
    `Canonical ID: ${input.canonicalID}`,
    `Source slugs: ${input.sourceSlugs.join(", ") || "(none)"}`,
    `Venue: ${input.venueName ?? "(unknown)"}`,
    `City: ${input.city}`,
    `Start (ISO): ${input.startAtIso}`,
    `Category hints: ${input.categoryHints.join(", ") || "(none)"}`,
    "",
    "Title variants:",
    ...input.titles.map((title, idx) => `${idx + 1}. ${title}`),
    "",
    "Source descriptions:",
    ...safeDescriptions.map((description, idx) => `${idx + 1}. ${description}`),
  ].join("\n");
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
