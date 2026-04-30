import "dotenv/config";

import { prisma } from "../src/lib/db/client";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const SKIP_PLACE_CLEANUP = true; //process.argv.includes("--skip-places");

const expiredFilter = (cutoff: Date) => ({
  OR: [
    { endAt: { not: null, lt: cutoff } as const },
    { endAt: null, startAt: { lt: cutoff } },
  ],
});

async function main() {
  const eventCutoff = new Date(Date.now() - TWO_WEEKS_MS);
  const placeCutoff = new Date(Date.now() - NINETY_DAYS_MS);

  // --- Events cleanup ---

  const expiredIDs = (
    await prisma.event.findMany({
      where: expiredFilter(eventCutoff),
      select: { id: true },
    })
  ).map((r) => r.id);

  let eventsDeleted = 0;
  let metricsDeleted = 0;
  let canonicalEventsDeleted = 0;

  if (expiredIDs.length > 0) {
    const metrics = await prisma.metric.deleteMany({
      where: { eventId: { in: expiredIDs } },
    });
    metricsDeleted = metrics.count;

    const events = await prisma.event.deleteMany({
      where: { id: { in: expiredIDs } },
    });
    eventsDeleted = events.count;

    const canonicals = await prisma.canonicalEvent.deleteMany({
      where: { events: { none: {} } },
    });
    canonicalEventsDeleted = canonicals.count;
  }

  console.log(
    `[cleanup:events] cutoff=${eventCutoff.toISOString()} events=${eventsDeleted} metrics=${metricsDeleted} canonicals=${canonicalEventsDeleted}`,
  );

  // --- Places cleanup ---

  if (SKIP_PLACE_CLEANUP) {
    console.log("[cleanup:places] skipped (--skip-places)");
    return;
  }

  const stalePlaceIDs = (
    await prisma.place.findMany({
      where: {
        lastSeenAt: { lt: placeCutoff },
        OR: [
          { lastEventAt: null },
          { lastEventAt: { lt: placeCutoff } },
        ],
      },
      select: { id: true },
    })
  ).map((r) => r.id);

  let placesDeleted = 0;
  let placeMetricsDeleted = 0;
  let canonicalPlacesDeleted = 0;

  if (stalePlaceIDs.length > 0) {
    const placeMetrics = await prisma.metric.deleteMany({
      where: { placeId: { in: stalePlaceIDs } },
    });
    placeMetricsDeleted = placeMetrics.count;

    const places = await prisma.place.deleteMany({
      where: { id: { in: stalePlaceIDs } },
    });
    placesDeleted = places.count;

    const canonicals = await prisma.canonicalPlace.deleteMany({
      where: { places: { none: {} } },
    });
    canonicalPlacesDeleted = canonicals.count;
  }

  console.log(
    `[cleanup:places] cutoff=${placeCutoff.toISOString()} places=${placesDeleted} metrics=${placeMetricsDeleted} canonicals=${canonicalPlacesDeleted}`,
  );
}

main().catch((err) => {
  console.error("[cleanup] fatal:", err);
  process.exit(1);
});
