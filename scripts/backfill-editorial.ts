import "dotenv/config";

import type { Prisma } from "@/prisma/client";
import { prisma } from "../src/lib/db/client";
import { refreshEditorialForCanonical } from "../src/lib/pipeline/editorial";

const BATCH_SIZE = 100;
const STALE_HOURS = 48;

interface CliArgs {
  all: boolean;
  limit: number | null;
}

type EventWithSource = Prisma.EventGetPayload<{
  include: { source: { select: { slug: true; enabled: true } } };
}>;

interface CanonicalWithEvents {
  id: string;
  primaryEventId: string | null;
  summary: string | null;
  editorialScore: number | null;
  editorialUpdatedAt: Date | null;
  events: EventWithSource[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let cursor: string | null = null;
  let scanned = 0;
  let refreshed = 0;

  for (; ;) {
    const rows = (await prisma.canonicalEvent.findMany({
      where: { events: { some: { source: { enabled: true } } } },
      select: { id: true },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: BATCH_SIZE,
    })) as Array<{ id: string }>;
    if (rows.length === 0) break;
    scanned += rows.length;

    for (const row of rows) {
      if (args.limit != null && refreshed >= args.limit) break;
      const canonical = (await prisma.canonicalEvent.findUnique({
        where: { id: row.id },
        include: {
          events: {
            where: { source: { enabled: true } },
            include: { source: { select: { slug: true, enabled: true } } },
          },
        },
      })) as CanonicalWithEvents | null;
      if (!canonical || canonical.events.length === 0) continue;
      if (!args.all && !needsRefresh(canonical)) continue;

      const primary = choosePrimary(canonical.events, canonical.primaryEventId);
      await refreshEditorialForCanonical(prisma, canonical.id, canonical.events, primary);
      refreshed += 1;
      if (refreshed % 50 === 0) {
        console.log(`[editorial:backfill] refreshed=${refreshed} scanned=${scanned}`);
      }
    }

    if (args.limit != null && refreshed >= args.limit) break;
    cursor = rows[rows.length - 1]?.id ?? null;
  }

  console.log(`[editorial:backfill] done refreshed=${refreshed} scanned=${scanned}`);
}

function parseArgs(argv: string[]): CliArgs {
  let all = false;
  let limit: number | null = null;
  for (const arg of argv) {
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const raw = Number(arg.slice("--limit=".length));
      if (Number.isFinite(raw) && raw > 0) {
        limit = Math.floor(raw);
      }
    }
  }
  return { all, limit };
}

function needsRefresh(canonical: {
  summary: string | null;
  editorialScore: number | null;
  editorialUpdatedAt: Date | null;
}): boolean {
  if (!canonical.summary || canonical.editorialScore == null) return true;
  if (!canonical.editorialUpdatedAt) return true;
  const ageMs = Date.now() - canonical.editorialUpdatedAt.getTime();
  return ageMs > STALE_HOURS * 60 * 60 * 1000;
}

function choosePrimary<T extends { id: string; startAt: Date; imageUrl: string | null; source: { slug: string } }>(
  events: T[],
  primaryEventID: string | null,
): T {
  const exact = primaryEventID ? events.find((event) => event.id === primaryEventID) : null;
  if (exact) return exact;
  let best = events[0];
  for (let idx = 1; idx < events.length; idx += 1) {
    const next = events[idx];
    const nextHasImage = Boolean(next.imageUrl && next.imageUrl.trim());
    const bestHasImage = Boolean(best.imageUrl && best.imageUrl.trim());
    if (nextHasImage !== bestHasImage) {
      if (nextHasImage) best = next;
      continue;
    }
    if (next.startAt.getTime() < best.startAt.getTime()) {
      best = next;
      continue;
    }
    if (
      next.startAt.getTime() === best.startAt.getTime() &&
      next.source.slug.localeCompare(best.source.slug) < 0
    ) {
      best = next;
    }
  }
  return best;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
