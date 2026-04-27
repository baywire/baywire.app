import crypto from "node:crypto";

import pLimit from "p-limit";

import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";
import type { ExtractedEvent } from "@/lib/extract/schema";
import { extractEvent } from "@/lib/extract/openai";
import { ADAPTERS, getAdapter } from "@/lib/scrapers";
import type { SourceAdapter } from "@/lib/scrapers";
import { getScrapeWindow, overlapsWindow } from "@/lib/time/window";

import { normalizeExtractedEvent } from "./normalize";

const EXTRACTION_CONCURRENCY = 4;
const MAX_EVENTS_PER_SOURCE = 60;

export interface SourceStats {
  slug: string;
  label: string;
  ok: boolean;
  seen: number;
  inserted: number;
  updated: number;
  skipped: number;
  /** How many items were resolved without an LLM call. */
  structuredHits: number;
  error?: string;
  durationMs: number;
}

export interface RunOptions {
  /** Restrict the run to a single source slug. */
  only?: string;
  signal?: AbortSignal;
}

export async function runScrape(opts: RunOptions = {}): Promise<SourceStats[]> {
  const targets: SourceAdapter[] = opts.only
    ? [getAdapter(opts.only)].filter((a): a is SourceAdapter => Boolean(a))
    : Array.from(ADAPTERS);

  if (targets.length === 0) return [];

  const settled = await Promise.allSettled(
    targets.map((adapter) => runSingleSource(adapter, opts.signal)),
  );

  return settled.map((res, idx) => {
    if (res.status === "fulfilled") return res.value;
    const adapter = targets[idx];
    return {
      slug: adapter.slug,
      label: adapter.label,
      ok: false,
      seen: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      structuredHits: 0,
      error: res.reason instanceof Error ? res.reason.message : String(res.reason),
      durationMs: 0,
    } satisfies SourceStats;
  });
}

async function runSingleSource(
  adapter: SourceAdapter,
  signal: AbortSignal | undefined,
): Promise<SourceStats> {
  const startedAt = Date.now();
  const window = getScrapeWindow();
  const sourceRow = await ensureSource(adapter);

  const run = await prisma.scrapeRun.create({
    data: { sourceId: sourceRow.id },
    select: { id: true },
  });

  const stats = {
    slug: adapter.slug,
    label: adapter.label,
    ok: true,
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    structuredHits: 0,
    durationMs: 0,
    error: undefined as string | undefined,
  };

  try {
    const items = await adapter.listEvents({
      windowStart: window.startAt,
      windowEnd: window.endAt,
      signal,
    });
    const limited = items.slice(0, MAX_EVENTS_PER_SOURCE);
    stats.seen = limited.length;

    const limit = pLimit(EXTRACTION_CONCURRENCY);

    await Promise.all(
      limited.map((item) =>
        limit(async () => {
          if (signal?.aborted) return;
          try {
            const result = await processItem({
              adapter,
              sourceId: sourceRow.id,
              item,
              windowStart: window.startAt,
              windowEnd: window.endAt,
              signal,
            });
            if (result.outcome === "inserted") stats.inserted += 1;
            else if (result.outcome === "updated") stats.updated += 1;
            else stats.skipped += 1;
            if (result.structured) stats.structuredHits += 1;
          } catch (err) {
            stats.skipped += 1;
            console.warn(
              `[${adapter.slug}] failed for ${item.url}:`,
              err instanceof Error ? err.message : err,
            );
          }
        }),
      ),
    );
  } catch (err) {
    stats.ok = false;
    stats.error = err instanceof Error ? err.message : String(err);
  }

  stats.durationMs = Date.now() - startedAt;

  await prisma.scrapeRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      eventsSeen: stats.seen,
      eventsInserted: stats.inserted,
      eventsUpdated: stats.updated,
      eventsSkipped: stats.skipped,
      error: stats.error ?? null,
    },
  });

  await prisma.source.update({
    where: { id: sourceRow.id },
    data: {
      lastRunAt: new Date(),
      lastStatus: stats.ok ? "ok" : `error: ${stats.error ?? "unknown"}`,
    },
  });

  return stats;
}

async function ensureSource(adapter: SourceAdapter) {
  return prisma.source.upsert({
    where: { slug: adapter.slug },
    create: {
      slug: adapter.slug,
      label: adapter.label,
      baseUrl: adapter.baseUrl,
    },
    update: { label: adapter.label, baseUrl: adapter.baseUrl },
    select: { id: true },
  });
}

interface ProcessArgs {
  adapter: SourceAdapter;
  sourceId: string;
  item: { sourceEventId: string; url: string; hint?: string };
  windowStart: Date;
  windowEnd: Date;
  signal?: AbortSignal;
}

type ProcessOutcome = "inserted" | "updated" | "skipped";

interface ProcessResult {
  outcome: ProcessOutcome;
  structured: boolean;
}

async function processItem(args: ProcessArgs): Promise<ProcessResult> {
  const { adapter, sourceId, item, signal } = args;

  if (adapter.tryStructured) {
    try {
      const structured = await adapter.tryStructured(item, signal);
      if (structured) {
        const outcome = await persistStructured(args, structured.event, {
          canonicalUrl: structured.canonicalUrl ?? item.url,
          contentHash: structured.contentHash ?? hashStructured(structured.event),
        });
        return { outcome, structured: true };
      }
    } catch (err) {
      console.warn(
        `[${adapter.slug}] tryStructured failed for ${item.url}, falling back:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const fetched = await adapter.fetchAndReduce(item, signal);
  const reducedHtml = fetched.reducedHtml;
  if (!reducedHtml || reducedHtml.length < 200) {
    return { outcome: "skipped", structured: false };
  }

  const contentHash = sha256(reducedHtml);

  const existing = await prisma.event.findUnique({
    where: {
      sourceId_sourceEventId: { sourceId, sourceEventId: item.sourceEventId },
    },
    select: { id: true, contentHash: true },
  });

  if (existing && existing.contentHash === contentHash) {
    await prisma.event.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    return { outcome: "skipped", structured: false };
  }

  const extraction = await extractEvent({
    sourceLabel: adapter.label,
    url: fetched.canonicalUrl,
    reducedHtml,
  });

  if (!extraction.isEvent || !extraction.event) {
    return { outcome: "skipped", structured: false };
  }

  const normalized = normalizeExtractedEvent({
    sourceId,
    sourceEventId: item.sourceEventId,
    eventUrl: fetched.canonicalUrl,
    contentHash,
    extracted: extraction.event,
  });
  if (!normalized.ok) return { outcome: "skipped", structured: false };

  if (
    !overlapsWindow(
      normalized.row.startAt,
      normalized.row.endAt ?? null,
      args.windowStart,
      args.windowEnd,
    )
  ) {
    return { outcome: "skipped", structured: false };
  }

  const data: Prisma.EventUncheckedCreateInput = normalized.row;
  return {
    outcome: await writeEvent(sourceId, item.sourceEventId, data, existing),
    structured: false,
  };
}

interface PersistOpts {
  canonicalUrl: string;
  contentHash: string;
}

async function persistStructured(
  args: ProcessArgs,
  extracted: ExtractedEvent,
  opts: PersistOpts,
): Promise<ProcessOutcome> {
  const { sourceId, item } = args;

  const existing = await prisma.event.findUnique({
    where: {
      sourceId_sourceEventId: { sourceId, sourceEventId: item.sourceEventId },
    },
    select: { id: true, contentHash: true },
  });

  if (existing && existing.contentHash === opts.contentHash) {
    await prisma.event.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    return "skipped";
  }

  const normalized = normalizeExtractedEvent({
    sourceId,
    sourceEventId: item.sourceEventId,
    eventUrl: opts.canonicalUrl,
    contentHash: opts.contentHash,
    extracted,
  });
  if (!normalized.ok) return "skipped";

  if (
    !overlapsWindow(
      normalized.row.startAt,
      normalized.row.endAt ?? null,
      args.windowStart,
      args.windowEnd,
    )
  ) {
    return "skipped";
  }

  return writeEvent(sourceId, item.sourceEventId, normalized.row, existing);
}

async function writeEvent(
  sourceId: string,
  sourceEventId: string,
  data: Prisma.EventUncheckedCreateInput,
  existing: { id: string } | null,
): Promise<ProcessOutcome> {
  if (existing) {
    await prisma.event.update({
      where: { id: existing.id },
      data: {
        ...stripIdentity(data),
        lastSeenAt: new Date(),
      },
    });
    return "updated";
  }

  await prisma.event.create({ data });
  void sourceId;
  void sourceEventId;
  return "inserted";
}

function stripIdentity(
  data: Prisma.EventUncheckedCreateInput,
): Omit<Prisma.EventUncheckedUpdateInput, "id"> {
  const { sourceId: _sid, sourceEventId: _seid, ...rest } = data;
  void _sid;
  void _seid;
  return rest;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Deterministic hash of a structured event payload for dedupe. Sorts keys at
 * every level so unrelated key-order changes do not invalidate the cache.
 */
function hashStructured(extracted: ExtractedEvent): string {
  return sha256(stableStringify(extracted));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${parts.join(",")}}`;
}
