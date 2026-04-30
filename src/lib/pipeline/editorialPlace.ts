import crypto from "node:crypto";

import { prisma } from "@/lib/db/client";
import { curatePlaceEditorial } from "@/lib/extract/editorialPlace";

export async function refreshEditorialForPlace(placeID: string): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeID },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      city: true,
      address: true,
      webRating: true,
      webReviewCount: true,
      editorialHash: true,
    },
  });
  if (!place) return;

  const hash = hashEditorialInput(place);
  if (place.editorialHash === hash) return;

  const fallback = buildFallback(place);

  try {
    if (!process.env.OPENAI_API_KEY) {
      await prisma.place.update({
        where: { id: placeID },
        data: { ...fallback, editorialHash: hash, editorialUpdatedAt: new Date() },
      });
      return;
    }

    const curated = await curatePlaceEditorial({
      placeID: place.id,
      name: place.name,
      description: place.description,
      category: place.category,
      city: place.city,
      address: place.address,
      webRating: place.webRating,
      webReviewCount: place.webReviewCount,
    });

    const finalScore = blendScore(curated.editorialScore, place.webRating, place.webReviewCount);

    await prisma.place.update({
      where: { id: placeID },
      data: {
        summary: curated.summary,
        vibes: curated.vibes.slice(0, 5),
        tags: curated.tags.slice(0, 6),
        whyItsCool: curated.whyItsCool,
        editorialScore: finalScore,
        editorialHash: hash,
        editorialUpdatedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(
      `[editorial-place] place=${placeID} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    await prisma.place.update({
      where: { id: placeID },
      data: { ...fallback, editorialHash: hash, editorialUpdatedAt: new Date() },
    });
  }
}

function hashEditorialInput(place: {
  name: string;
  description: string | null;
  webRating: number | null;
  webReviewCount: number | null;
}): string {
  const stable = {
    name: place.name,
    description: place.description,
    webRating: place.webRating,
    webReviewCount: place.webReviewCount,
  };
  return crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function blendScore(
  llmScore: number,
  webRating: number | null,
  webReviewCount: number | null,
): number {
  if (!webRating) return llmScore * 0.85;
  const ratingSignal = webRating / 5;
  const reviewBoost = webReviewCount
    ? Math.min(1, Math.log2((webReviewCount ?? 0) + 1) / Math.log2(200))
    : 0;
  return Math.min(1, llmScore * 0.5 + ratingSignal * 0.35 + reviewBoost * 0.15);
}

function buildFallback(place: {
  name: string;
  description: string | null;
  category: string;
  webRating: number | null;
  webReviewCount: number | null;
}) {
  const summarySource = place.description ?? place.name;
  const summary = summarySource.length > 200 ? `${summarySource.slice(0, 197)}...` : summarySource;
  const baseScore = blendScore(0.5, place.webRating, place.webReviewCount);
  return {
    summary,
    vibes: [] as string[],
    tags: [place.category],
    whyItsCool: null as string | null,
    editorialScore: baseScore,
  };
}
