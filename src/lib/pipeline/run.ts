import crypto from "node:crypto";

import pLimit from "p-limit";

import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/prisma/client";
import type { ExtractedEvent } from "@/lib/extract/schema";
import { extractEvent } from "@/lib/extract/openai";
import { ADAPTERS, getAdapter } from "@/lib/scrapers";
import type { SourceAdapter } from "@/lib/scrapers";
import { acquireBrowser, releaseBrowser } from "@/lib/scrapers/browser";
import { filterEnabledAdapters } from "@/lib/sources/enabled";
import { getScrapeWindow, overlapsWindow } from "@/lib/time/window";

import { normalizeExtractedEvent } from "./normalize";
import { resolveCanonicalEventForEvent } from "./canonical";
import { upsertPlaceFromEvent } from "./placeFromEvent";

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
    : await defaultEnabledAdapters();

  if (targets.length === 0) return [];

  // Launch browser if any target adapter requires it
  const needsBrowser = targets.some((a) => a.needsBrowser);
  if (needsBrowser) {
    try {
      await acquireBrowser();
    } catch (err) {
      console.warn(
        `[run] browser launch failed — browser-dependent sources will error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  try {
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
  } finally {
    if (needsBrowser) {
      await releaseBrowser().catch((err) => {
        console.warn(
          `[run] browser close failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }
}

async function defaultEnabledAdapters(): Promise<SourceAdapter[]> {
  const adapters = Array.from(ADAPTERS);
  if (adapters.length === 0) return [];
  const rows = await prisma.source.findMany({
    where: { slug: { in: adapters.map((adapter) => adapter.slug) } },
    select: { slug: true, enabled: true },
  });
  return filterEnabledAdapters(adapters, rows);
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

  console.log(
    `[run:start] slug=${adapter.slug} label="${adapter.label}" windowStart=${window.startAt.toISOString()} windowEnd=${window.endAt.toISOString()}`,
  );

  try {
    const listStart = Date.now();
    const items = await adapter.listEvents({
      windowStart: window.startAt,
      windowEnd: window.endAt,
      signal,
    });
    const limited = items.slice(0, MAX_EVENTS_PER_SOURCE);
    stats.seen = limited.length;
    console.log(
      `[run:list] slug=${adapter.slug} found=${items.length} processing=${limited.length} ms=${Date.now() - listStart
      }`,
    );

    if (items.length === 0) {
      console.warn(
        `[run:warn] slug=${adapter.slug} msg="list returned 0 events — possible WAF block or site change"`,
      );
    }

    const limit = pLimit(EXTRACTION_CONCURRENCY);
    let llmHits = 0;
    let errors = 0;

    await Promise.all(
      limited.map((item) =>
        limit(async () => {
          if (signal?.aborted) {
            stats.skipped += 1;
            console.log(`[item] slug=${adapter.slug} outcome=skipped reason=aborted url=${item.url}`);
            return;
          }
          const itemStart = Date.now();
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
            else llmHits += 1;
            const reasonSuffix = result.reason ? ` reason=${result.reason}` : "";
            console.log(
              `[item] slug=${adapter.slug} outcome=${result.outcome} path=${result.structured ? "structured" : "llm"
              }${reasonSuffix} ms=${Date.now() - itemStart} url=${item.url}`,
            );
          } catch (err) {
            stats.skipped += 1;
            errors += 1;
            console.warn(
              `[item] slug=${adapter.slug} outcome=error ms=${Date.now() - itemStart} url=${item.url
              } error="${err instanceof Error ? err.message : String(err)}"`,
            );
          }
        }),
      ),
    );

    console.log(
      `[run:process] slug=${adapter.slug} structured=${stats.structuredHits} llm=${llmHits} errors=${errors}`,
    );
  } catch (err) {
    stats.ok = false;
    stats.error = err instanceof Error ? err.message : String(err);
    console.error(
      `[run:error] slug=${adapter.slug} error="${stats.error}"`,
    );
  }

  stats.durationMs = Date.now() - startedAt;
  console.log(
    `[run:finish] slug=${adapter.slug} ok=${stats.ok} seen=${stats.seen} inserted=${stats.inserted} updated=${stats.updated} skipped=${stats.skipped} structuredHits=${stats.structuredHits} durationMs=${stats.durationMs}${stats.error ? ` error="${stats.error}"` : ""
    }`,
  );

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
type SkipReason = "hash_match" | "short_html" | "not_event" | "normalize_failed" | "out_of_window";

interface ProcessResult {
  outcome: ProcessOutcome;
  structured: boolean;
  reason?: SkipReason;
}

async function processItem(args: ProcessArgs): Promise<ProcessResult> {
  const { adapter, sourceId, item, signal } = args;

  if (adapter.tryStructured) {
    try {
      const structured = await adapter.tryStructured(item, signal);
      if (structured) {
        const persisted = await persistStructured(args, structured.event, {
          canonicalUrl: structured.canonicalUrl ?? item.url,
          contentHash: structured.contentHash ?? hashStructured(structured.event),
        });
        return { outcome: persisted.outcome, structured: true, reason: persisted.reason };
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
    return { outcome: "skipped", structured: false, reason: "short_html" };
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
    return { outcome: "skipped", structured: false, reason: "hash_match" };
  }

  const extraction = await extractEvent({
    sourceLabel: adapter.label,
    url: fetched.canonicalUrl,
    reducedHtml,
  });

  if (!extraction.isEvent || !extraction.event) {
    return { outcome: "skipped", structured: false, reason: "not_event" };
  }

  const normalized = normalizeExtractedEvent({
    sourceId,
    sourceEventId: item.sourceEventId,
    eventUrl: fetched.canonicalUrl,
    contentHash,
    extracted: extraction.event,
  });
  if (!normalized.ok) return { outcome: "skipped", structured: false, reason: "normalize_failed" };

  if (
    !overlapsWindow(
      normalized.row.startAt,
      normalized.row.endAt ?? null,
      args.windowStart,
      args.windowEnd,
    )
  ) {
    return { outcome: "skipped", structured: false, reason: "out_of_window" };
  }

  const data: Prisma.EventUncheckedCreateInput = normalized.row;
  const writeResult = await writeEvent(sourceId, item.sourceEventId, data, existing);
  try {
    await resolveCanonicalEventForEvent(writeResult.eventID);
  } catch (err) {
    console.warn(
      `[canonical] slug=${adapter.slug} eventId=${writeResult.eventID} failed: ${err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  await tryUpsertPlace(sourceId, data);
  return {
    outcome: writeResult.outcome,
    structured: false,
  };
}

interface PersistOpts {
  canonicalUrl: string;
  contentHash: string;
}

interface PersistResult {
  outcome: ProcessOutcome;
  reason?: SkipReason;
}

async function persistStructured(
  args: ProcessArgs,
  extracted: ExtractedEvent,
  opts: PersistOpts,
): Promise<PersistResult> {
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
    return { outcome: "skipped", reason: "hash_match" };
  }

  const normalized = normalizeExtractedEvent({
    sourceId,
    sourceEventId: item.sourceEventId,
    eventUrl: opts.canonicalUrl,
    contentHash: opts.contentHash,
    extracted,
  });
  if (!normalized.ok) return { outcome: "skipped", reason: "normalize_failed" };

  if (
    !overlapsWindow(
      normalized.row.startAt,
      normalized.row.endAt ?? null,
      args.windowStart,
      args.windowEnd,
    )
  ) {
    return { outcome: "skipped", reason: "out_of_window" };
  }

  const writeResult = await writeEvent(sourceId, item.sourceEventId, normalized.row, existing);
  try {
    await resolveCanonicalEventForEvent(writeResult.eventID);
  } catch (err) {
    console.warn(
      `[canonical] slug=${args.adapter.slug} eventId=${writeResult.eventID} failed: ${err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  await tryUpsertPlace(sourceId, normalized.row);
  return { outcome: writeResult.outcome };
}

async function writeEvent(
  sourceId: string,
  sourceEventId: string,
  data: Prisma.EventUncheckedCreateInput,
  existing: { id: string } | null,
): Promise<{ outcome: ProcessOutcome; eventID: string }> {
  if (existing) {
    await prisma.event.update({
      where: { id: existing.id },
      data: {
        ...stripIdentity(data),
        lastSeenAt: new Date(),
      },
    });
    return { outcome: "updated", eventID: existing.id };
  }

  const created = await prisma.event.create({
    data,
    select: { id: true },
  });
  void sourceId;
  void sourceEventId;
  return { outcome: "inserted", eventID: created.id };
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

async function tryUpsertPlace(
  sourceId: string,
  row: Prisma.EventUncheckedCreateInput,
): Promise<void> {
  try {
    await upsertPlaceFromEvent(sourceId, row);
  } catch (err) {
    console.warn(
      `[place-from-event] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
