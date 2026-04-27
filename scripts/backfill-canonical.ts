import "dotenv/config";

import { prisma } from "../src/lib/db/client";
import { resolveCanonicalEventForEvent } from "../src/lib/pipeline/canonical";

async function main() {
  const batchSize = 200;
  let cursor: string | null = null;
  let total = 0;

  for (;;) {
    const rows: Array<{ id: string }> = await prisma.event.findMany({
      select: { id: true },
      where: { source: { enabled: true } },
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
      ...(cursor
        ? {
          cursor: { id: cursor },
          skip: 1,
        }
        : {}),
      take: batchSize,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      await resolveCanonicalEventForEvent(row.id);
      total += 1;
      if (total % 100 === 0) {
        console.log(`[canonical:backfill] processed=${total}`);
      }
    }
    cursor = rows[rows.length - 1]?.id ?? null;
  }

  console.log(`[canonical:backfill] done processed=${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
