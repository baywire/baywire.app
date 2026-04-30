import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import type { AppEvent } from "@/lib/events/types";
import { logAiUsage } from "@/lib/extract/ai-usage";

const DEFAULT_MODEL = process.env.OPENAI_SEARCH_MODEL
  ?? process.env.OPENAI_EDITORIAL_MODEL
  ?? process.env.OPENAI_EXTRACT_MODEL
  ?? "gpt-4.1-mini";
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

const SearchAIRawSchema = z.object({
  intentLine: z.string().min(1).max(180).nullable(),
  aiPickIDs: z.array(z.string()).max(6),
  reasons: z.array(z.object({
    id: z.string(),
    reason: z.string().max(140),
  })).max(6).default([]),
});

export const SearchAIResultSchema = SearchAIRawSchema;

export interface SearchAIResult {
  intentLine: string | null;
  aiPickIDs: string[];
  reasonByID: Record<string, string>;
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  client = new OpenAI({ apiKey, baseURL });
  return client;
}

const SEARCH_SYSTEM_PROMPT = `You rank Tampa Bay events for search relevance.

Rules:
- Use only provided candidate events.
- Prioritize relevance to the query first, then editorial quality.
- Return up to 5 aiPickIDs from candidate IDs.
- reasons is an array of {id, reason} for the top picks. Only include IDs from aiPickIDs.
- intentLine is a concise interpretation of the query intent.
- Do not invent events.`;

export async function rerankWithAI(
  query: string,
  candidates: readonly AppEvent[],
): Promise<SearchAIResult> {
  const openai = getClient();
  const format = zodTextFormat(SearchAIResultSchema, "search");
  const userInput = buildUserPrompt(query, candidates);
  const startMs = Date.now();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await openai.responses.parse({
        model: DEFAULT_MODEL,
        input: [
          { role: "system", content: SEARCH_SYSTEM_PROMPT },
          { role: "user", content: userInput },
        ],
        text: { format },
      });
      const parsed = response.output_parsed;
      if (!parsed) throw new Error("OpenAI returned no parsed output");
      const raw = SearchAIRawSchema.parse(parsed);
      const reasonByID: Record<string, string> = {};
      for (const entry of raw.reasons) {
        if (entry.reason) reasonByID[entry.id] = entry.reason;
      }
      logAiUsage({
        feature: "search_rerank",
        model: DEFAULT_MODEL,
        usage: response.usage,
        latencyMs: Date.now() - startMs,
        success: true,
        meta: { query, candidateCount: candidates.length },
      });
      return { intentLine: raw.intentLine, aiPickIDs: raw.aiPickIDs, reasonByID };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === 2) break;
      await sleep(500 * Math.pow(2, attempt));
    }
  }

  logAiUsage({
    feature: "search_rerank",
    model: DEFAULT_MODEL,
    usage: null,
    latencyMs: Date.now() - startMs,
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    meta: { query, candidateCount: candidates.length },
  });
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildUserPrompt(query: string, candidates: readonly AppEvent[]): string {
  const rows = candidates.map((event) => ({
    id: event.id,
    title: event.title,
    summary: event.description ?? "",
    categories: event.categories,
    city: event.city,
    venueName: event.venueName ?? "",
    editorialScore: event.editorialScore ?? null,
    vibes: event.vibes ?? [],
    audience: event.audience ?? null,
  }));
  return JSON.stringify({ query, candidates: rows });
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
