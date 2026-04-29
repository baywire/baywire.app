import crypto from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import type { CityKey } from "@/lib/cities";

/**
 * Upserts a Place row from the venue info already present on an event.
 * Zero extra fetches — we just use venueName + address + city that the
 * event pipeline already extracted.
 */
export async function upsertPlaceFromEvent(
  sourceId: string,
  row: Prisma.EventUncheckedCreateInput,
): Promise<void> {
  const venueName = typeof row.venueName === "string" ? row.venueName.trim() : null;
  if (!venueName || venueName.length < 2) return;

  const slug = slugify(venueName);
  if (!slug) return;
  const sourcePlaceId = `venue:${slug}`;
  const address = typeof row.address === "string" ? row.address.trim() || null : null;
  const city = (row.city ?? "other") as CityKey;
  const imageUrl = typeof row.imageUrl === "string" ? row.imageUrl : null;
  const eventUrl = typeof row.eventUrl === "string" ? row.eventUrl : "";
  const contentHash = sha256(`${venueName}|${address ?? ""}`);

  await prisma.place.upsert({
    where: { sourceId_sourcePlaceId: { sourceId, sourcePlaceId } },
    create: {
      sourceId,
      sourcePlaceId,
      name: venueName.slice(0, 200),
      slug,
      description: null,
      category: "venue",
      city,
      address,
      lat: null,
      lng: null,
      imageUrl,
      websiteUrl: null,
      phoneNumber: null,
      priceRange: null,
      hoursJson: Prisma.DbNull,
      sourceUrl: eventUrl,
      contentHash,
    },
    update: {
      name: venueName.slice(0, 200),
      address,
      city,
      imageUrl,
      sourceUrl: eventUrl,
      contentHash,
      lastSeenAt: new Date(),
    },
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
