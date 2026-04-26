import { NextResponse, type NextRequest } from "next/server";

import { runScrape } from "@/lib/pipeline/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const only = req.nextUrl.searchParams.get("source") ?? undefined;
  const stats = await runScrape({ only });
  const totals = stats.reduce(
    (acc, s) => {
      acc.seen += s.seen;
      acc.inserted += s.inserted;
      acc.updated += s.updated;
      acc.skipped += s.skipped;
      return acc;
    },
    { seen: 0, inserted: 0, updated: 0, skipped: 0 },
  );

  return NextResponse.json({
    ok: stats.every((s) => s.ok),
    totals,
    sources: stats,
  });
}
