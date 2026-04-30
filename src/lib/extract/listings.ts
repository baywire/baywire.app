import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { logAiUsage } from "./ai-usage";

const DEFAULT_MODEL = process.env.OPENAI_EXTRACT_MODEL ?? "gpt-4.1-mini";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to your .env.local (see .env.example).",
    );
  }
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  client = new OpenAI({ apiKey, baseURL });
  return client;
}

const SYSTEM_PROMPT = `You extract event listing URLs from a web page.

Rules:
- Return ONLY absolute URLs that point to individual event detail pages.
- Do NOT return category/index pages, venue homepages, search result pages, or navigation links.
- Do NOT return duplicate URLs.
- Do NOT invent URLs — only extract URLs that appear in the provided HTML.
- Each URL should lead to a page describing a single event (concert, show, festival, class, etc.).
- If the page contains no individual event links, return an empty array.`;

const ListingResultSchema = z.object({
  urls: z
    .array(z.string())
    .describe("Absolute URLs pointing to individual event detail pages."),
});

type ListingResult = z.infer<typeof ListingResultSchema>;

const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);
const MAX_HTML_LENGTH = 24_000;

/**
 * Uses the LLM to extract individual event URLs from rendered listing HTML.
 * For JS-rendered calendars and SPAs where CSS selectors are fragile or
 * unknown, this gives reliable link discovery from any page structure.
 */
export async function extractListings(
  html: string,
  baseUrl: string,
  sourceLabel: string,
): Promise<string[]> {
  const truncated =
    html.length > MAX_HTML_LENGTH
      ? `${html.slice(0, MAX_HTML_LENGTH)}\n…[truncated]`
      : html;

  const userPrompt = `Source: ${sourceLabel}
Base URL: ${baseUrl}

Extract all individual event detail page URLs from the HTML below.

HTML:
"""
${truncated}
"""`;

  const openai = getClient();
  const format = zodTextFormat(ListingResultSchema, "listing_extraction");
  const startMs = Date.now();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await openai.responses.parse({
        model: DEFAULT_MODEL,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        text: { format },
      });

      const parsed = response.output_parsed;
      if (!parsed) throw new Error("OpenAI returned no parsed output");

      const result: ListingResult = ListingResultSchema.parse(parsed);

      // Absolutize and dedupe
      const seen = new Set<string>();
      const urls: string[] = [];
      for (const raw of result.urls) {
        let absolute: string;
        try {
          absolute = new URL(raw, baseUrl).toString();
        } catch {
          continue;
        }
        if (!seen.has(absolute)) {
          seen.add(absolute);
          urls.push(absolute);
        }
      }

      logAiUsage({
        feature: "extract_listings",
        model: DEFAULT_MODEL,
        usage: response.usage,
        latencyMs: Date.now() - startMs,
        success: true,
        meta: { baseUrl, sourceLabel, urlCount: urls.length },
      });
      return urls;
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === 2) break;
      await sleep(500 * Math.pow(2, attempt));
    }
  }

  logAiUsage({
    feature: "extract_listings",
    model: DEFAULT_MODEL,
    usage: null,
    latencyMs: Date.now() - startMs,
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    meta: { baseUrl, sourceLabel },
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
