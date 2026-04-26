import crypto from "node:crypto";

import pLimit from "p-limit";

import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";
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
            if (result === "inserted") stats.inserted += 1;
            else if (result === "updated") stats.updated += 1;
            else stats.skipped += 1;
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

async function processItem(args: ProcessArgs): Promise<ProcessOutcome> {
  const { adapter, sourceId, item, signal } = args;

  const fetched = await adapter.fetchAndReduce(item, signal);
  const reducedHtml = fetched.reducedHtml;
  if (!reducedHtml || reducedHtml.length < 200) return "skipped";

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
    return "skipped";
  }

  const extraction = await extractEvent({
    sourceLabel: adapter.label,
    url: fetched.canonicalUrl,
    reducedHtml,
  });

  if (!extraction.isEvent || !extraction.event) return "skipped";

  const normalized = normalizeExtractedEvent({
    sourceId,
    sourceEventId: item.sourceEventId,
    eventUrl: fetched.canonicalUrl,
    contentHash,
    extracted: extraction.event,
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

  const data: Prisma.EventUncheckedCreateInput = normalized.row;

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
