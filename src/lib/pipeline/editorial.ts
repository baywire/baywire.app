import crypto from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { AppPrismaClient } from "@/lib/db/client";
import { curateCanonicalEvent } from "@/lib/extract/editorial";
import { normalizeCategoryTags } from "@/lib/events/tagCanonical";
import { cleanInlineText, stripHtmlToText } from "@/lib/scrapers/text";

type EventWithSource = Prisma.EventGetPayload<{
  include: { source: { select: { slug: true } } };
}>;

export async function refreshEditorialForCanonical(
  tx: Pick<AppPrismaClient, "canonicalEvent">,
  canonicalID: string,
  events: EventWithSource[],
  primary: EventWithSource,
): Promise<void> {
  const hash = hashEditorialInput(events);
  const canonical = await tx.canonicalEvent.findUnique({
    where: { id: canonicalID },
    select: { editorialHash: true },
  });
  if (canonical?.editorialHash === hash) return;

  const titles = uniqueCompact(events.map((event) => cleanInlineText(event.title))).slice(0, 8);
  const descriptions = uniqueCompact(
    events
      .map((event) => stripHtmlToText(event.description))
      .filter((value) => value.length >= 20),
  ).slice(0, 8);
  const sourceSlugs = uniqueCompact(events.map((event) => event.source.slug)).sort((a, b) =>
    a.localeCompare(b),
  );
  const categoryHints = uniqueCompact(events.flatMap((event) => event.categories)).slice(0, 8);

  const fallback = buildFallbackEditorial(primary, categoryHints);

  try {
    if (!process.env.OPENAI_API_KEY) {
      await tx.canonicalEvent.update({
        where: { id: canonicalID },
        data: {
          dedupedTitle: fallback.dedupedTitle,
          summary: fallback.summary,
          vibes: fallback.vibes,
          audience: fallback.audience,
          indoorOutdoor: fallback.indoorOutdoor,
          tags: fallback.tags,
          whyItsCool: fallback.whyItsCool,
          editorialScore: fallback.editorialScore,
          editorialHash: hash,
          editorialUpdatedAt: new Date(),
        },
      });
      return;
    }

    const curated = await curateCanonicalEvent({
      canonicalID,
      sourceSlugs,
      titles,
      descriptions,
      venueName: primary.venueName,
      city: primary.city,
      startAtIso: primary.startAt.toISOString(),
      categoryHints,
    });
    await tx.canonicalEvent.update({
      where: { id: canonicalID },
      data: {
        dedupedTitle: curated.dedupedTitle,
        summary: curated.summary,
        vibes: uniqueCompact(curated.vibes).slice(0, 2),
        audience: curated.audience,
        indoorOutdoor: curated.indoorOutdoor,
        tags: normalizeCategoryTags(curated.tags, 4),
        whyItsCool: curated.whyItsCool,
        editorialScore: curated.editorialScore,
        editorialHash: hash,
        editorialUpdatedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(
      `[editorial] canonical=${canonicalID} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    await tx.canonicalEvent.update({
      where: { id: canonicalID },
      data: {
        dedupedTitle: fallback.dedupedTitle,
        summary: fallback.summary,
        vibes: fallback.vibes,
        audience: fallback.audience,
        indoorOutdoor: fallback.indoorOutdoor,
        tags: fallback.tags,
        whyItsCool: fallback.whyItsCool,
        editorialScore: fallback.editorialScore,
        editorialHash: hash,
        editorialUpdatedAt: new Date(),
      },
    });
  }
}

export function hashEditorialInput(events: EventWithSource[]): string {
  const stable = events
    .map((event) => ({
      sourceSlug: event.source.slug,
      title: cleanInlineText(event.title),
      description: stripHtmlToText(event.description),
    }))
    .sort((a, b) => {
      const slugDiff = a.sourceSlug.localeCompare(b.sourceSlug);
      if (slugDiff !== 0) return slugDiff;
      return a.title.localeCompare(b.title);
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

function buildFallbackEditorial(primary: EventWithSource, categoryHints: string[]) {
  const summarySource = stripHtmlToText(primary.description) || cleanInlineText(primary.title);
  const summary = summarySource.length > 140 ? `${summarySource.slice(0, 137)}...` : summarySource;
  return {
    dedupedTitle: cleanInlineText(primary.title).slice(0, 120),
    summary,
    vibes: ["cultural"],
    audience: "all_ages",
    indoorOutdoor: "both",
    tags: normalizeCategoryTags(categoryHints.length > 0 ? categoryHints : primary.categories, 4),
    whyItsCool: null,
    editorialScore: 0.5,
  };
}
