import { prisma } from "@/lib/db/client";
import type { AiFeature, Prisma } from "@/prisma/client";

export type { AiFeature };

// Per-million-token rates (USD). Extend as models are added.
const COST_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini":      { input: 0.40,  output: 1.60 },
  "gpt-4.1-nano":      { input: 0.10,  output: 0.40 },
  "gpt-4.1":           { input: 2.00,  output: 8.00 },
  "gpt-4o-mini":       { input: 0.15,  output: 0.60 },
  "gpt-4o":            { input: 2.50,  output: 10.00 },
  "gpt-5.4-mini":      { input: 0.40,  output: 1.60 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = COST_PER_M_TOKENS[model];
  if (!rates) return 0;
  return (promptTokens * rates.input + completionTokens * rates.output) / 1_000_000;
}

export interface AiUsageParams {
  feature: AiFeature;
  model: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;
  latencyMs: number;
  success: boolean;
  error?: string;
  scrapeRunId?: string;
  meta?: Prisma.InputJsonValue;
}

export function logAiUsage(params: AiUsageParams): void {
  const promptTokens = params.usage?.input_tokens ?? 0;
  const completionTokens = params.usage?.output_tokens ?? 0;
  const totalTokens = params.usage?.total_tokens ?? promptTokens + completionTokens;

  prisma.aiUsage
    .create({
      data: {
        feature: params.feature,
        model: params.model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: estimateCost(params.model, promptTokens, completionTokens),
        latencyMs: params.latencyMs,
        success: params.success,
        error: params.error ?? null,
        scrapeRunId: params.scrapeRunId ?? null,
        meta: params.meta ?? undefined,
      },
    })
    .catch((err) => {
      console.warn(
        `[ai-usage] failed to log: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
}
