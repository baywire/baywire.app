import "dotenv/config";

import { runScrape } from "../src/lib/pipeline/run";

async function main() {
  const only = process.argv[2];
  const stats = await runScrape({ only });

  if (only && stats.length === 0) {
    console.error(`[scrape:local] unknown source: ${only}`);
    process.exit(2);
  }

  let anyFailed = false;
  for (const s of stats) {
    const status = s.ok ? "ok" : `error: ${s.error}`;
    console.log(
      `[${s.slug}] ${status}  seen=${s.seen} inserted=${s.inserted} updated=${s.updated} skipped=${s.skipped} (${s.durationMs}ms)`,
    );
    // Single-line, machine-parseable summary consumed by the GHA workflow to
    // render the per-source step summary. Do not change the prefix.
    console.log(`[scrape:result] ${JSON.stringify(s)}`);
    if (!s.ok) anyFailed = true;
  }

  if (anyFailed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
