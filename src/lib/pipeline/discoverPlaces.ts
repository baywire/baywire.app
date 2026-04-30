import crypto from "node:crypto";

import { Prisma } from "@/prisma/client";
import { prisma } from "@/lib/db/client";
import { PLACE_CATEGORIES, type PlaceCategoryValue } from "@/lib/extract/schemaPlace";
import type { CityKey } from "@/lib/cities";
import { isCityKey } from "@/lib/cities";
import { discoverPlaces, deduplicateCandidates, type SearchType, type DiscoverOptions, type DiscoveredPlace } from "@/lib/places/discover";
import { enrichPlaces, type EnrichedPlace } from "@/lib/places/enrich";
import { resolveImages } from "@/lib/places/images";
import { normalizePhone, normalizeHours, isPlausibleImageUrl } from "@/lib/places/normalize";
import { verifyPlaces, type VerifiedPlace } from "@/lib/places/overture";
import { refreshEditorialForPlace } from "./editorialPlace";

const DISCOVER_SOURCE_SLUG = "baywire_discover";

export interface DiscoverPipelineOptions {
  cities?: CityKey[];
  searchTypes?: SearchType[];
  concurrency?: number;
  skipEditorial?: boolean;
  /** Max new places per discovery query. Defaults to 15, set lower for incremental runs. */
  limitPerQuery?: number;
}

export interface DiscoverPipelineStats {
  existingPlaces: number;
  discovered: number;
  afterDedup: number;
  newCandidates: number;
  enriched: number;
  verified: number;
  upserted: number;
  skippedUnchanged: number;
  editorialized: number;
}

export async function runDiscoverPipeline(
  opts: DiscoverPipelineOptions = {},
): Promise<DiscoverPipelineStats> {
  const stats: DiscoverPipelineStats = {
    existingPlaces: 0,
    discovered: 0,
    afterDedup: 0,
    newCandidates: 0,
    enriched: 0,
    verified: 0,
    upserted: 0,
    skippedUnchanged: 0,
    editorialized: 0,
  };

  const source = await ensureDiscoverSource();

  // Load existing places for the target cities to pass as context
  const { existingByCity, existingHashesBySlug } = await loadExistingPlaces(
    source.id,
    opts.cities,
  );
  stats.existingPlaces = [...existingByCity.values()].reduce((sum, arr) => sum + arr.length, 0);
  console.log(`[discover] Loaded ${stats.existingPlaces} existing places from DB`);

  // Stage 1: Discovery — AI gets existing names so it focuses on new finds
  console.log("[discover] Stage 1: AI web search discovery...");
  const discoverOpts: DiscoverOptions = {
    cities: opts.cities,
    searchTypes: opts.searchTypes,
    concurrency: opts.concurrency ?? 3,
    existingByCity,
    limitPerQuery: opts.limitPerQuery,
  };
  const candidates = await discoverPlaces(discoverOpts);
  stats.discovered = candidates.length;
  console.log(`[discover] Found ${candidates.length} raw candidates`);

  const deduped = deduplicateCandidates(candidates);
  stats.afterDedup = deduped.length;
  console.log(`[discover] ${deduped.length} after dedup`);

  // Filter out candidates that match existing places by normalized name+city
  const newOnly = filterNewCandidates(deduped, existingByCity);
  stats.newCandidates = newOnly.length;
  console.log(`[discover] ${newOnly.length} genuinely new candidates (${deduped.length - newOnly.length} already known)`);

  if (newOnly.length === 0) {
    console.log("[discover] No new places found. Touching lastSeenAt on existing places.");
    await touchExistingPlaces(source.id);
    console.log("[discover] Pipeline complete:", stats);
    return stats;
  }

  // Stage 2: Enrichment — only for new candidates
  console.log("[discover] Stage 2: AI web search enrichment...");
  const enriched = await enrichPlaces(newOnly, { concurrency: opts.concurrency ?? 5 });
  stats.enriched = enriched.length;
  console.log(`[discover] ${enriched.length} enriched`);

  // Stage 2b: Resolve missing images via og:image from place websites
  const beforeImages = enriched.filter((p) => p.imageUrl).length;
  const withImages = await resolveImages(enriched, { concurrency: 10 });
  const afterImages = withImages.filter((p) => p.imageUrl).length;
  console.log(`[discover] og:image resolved ${afterImages - beforeImages} missing images (${afterImages}/${withImages.length} total)`);

  // Stage 3: Verification
  console.log("[discover] Stage 3: Overture Maps verification...");
  const verified = await verifyPlaces(withImages, { concurrency: opts.concurrency ?? 5 });
  stats.verified = verified.length;
  console.log(`[discover] ${verified.length} verified`);

  // Stage 4: Persist + Editorial
  console.log("[discover] Stage 4: Upserting and curating...");
  for (const place of verified) {
    try {
      const slug = generateSlug(place.name, place.cityKey);
      const newHash = hashContent(place);
      const existingHash = existingHashesBySlug.get(slug);

      // Skip enrichment/editorial entirely if content hasn't changed
      if (existingHash === newHash) {
        stats.skippedUnchanged++;
        await prisma.place.update({
          where: { sourceId_sourcePlaceId: { sourceId: source.id, sourcePlaceId: slug } },
          data: { lastSeenAt: new Date() },
        });
        continue;
      }

      const placeID = await upsertPlace(source.id, place);
      stats.upserted++;

      if (!opts.skipEditorial && process.env.OPENAI_API_KEY) {
        await refreshEditorialForPlace(placeID);
        stats.editorialized++;
      }
    } catch (err) {
      console.warn(`[discover] upsert failed for ${place.name}:`, err instanceof Error ? err.message : err);
    }
  }

  // Touch lastSeenAt on all existing places so they don't get pruned
  await touchExistingPlaces(source.id);

  console.log("[discover] Pipeline complete:", stats);
  return stats;
}

interface ExistingPlaceData {
  existingByCity: Map<string, string[]>;
  existingHashesBySlug: Map<string, string>;
}

async function loadExistingPlaces(
  sourceId: string,
  filterCities?: CityKey[],
): Promise<ExistingPlaceData> {
  const where: Record<string, unknown> = { sourceId };
  if (filterCities?.length) where.city = { in: filterCities };

  const rows = await prisma.place.findMany({
    where,
    select: { name: true, city: true, sourcePlaceId: true, contentHash: true },
  });

  const byCity = new Map<string, string[]>();
  const bySlug = new Map<string, string>();
  for (const row of rows) {
    const city = row.city as string;
    const existing = byCity.get(city);
    if (existing) existing.push(row.name);
    else byCity.set(city, [row.name]);
    bySlug.set(row.sourcePlaceId, row.contentHash);
  }

  return { existingByCity: byCity, existingHashesBySlug: bySlug };
}

function filterNewCandidates(
  candidates: DiscoveredPlace[],
  existingByCity: Map<string, string[]>,
): DiscoveredPlace[] {
  const normalizedSets = new Map<string, Set<string>>();
  for (const [city, names] of existingByCity) {
    normalizedSets.set(city, new Set(names.map(normalizeName)));
  }

  return candidates.filter((c) => {
    const citySet = normalizedSets.get(c.cityKey);
    if (!citySet) return true;
    return !citySet.has(normalizeName(c.name));
  });
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

async function touchExistingPlaces(sourceId: string): Promise<void> {
  await prisma.place.updateMany({
    where: { sourceId },
    data: { lastSeenAt: new Date() },
  });
}

async function ensureDiscoverSource() {
  return prisma.source.upsert({
    where: { slug: DISCOVER_SOURCE_SLUG },
    create: {
      slug: DISCOVER_SOURCE_SLUG,
      label: "Baywire AI Discovery",
      baseUrl: "https://baywire.app",
      enabled: true,
    },
    update: { lastRunAt: new Date(), lastStatus: "running" },
  });
}

async function upsertPlace(sourceId: string, place: VerifiedPlace): Promise<string> {
  const slug = generateSlug(place.name, place.cityKey);
  const category = resolveCategory(place.category, place.searchType);
  const cityKey = resolveCityKey(place.cityKey);
  const contentHash = hashContent(place);
  const sourceUrl = place.websiteUrl ?? `https://baywire.app/place/${slug}`;

  const normalizedHours = normalizeHours(place.hoursJson);
  const imageUrl = isPlausibleImageUrl(place.imageUrl) ? place.imageUrl : null;

  const data = {
    name: place.name,
    slug,
    description: place.description,
    category,
    city: cityKey,
    address: place.overtureAddress ?? place.address,
    lat: place.lat,
    lng: place.lng,
    imageUrl,
    websiteUrl: place.websiteUrl,
    phoneNumber: normalizePhone(place.phoneNumber),
    priceRange: place.priceRange,
    hoursJson: normalizedHours ?? Prisma.JsonNull,
    sourceUrl,
    contentHash,
    searchType: place.searchType,
    overtureId: place.overtureId,
    verified: place.verified,
    webRating: place.webRating,
    webReviewCount: place.webReviewCount,
    lastSeenAt: new Date(),
  };

  const row = await prisma.place.upsert({
    where: {
      sourceId_sourcePlaceId: {
        sourceId,
        sourcePlaceId: slug,
      },
    },
    create: { sourceId, sourcePlaceId: slug, ...data },
    update: data,
    select: { id: true },
  });

  return row.id;
}

function generateSlug(name: string, city: string): string {
  const base = `${name}-${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "place";
}

function resolveCategory(raw: string, searchType: string): PlaceCategoryValue {
  const lower = raw.toLowerCase();
  for (const cat of PLACE_CATEGORIES) {
    if (lower === cat || lower.includes(cat)) return cat;
  }

  const typeMap: Record<string, PlaceCategoryValue> = {
    beaches: "beach",
    bars: "bar",
    restaurants: "restaurant",
    breweries: "brewery",
    hidden_gems: "attraction",
    live_music: "venue",
  };
  return typeMap[searchType] ?? "other";
}

function resolveCityKey(key: string): CityKey {
  return isCityKey(key) ? key : "other";
}

function hashContent(place: VerifiedPlace): string {
  const stable = {
    name: place.name,
    city: place.cityKey,
    address: place.address,
    webRating: place.webRating,
    webReviewCount: place.webReviewCount,
  };
  return crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}
