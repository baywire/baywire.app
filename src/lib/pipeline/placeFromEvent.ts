import crypto from "node:crypto";

import { Prisma } from "@/prisma/client";
import { prisma } from "@/lib/db/client";
import type { CityKey } from "@/lib/cities";
import type { PlaceCategoryValue } from "@/lib/extract/schemaPlace";

const JUNK_VENUE_NAMES = new Set([
  "tba",
  "tbd",
  "online",
  "online event",
  "virtual",
  "virtual event",
  "various locations",
  "various",
  "private location",
  "private",
  "private residence",
  "zoom",
  "livestream",
  "live stream",
  "webinar",
  "to be announced",
  "undisclosed",
  "undisclosed location",
  "see description",
]);

const CATEGORY_SIGNALS: Array<{ matchers: RegExp[]; category: PlaceCategoryValue }> = [
  { matchers: [/\bbrew(ery|pub)\b/i, /\btaproom\b/i], category: "brewery" },
  { matchers: [/\bcaf[eé]\b/i, /\bcoffee\b/i], category: "cafe" },
  { matchers: [/\bbaker(y|ies)\b/i], category: "bakery" },
  { matchers: [/\bmuseum\b/i], category: "museum" },
  { matchers: [/\bgaller(y|ies)\b/i], category: "gallery" },
  { matchers: [/\bpark\b/i, /\bgardens?\b/i, /\bpreserve\b/i], category: "park" },
  { matchers: [/\bbeach\b/i, /\bpier\b/i], category: "beach" },
  { matchers: [/\b(bar|pub|tavern|saloon|lounge)\b/i], category: "bar" },
  { matchers: [/\b(grill|kitchen|bistro|eatery|diner|restaurant)\b/i], category: "restaurant" },
];

/**
 * Upserts a Place row from the venue info already present on an event.
 * Filters junk names, infers category from event tags + venue name,
 * and merges-up (never overwrites rich data with null).
 *
 * Returns the place ID for downstream canonical resolution, or null
 * if the venue was filtered out.
 */
export async function upsertPlaceFromEvent(
  sourceId: string,
  row: Prisma.EventUncheckedCreateInput,
): Promise<string | null> {
  const venueName = typeof row.venueName === "string" ? row.venueName.trim() : null;
  if (!venueName || venueName.length < 2) return null;
  if (JUNK_VENUE_NAMES.has(venueName.toLowerCase())) return null;

  const slug = slugify(venueName);
  if (!slug) return null;

  const sourcePlaceId = `venue:${slug}`;
  const address = typeof row.address === "string" ? row.address.trim() || null : null;
  const city = (row.city ?? "other") as CityKey;
  const imageUrl = typeof row.imageUrl === "string" ? row.imageUrl : null;
  const categories = Array.isArray(row.categories) ? (row.categories as string[]) : [];
  const category = inferCategory(venueName, categories);
  const contentHash = sha256(`${venueName}|${address ?? ""}`);
  const now = new Date();

  const existing = await prisma.place.findUnique({
    where: { sourceId_sourcePlaceId: { sourceId, sourcePlaceId } },
    select: { id: true, imageUrl: true, address: true, category: true },
  });

  if (existing) {
    await prisma.place.update({
      where: { id: existing.id },
      data: {
        name: venueName.slice(0, 200),
        address: address ?? existing.address,
        city,
        imageUrl: imageUrl ?? existing.imageUrl,
        category: category !== "venue" ? category : existing.category,
        contentHash,
        lastSeenAt: now,
        eventCount: { increment: 1 },
        lastEventAt: now,
      },
    });
    return existing.id;
  }

  const created = await prisma.place.create({
    data: {
      sourceId,
      sourcePlaceId,
      name: venueName.slice(0, 200),
      slug,
      description: null,
      category,
      city,
      address,
      lat: null,
      lng: null,
      imageUrl,
      websiteUrl: null,
      phoneNumber: null,
      priceRange: null,
      hoursJson: Prisma.DbNull,
      sourceUrl: "",
      contentHash,
      eventCount: 1,
      lastEventAt: now,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Infers place category from the venue name itself and the event's category
 * tags. Venue name signals (e.g. "brewery" in the name) take priority, then
 * event tags are checked. Falls back to "venue" if nothing matches.
 */
function inferCategory(venueName: string, eventCategories: string[]): PlaceCategoryValue {
  for (const { matchers, category } of CATEGORY_SIGNALS) {
    if (matchers.some((m) => m.test(venueName))) return category;
  }

  const tags = new Set(eventCategories.map((c) => c.toLowerCase()));
  if (tags.has("food") || tags.has("dining")) return "restaurant";
  if (tags.has("beer") || tags.has("brewery")) return "brewery";
  if (tags.has("art") || tags.has("gallery")) return "gallery";
  if (tags.has("museum")) return "museum";
  if (tags.has("outdoors") || tags.has("nature")) return "park";
  if (tags.has("nightlife")) return "bar";

  return "venue";
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
