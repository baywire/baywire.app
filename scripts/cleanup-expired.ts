import "dotenv/config";

import { prisma } from "../src/lib/db/client";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const expiredFilter = (cutoff: Date) => ({
  OR: [
    { endAt: { not: null, lt: cutoff } as const },
    { endAt: null, startAt: { lt: cutoff } },
  ],
});

async function main() {
  const cutoff = new Date(Date.now() - TWO_WEEKS_MS);

  // Collect expired event IDs so we can cascade to related tables.
  const expiredIDs = (
    await prisma.event.findMany({
      where: expiredFilter(cutoff),
      select: { id: true },
    })
  ).map((r) => r.id);

  if (expiredIDs.length === 0) {
    console.log(`[cleanup] no expired events (cutoff: ${cutoff.toISOString()})`);
    return;
  }

  // Metrics reference eventId without a FK — clean up dangling rows first.
  const metrics = await prisma.metric.deleteMany({
    where: { eventId: { in: expiredIDs } },
  });

  const events = await prisma.event.deleteMany({
    where: { id: { in: expiredIDs } },
  });

  // Remove canonical events that no longer have any linked events.
  const canonicals = await prisma.canonicalEvent.deleteMany({
    where: { events: { none: {} } },
  });

  console.log(
    `[cleanup] cutoff=${cutoff.toISOString()} events=${events.count} metrics=${metrics.count} canonicals=${canonicals.count}`,
  );
}

main().catch((err) => {
  console.error("[cleanup] fatal:", err);
  process.exit(1);
});
