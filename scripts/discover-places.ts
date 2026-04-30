import "dotenv/config";

import type { CityKey } from "../src/lib/cities";
import { isCityKey } from "../src/lib/cities";
import { SEARCH_TYPES, type SearchType } from "../src/lib/places/discover";
import { runDiscoverPipeline } from "../src/lib/pipeline/discoverPlaces";

function parseArgs() {
  const args = process.argv.slice(2);
  let city: CityKey | undefined;
  let searchType: SearchType | undefined;
  let skipEditorial = false;
  let limitPerQuery: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--city" && args[i + 1]) {
      const val = args[++i];
      if (!isCityKey(val)) {
        console.error(`Unknown city: ${val}`);
        process.exit(1);
      }
      city = val;
    } else if (arg === "--type" && args[i + 1]) {
      const val = args[++i] as SearchType;
      if (!(SEARCH_TYPES as readonly string[]).includes(val)) {
        console.error(`Unknown search type: ${val}. Valid: ${SEARCH_TYPES.join(", ")}`);
        process.exit(1);
      }
      searchType = val;
    } else if (arg === "--limit" && args[i + 1]) {
      const val = Number(args[++i]);
      if (!Number.isFinite(val) || val < 1) {
        console.error("--limit must be a positive number");
        process.exit(1);
      }
      limitPerQuery = Math.floor(val);
    } else if (arg === "--skip-editorial") {
      skipEditorial = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: discover-places [options]

Options:
  --city <key>        Run for a single city (e.g. tampa, st_petersburg)
  --type <type>       Run for a single search type (${SEARCH_TYPES.join(", ")})
  --limit <n>         Max new places per search query (default: 15, use 5 for incremental runs)
  --skip-editorial    Skip the AI editorial curation pass
  --help, -h          Show this help`);
      process.exit(0);
    }
  }

  return { city, searchType, skipEditorial, limitPerQuery };
}

async function main() {
  const { city, searchType, skipEditorial, limitPerQuery } = parseArgs();

  console.log("[discover-places] Starting AI place discovery pipeline...");
  if (city) console.log(`  City: ${city}`);
  if (searchType) console.log(`  Type: ${searchType}`);
  if (limitPerQuery) console.log(`  Limit per query: ${limitPerQuery}`);
  if (skipEditorial) console.log("  Editorial: skipped");

  const stats = await runDiscoverPipeline({
    cities: city ? [city] : undefined,
    searchTypes: searchType ? [searchType] : undefined,
    skipEditorial,
    limitPerQuery,
  });

  console.log("\n[discover-places] Final stats:", JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error("[discover-places] fatal:", err);
  process.exit(1);
});
