import crypto from "node:crypto";

import pLimit from "p-limit";

import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/prisma/client";
import type { ExtractedPlace } from "@/lib/extract/schemaPlace";
import { extractPlace } from "@/lib/extract/openaiPlace";
import { PLACE_ADAPTERS, getPlaceAdapter } from "@/lib/scrapers/places";
import type { PlaceAdapter } from "@/lib/scrapers/places";
import { filterEnabledAdapters } from "@/lib/sources/enabled";

import { normalizeExtractedPlace } from "./normalizePlace";
import { resolveCanonicalPlaceForPlace } from "./canonicalPlace";

const EXTRACTION_CONCURRENCY = 4;
const MAX_PLACES_PER_SOURCE = 80;

export interface PlaceSourceStats {
  slug: string;
  label: string;
  ok: boolean;
  seen: number;
  inserted: number;
  updated: number;
  skipped: number;
  structuredHits: number;
  error?: string;
  durationMs: number;
}

export interface PlaceRunOptions {
  only?: string;
  signal?: AbortSignal;
}

export async function runPlaceScrape(opts: PlaceRunOptions = {}): Promise<PlaceSourceStats[]> {
  const targets: PlaceAdapter[] = opts.only
    ? [getPlaceAdapter(opts.only)].filter((a): a is PlaceAdapter => Boolean(a))
    : await defaultEnabledAdapters();

  if (targets.length === 0) return [];

  const settled = await Promise.allSettled(
    targets.map((adapter) => runSinglePlaceSource(adapter, opts.signal)),
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
    } satisfies PlaceSourceStats;
  });
}

async function defaultEnabledAdapters(): Promise<PlaceAdapter[]> {
  const adapters = Array.from(PLACE_ADAPTERS);
  if (adapters.length === 0) return [];
  const rows = await prisma.source.findMany({
    where: { slug: { in: adapters.map((a) => a.slug) } },
    select: { slug: true, enabled: true },
  });
  return filterEnabledAdapters(adapters, rows);
}

async function runSinglePlaceSource(
  adapter: PlaceAdapter,
  signal: AbortSignal | undefined,
): Promise<PlaceSourceStats> {
  const startedAt = Date.now();
  const sourceRow = await ensureSource(adapter);

  const stats: PlaceSourceStats = {
    slug: adapter.slug,
    label: adapter.label,
    ok: true,
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    structuredHits: 0,
    durationMs: 0,
    error: undefined,
  };

  console.log(`[places:start] slug=${adapter.slug} label="${adapter.label}"`);

  try {
    const listStart = Date.now();
    const items = await adapter.listPlaces({ signal });
    const limited = items.slice(0, MAX_PLACES_PER_SOURCE);
    stats.seen = limited.length;
    console.log(
      `[places:list] slug=${adapter.slug} found=${items.length} processing=${limited.length} ms=${Date.now() - listStart}`,
    );

    const limit = pLimit(EXTRACTION_CONCURRENCY);
    let llmHits = 0;
    let errors = 0;

    await Promise.all(
      limited.map((item) =>
        limit(async () => {
          if (signal?.aborted) return;
          const itemStart = Date.now();
          try {
            const result = await processPlaceItem({
              adapter,
              sourceId: sourceRow.id,
              item,
              signal,
            });
            if (result.outcome === "inserted") stats.inserted += 1;
            else if (result.outcome === "updated") stats.updated += 1;
            else stats.skipped += 1;
            if (result.structured) stats.structuredHits += 1;
            else llmHits += 1;
            console.log(
              `[place-item] slug=${adapter.slug} outcome=${result.outcome} path=${result.structured ? "structured" : "llm"} ms=${Date.now() - itemStart} url=${item.url}`,
            );
          } catch (err) {
            stats.skipped += 1;
            errors += 1;
            console.warn(
              `[place-item] slug=${adapter.slug} outcome=error ms=${Date.now() - itemStart} url=${item.url} error="${err instanceof Error ? err.message : String(err)}"`,
            );
          }
        }),
      ),
    );

    console.log(
      `[places:process] slug=${adapter.slug} structured=${stats.structuredHits} llm=${llmHits} errors=${errors}`,
    );
  } catch (err) {
    stats.ok = false;
    stats.error = err instanceof Error ? err.message : String(err);
    console.error(`[places:error] slug=${adapter.slug} error="${stats.error}"`);
  }

  stats.durationMs = Date.now() - startedAt;
  console.log(
    `[places:finish] slug=${adapter.slug} ok=${stats.ok} seen=${stats.seen} inserted=${stats.inserted} updated=${stats.updated} skipped=${stats.skipped} durationMs=${stats.durationMs}`,
  );

  await prisma.source.update({
    where: { id: sourceRow.id },
    data: {
      lastRunAt: new Date(),
      lastStatus: stats.ok ? "ok" : `error: ${stats.error ?? "unknown"}`,
    },
  });

  return stats;
}

async function ensureSource(adapter: PlaceAdapter) {
  return prisma.source.upsert({
    where: { slug: adapter.slug },
    create: { slug: adapter.slug, label: adapter.label, baseUrl: adapter.baseUrl },
    update: { label: adapter.label, baseUrl: adapter.baseUrl },
    select: { id: true },
  });
}

interface ProcessPlaceArgs {
  adapter: PlaceAdapter;
  sourceId: string;
  item: { sourcePlaceId: string; url: string; hint?: string };
  signal?: AbortSignal;
}

type ProcessOutcome = "inserted" | "updated" | "skipped";

async function processPlaceItem(
  args: ProcessPlaceArgs,
): Promise<{ outcome: ProcessOutcome; structured: boolean }> {
  const { adapter, sourceId, item, signal } = args;

  if (adapter.tryStructured) {
    try {
      const structured = await adapter.tryStructured(item, signal);
      if (structured) {
        const outcome = await persistStructuredPlace(args, structured.place, {
          canonicalUrl: structured.canonicalUrl ?? item.url,
          contentHash: structured.contentHash ?? hashStructured(structured.place),
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
  if (!fetched.reducedHtml || fetched.reducedHtml.length < 100) {
    return { outcome: "skipped", structured: false };
  }

  const contentHash = sha256(fetched.reducedHtml);

  const existing = await prisma.place.findUnique({
    where: { sourceId_sourcePlaceId: { sourceId, sourcePlaceId: item.sourcePlaceId } },
    select: { id: true, contentHash: true },
  });

  if (existing && existing.contentHash === contentHash) {
    await prisma.place.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    return { outcome: "skipped", structured: false };
  }

  const extraction = await extractPlace({
    sourceLabel: adapter.label,
    url: fetched.canonicalUrl,
    reducedHtml: fetched.reducedHtml,
  });

  if (!extraction.isPlace || !extraction.place) {
    return { outcome: "skipped", structured: false };
  }

  const normalized = normalizeExtractedPlace({
    sourceId,
    sourcePlaceId: item.sourcePlaceId,
    sourceUrl: fetched.canonicalUrl,
    contentHash,
    extracted: extraction.place,
  });
  if (!normalized.ok) return { outcome: "skipped", structured: false };

  const writeResult = await writePlace(sourceId, item.sourcePlaceId, normalized.row, existing);
  try {
    await resolveCanonicalPlaceForPlace(writeResult.placeID);
  } catch (err) {
    console.warn(
      `[canonical-place] slug=${adapter.slug} placeId=${writeResult.placeID} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return { outcome: writeResult.outcome, structured: false };
}

async function persistStructuredPlace(
  args: ProcessPlaceArgs,
  extracted: ExtractedPlace,
  opts: { canonicalUrl: string; contentHash: string },
): Promise<ProcessOutcome> {
  const { sourceId, item } = args;

  const existing = await prisma.place.findUnique({
    where: { sourceId_sourcePlaceId: { sourceId, sourcePlaceId: item.sourcePlaceId } },
    select: { id: true, contentHash: true },
  });

  if (existing && existing.contentHash === opts.contentHash) {
    await prisma.place.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    return "skipped";
  }

  const normalized = normalizeExtractedPlace({
    sourceId,
    sourcePlaceId: item.sourcePlaceId,
    sourceUrl: opts.canonicalUrl,
    contentHash: opts.contentHash,
    extracted,
  });
  if (!normalized.ok) return "skipped";

  const writeResult = await writePlace(sourceId, item.sourcePlaceId, normalized.row, existing);
  try {
    await resolveCanonicalPlaceForPlace(writeResult.placeID);
  } catch (err) {
    console.warn(
      `[canonical-place] slug=${args.adapter.slug} placeId=${writeResult.placeID} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return writeResult.outcome;
}

async function writePlace(
  sourceId: string,
  sourcePlaceId: string,
  data: Prisma.PlaceUncheckedCreateInput,
  existing: { id: string } | null,
): Promise<{ outcome: ProcessOutcome; placeID: string }> {
  if (existing) {
    const { sourceId: _sid, sourcePlaceId: _spid, ...rest } = data;
    void _sid;
    void _spid;
    await prisma.place.update({
      where: { id: existing.id },
      data: { ...rest, lastSeenAt: new Date() },
    });
    return { outcome: "updated", placeID: existing.id };
  }

  const created = await prisma.place.create({ data, select: { id: true } });
  void sourceId;
  void sourcePlaceId;
  return { outcome: "inserted", placeID: created.id };
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hashStructured(extracted: ExtractedPlace): string {
  return sha256(stableStringify(extracted));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${parts.join(",")}}`;
}
