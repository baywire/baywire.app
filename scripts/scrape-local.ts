import "dotenv/config";

import { runScrape } from "../src/lib/pipeline/run";

function isFailForwardError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "string" ? err : err instanceof Error ? err.message : String(err);

  if (/^HTTP (401|403|408|425|429|500|502|503|504)\b/.test(msg)) return true;
  if (/\b(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED)\b/.test(msg)) return true;
  if (/\bfetch failed\b/i.test(msg)) return true;
  return false;
}

async function main() {
  const only = process.argv[2];
  const stats = await runScrape({ only });

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
    console.log(`[scrape:result] ${JSON.stringify(s)}`);
    if (!s.ok) {
      anyFailed = true;
      if (!isFailForwardError(s.error)) anyHardFailed = true;
    }
  }

  if (anyHardFailed) process.exit(1);
  if (anyFailed) process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
