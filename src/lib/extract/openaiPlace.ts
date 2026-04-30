import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { PlaceExtractionResultSchema, type PlaceExtractionResult } from "./schemaPlace";
import { PLACE_EXTRACTION_SYSTEM_PROMPT, buildPlaceUserPrompt } from "./promptsPlace";
import { logAiUsage } from "./ai-usage";

const DEFAULT_MODEL = process.env.OPENAI_EXTRACT_MODEL ?? "gpt-4.1-mini";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  client = new OpenAI({ apiKey, baseURL });
  return client;
}

export interface PlaceExtractInput {
  sourceLabel: string;
  url: string;
  reducedHtml: string;
  scrapeRunId?: string;
}

const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

export async function extractPlace(input: PlaceExtractInput): Promise<PlaceExtractionResult> {
  const user = buildPlaceUserPrompt({
    sourceLabel: input.sourceLabel,
    url: input.url,
    reducedHtml: input.reducedHtml,
  });

  const openai = getClient();
  const format = zodTextFormat(PlaceExtractionResultSchema, "placeExtraction");
  const startMs = Date.now();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await openai.responses.parse({
        model: DEFAULT_MODEL,
        input: [
          { role: "system", content: PLACE_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
        text: { format },
      });

      const parsed = response.output_parsed;
      if (!parsed) throw new Error("OpenAI returned no parsed output");
      logAiUsage({
        feature: "extract_place",
        model: DEFAULT_MODEL,
        usage: response.usage,
        latencyMs: Date.now() - startMs,
        success: true,
        scrapeRunId: input.scrapeRunId,
        meta: { url: input.url },
      });
      return PlaceExtractionResultSchema.parse(parsed);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === 2) break;
      await sleep(500 * Math.pow(2, attempt));
    }
  }

  logAiUsage({
    feature: "extract_place",
    model: DEFAULT_MODEL,
    usage: null,
    latencyMs: Date.now() - startMs,
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    scrapeRunId: input.scrapeRunId,
    meta: { url: input.url },
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
