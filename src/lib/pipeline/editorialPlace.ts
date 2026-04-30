import crypto from "node:crypto";

import type { Prisma } from "@/prisma/client";
import type { AppPrismaClient } from "@/lib/db/client";
import { curateCanonicalPlace } from "@/lib/extract/editorialPlace";
import { cleanInlineText, stripHtmlToText } from "@/lib/scrapers/text";

type PlaceWithSource = Prisma.PlaceGetPayload<{
  include: { source: { select: { slug: true } } };
}> & { eventCount?: number };

export async function refreshEditorialForCanonicalPlace(
  tx: Pick<AppPrismaClient, "canonicalPlace">,
  canonicalID: string,
  places: PlaceWithSource[],
  primary: PlaceWithSource,
): Promise<void> {
  const hash = hashEditorialInput(places);
  const canonical = await tx.canonicalPlace.findUnique({
    where: { id: canonicalID },
    select: { editorialHash: true },
  });
  if (canonical?.editorialHash === hash) return;

  const names = uniqueCompact(places.map((p) => cleanInlineText(p.name))).slice(0, 8);
  const descriptions = uniqueCompact(
    places.map((p) => stripHtmlToText(p.description)).filter((v) => v.length >= 10),
  ).slice(0, 8);
  const sourceSlugs = uniqueCompact(places.map((p) => p.source.slug)).sort();

  const totalEventCount = places.reduce((sum, p) => sum + (p.eventCount ?? 0), 0);
  const fallback = buildFallback(primary, totalEventCount);

  try {
    if (!process.env.OPENAI_API_KEY) {
      await tx.canonicalPlace.update({
        where: { id: canonicalID },
        data: { ...fallback, editorialHash: hash, editorialUpdatedAt: new Date() },
      });
      return;
    }

    const curated = await curateCanonicalPlace({
      canonicalID,
      sourceSlugs,
      names,
      descriptions,
      category: primary.category,
      city: primary.city,
      address: primary.address,
      totalEventCount,
    });

    const finalScore = blendScore(curated.editorialScore, totalEventCount);

    await tx.canonicalPlace.update({
      where: { id: canonicalID },
      data: {
        dedupedName: curated.dedupedName,
        summary: curated.summary,
        vibes: uniqueCompact(curated.vibes).slice(0, 5),
        tags: uniqueCompact(curated.tags).slice(0, 6),
        whyItsCool: curated.whyItsCool,
        editorialScore: finalScore,
        editorialHash: hash,
        editorialUpdatedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(
      `[editorial-place] canonical=${canonicalID} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    await tx.canonicalPlace.update({
      where: { id: canonicalID },
      data: { ...fallback, editorialHash: hash, editorialUpdatedAt: new Date() },
    });
  }
}

function hashEditorialInput(places: PlaceWithSource[]): string {
  const stable = places
    .map((p) => ({
      sourceSlug: p.source.slug,
      name: cleanInlineText(p.name),
      description: stripHtmlToText(p.description),
    }))
    .sort((a, b) => {
      const s = a.sourceSlug.localeCompare(b.sourceSlug);
      return s !== 0 ? s : a.name.localeCompare(b.name);
    });
  return crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function uniqueCompact(input: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * Blends the LLM editorial score with an activity signal derived from
 * event count. Places that host many events get a boost; places with
 * no events get a slight penalty. The activity signal is capped and
 * logarithmic to avoid runaway scores from high-volume venues.
 */
function blendScore(llmScore: number, totalEventCount: number): number {
  if (totalEventCount <= 0) return llmScore * 0.8;
  // log2(eventCount) / log2(50) gives ~1.0 at 50 events, ~0.6 at 5 events
  const activitySignal = Math.min(1, Math.log2(totalEventCount + 1) / Math.log2(50));
  return Math.min(1, llmScore * 0.65 + activitySignal * 0.35);
}

function buildFallback(primary: PlaceWithSource, totalEventCount: number) {
  const summarySource = stripHtmlToText(primary.description) || cleanInlineText(primary.name);
  const summary = summarySource.length > 200 ? `${summarySource.slice(0, 197)}...` : summarySource;
  const baseScore = blendScore(0.5, totalEventCount);
  return {
    dedupedName: cleanInlineText(primary.name).slice(0, 200),
    summary,
    vibes: [] as string[],
    tags: [primary.category],
    whyItsCool: null as string | null,
    editorialScore: baseScore,
  };
}
