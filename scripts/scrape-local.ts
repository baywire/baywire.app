import "dotenv/config";

import { runScrape } from "../src/lib/pipeline/run";
import { runPlaceScrape } from "../src/lib/pipeline/runPlaces";

function isFailForwardError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "string" ? err : err instanceof Error ? err.message : String(err);

  // Common upstream fetch failures we don't want to break the CI workflow over.
  // These still get written to `scrapeRun.error` and `source.lastStatus`.
  if (/^HTTP (401|403|408|425|429|500|502|503|504)\b/.test(msg)) return true;
  if (/\b(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED)\b/.test(msg)) return true;
  if (/\bfetch failed\b/i.test(msg)) return true;
  return false;
}

async function main() {
  const only = process.argv[2];

  const [eventStats, placeStats] = await Promise.all([
    runScrape({ only }),
    runPlaceScrape({ only }),
  ]);
  const stats = [...eventStats, ...placeStats];

  if (only && stats.length === 0) {
    console.error(`[scrape:local] unknown source: ${only}`);
    process.exit(2);
  }

  let anyFailed = false;
  let anyHardFailed = false;
  for (const s of stats) {
    const status = s.ok ? "ok" : `error: ${s.error}`;
    console.log(
      `[${s.slug}] ${status}  seen=${s.seen} inserted=${s.inserted} updated=${s.updated} skipped=${s.skipped} structured=${s.structuredHits} (${s.durationMs}ms)`,
    );
    // Single-line, machine-parseable summary consumed by the GHA workflow to
    // render the per-source step summary. Do not change the prefix.
    console.log(`[scrape:result] ${JSON.stringify(s)}`);
    if (!s.ok) {
      anyFailed = true;
      if (!isFailForwardError(s.error)) anyHardFailed = true;
    }
  }

  // Fail-forward: upstream HTTP/WAF/rate-limit errors should not fail the
  // entire pipeline run, but they are still recorded in the DB.
  if (anyHardFailed) process.exit(1);
  if (anyFailed) process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
