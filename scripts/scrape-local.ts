import "dotenv/config";

import { runScrape } from "../src/lib/pipeline/run";

async function main() {
  const only = process.argv[2];
  const stats = await runScrape({ only });
  for (const s of stats) {
    const status = s.ok ? "ok" : `error: ${s.error}`;
    console.log(
      `[${s.slug}] ${status}  seen=${s.seen} inserted=${s.inserted} updated=${s.updated} skipped=${s.skipped} (${s.durationMs}ms)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
