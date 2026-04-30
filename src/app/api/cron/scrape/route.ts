import { after, NextResponse, type NextRequest } from "next/server";

import { runScrape } from "@/lib/pipeline/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET unset" },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const only = req.nextUrl.searchParams.get("source") ?? undefined;
  const startedAt = new Date().toISOString();

  after(async () => {
    try {
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
      console.log("[scrape] completed", { only: only ?? "all", totals, stats });
    } catch (err) {
      console.error(
        "[scrape] failed",
        err instanceof Error ? err.stack ?? err.message : err,
      );
    }
  });

  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      only: only ?? null,
      startedAt,
      message: "Scrape started; results will appear in function logs.",
    },
    { status: 202 },
  );
}
