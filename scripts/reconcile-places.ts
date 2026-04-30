import "dotenv/config";

import pLimit from "p-limit";

import { Prisma } from "@/prisma/client";
import { prisma } from "../src/lib/db/client";
import { enrichPlaces } from "../src/lib/places/enrich";
import { resolveImages } from "../src/lib/places/images";
import {
  normalizePhone,
  normalizeHours,
  isPlausibleImageUrl,
  isValidTampaBayCoords,
} from "../src/lib/places/normalize";
import type { DiscoveredPlace } from "../src/lib/places/discover";
import type { SearchType } from "../src/lib/places/discover";
import { refreshEditorialForPlace } from "../src/lib/pipeline/editorialPlace";

const BATCH_SIZE = 50;

interface ReconcileStats {
  total: number;
  needsEnrich: number;
  enriched: number;
  imageResolved: number;
  phoneNormalized: number;
  hoursNormalized: number;
  coordsFixed: number;
  editorialRefreshed: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let skipEnrich = false;
  let skipEditorial = false;
  let limit: number | undefined;
  let concurrency = 5;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--skip-enrich") skipEnrich = true;
    else if (arg === "--skip-editorial") skipEditorial = true;
    else if (arg === "--limit" && args[i + 1]) {
      limit = Math.floor(Number(args[++i]));
    } else if (arg === "--concurrency" && args[i + 1]) {
      concurrency = Math.floor(Number(args[++i]));
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: reconcile-places [options]

Backfills missing data and normalizes existing place records.

Options:
  --dry-run           Report what would change without writing to DB
  --skip-enrich       Skip AI re-enrichment (only normalize existing data)
  --skip-editorial    Skip editorial refresh after enrichment
  --limit <n>         Max places to process (default: all)
  --concurrency <n>   Parallel AI calls (default: 5)
  --help, -h          Show this help`);
      process.exit(0);
    }
  }

  return { dryRun, skipEnrich, skipEditorial, limit, concurrency };
}

async function main() {
  const opts = parseArgs();
  const stats: ReconcileStats = {
    total: 0,
    needsEnrich: 0,
    enriched: 0,
    imageResolved: 0,
    phoneNormalized: 0,
    hoursNormalized: 0,
    coordsFixed: 0,
    editorialRefreshed: 0,
  };

  const places = await prisma.place.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      city: true,
      address: true,
      lat: true,
      lng: true,
      imageUrl: true,
      websiteUrl: true,
      phoneNumber: true,
      hoursJson: true,
      webRating: true,
      webReviewCount: true,
      searchType: true,
    },
    orderBy: { name: "asc" },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  stats.total = places.length;
  console.log(`[reconcile] Found ${places.length} places to process`);

  // Phase 1: Normalize phone numbers and hours on ALL places
  console.log("[reconcile] Phase 1: Normalizing phone numbers and hours...");
  for (const place of places) {
    const updates: Record<string, unknown> = {};

    const normalizedPhone = normalizePhone(place.phoneNumber);
    if (normalizedPhone !== place.phoneNumber) {
      updates.phoneNumber = normalizedPhone;
      stats.phoneNormalized++;
    }

    const normalizedHours = normalizeHours(place.hoursJson);
    const currentHours = place.hoursJson as string[] | null;
    if (JSON.stringify(normalizedHours) !== JSON.stringify(currentHours)) {
      updates.hoursJson = normalizedHours ?? Prisma.JsonNull;
      stats.hoursNormalized++;
    }

    // Clean up bad image URLs
    if (place.imageUrl && !isPlausibleImageUrl(place.imageUrl)) {
      updates.imageUrl = null;
    }

    if (Object.keys(updates).length > 0 && !opts.dryRun) {
      await prisma.place.update({ where: { id: place.id }, data: updates });
    }
  }
  console.log(`[reconcile] Normalized: ${stats.phoneNormalized} phones, ${stats.hoursNormalized} hours`);

  // Phase 2: Identify places needing re-enrichment
  const needsEnrich = places.filter((p) => {
    const missingCoords = !isValidTampaBayCoords(p.lat, p.lng);
    const missingImage = !p.imageUrl || !isPlausibleImageUrl(p.imageUrl);
    const missingAddress = !p.address;
    return missingCoords || missingImage || missingAddress;
  });

  stats.needsEnrich = needsEnrich.length;
  console.log(`[reconcile] ${needsEnrich.length} places need re-enrichment (missing coords/image/address)`);

  if (opts.skipEnrich || needsEnrich.length === 0) {
    console.log("[reconcile] Skipping AI re-enrichment");
    logStats(stats);
    return;
  }

  // Phase 3: Re-enrich in batches
  console.log("[reconcile] Phase 2: AI re-enrichment...");
  for (let i = 0; i < needsEnrich.length; i += BATCH_SIZE) {
    const batch = needsEnrich.slice(i, i + BATCH_SIZE);
    console.log(`[reconcile] Enriching batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} places)...`);

    const candidates: DiscoveredPlace[] = batch.map((p) => ({
      name: p.name,
      category: p.category,
      city: p.city,
      description: p.description,
      address: p.address,
      websiteUrl: p.websiteUrl,
      searchType: (p.searchType ?? "hidden_gems") as SearchType,
      cityKey: p.city as DiscoveredPlace["cityKey"],
    }));

    const enriched = await enrichPlaces(candidates, { concurrency: opts.concurrency });

    // Resolve images for enriched places still missing them
    const withImages = await resolveImages(enriched, { concurrency: 10 });

    if (opts.dryRun) {
      stats.enriched += withImages.length;
      continue;
    }

    for (let j = 0; j < withImages.length; j++) {
      const original = batch[j];
      const fresh = withImages[j];
      const updates: Record<string, unknown> = {};

      // Coords: prefer enriched lat/lng if original is missing/invalid
      if (!isValidTampaBayCoords(original.lat, original.lng)) {
        const enrichedLat = fresh.latitude;
        const enrichedLng = fresh.longitude;
        if (isValidTampaBayCoords(enrichedLat ?? null, enrichedLng ?? null)) {
          updates.lat = enrichedLat;
          updates.lng = enrichedLng;
          stats.coordsFixed++;
        }
      }

      // Image
      if (!original.imageUrl || !isPlausibleImageUrl(original.imageUrl)) {
        if (fresh.imageUrl && isPlausibleImageUrl(fresh.imageUrl)) {
          updates.imageUrl = fresh.imageUrl;
          stats.imageResolved++;
        }
      }

      // Address: backfill if missing
      if (!original.address && fresh.address) {
        updates.address = fresh.address;
      }

      // Phone: backfill + normalize
      if (!original.phoneNumber && fresh.phoneNumber) {
        updates.phoneNumber = normalizePhone(fresh.phoneNumber);
      }

      // Hours: backfill + normalize
      if (!original.hoursJson && fresh.hoursJson) {
        updates.hoursJson = normalizeHours(fresh.hoursJson) ?? Prisma.JsonNull;
      }

      // Rating: backfill
      if (!original.webRating && fresh.webRating) {
        updates.webRating = fresh.webRating;
      }
      if (!original.webReviewCount && fresh.webReviewCount) {
        updates.webReviewCount = fresh.webReviewCount;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.place.update({ where: { id: original.id }, data: updates });
        stats.enriched++;
      }

      // Refresh editorial if we updated meaningful data
      if (!opts.skipEditorial && Object.keys(updates).length > 0 && process.env.OPENAI_API_KEY) {
        await refreshEditorialForPlace(original.id);
        stats.editorialRefreshed++;
      }
    }
  }

  logStats(stats);
}

function logStats(stats: ReconcileStats) {
  console.log("\n[reconcile] Final stats:", JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error("[reconcile] fatal:", err);
  process.exit(1);
});
