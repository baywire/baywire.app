import "dotenv/config";

/**
 * Quick diagnostic for the Overture Maps API integration.
 * Tests connectivity, auth, and a sample geo query around Tampa.
 *
 * Usage: npx tsx scripts/test-overture.ts
 */

const OVERTURE_API = "https://api.overturemapsapi.com";

const TEST_CASES = [
  { name: "Tampa center",      lat: 27.9506, lng: -82.4572, radius: 5000 },
  { name: "St. Petersburg",    lat: 27.7676, lng: -82.6403, radius: 5000 },
];

const KNOWN_PLACES = [
  "Columbia Restaurant",
  "Clearwater Beach",
  "Dunedin Brewery",
  "The Bier Boutique",
];

async function main() {
  const apiKey = process.env.OVERTURE_API_KEY?.trim();

  console.log("── Overture Maps API Diagnostic ──\n");
  console.log(`API base:  ${OVERTURE_API}`);
  console.log(`API key:   ${apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : "NOT SET"}`);
  console.log();

  if (!apiKey) {
    console.error("OVERTURE_API_KEY is not set in .env — nothing to test.");
    process.exit(1);
  }

  // Test 1: Basic connectivity
  console.log("Test 1: Basic connectivity (GET /places with geo query)...");
  for (const tc of TEST_CASES) {
    console.log(`\n  → ${tc.name} (${tc.lat}, ${tc.lng}, radius=${tc.radius}m)`);
    try {
      const params = new URLSearchParams({
        lat: String(tc.lat),
        lng: String(tc.lng),
        radius: String(tc.radius),
        limit: "10",
        country: "US",
        format: "json",
      });

      const url = `${OVERTURE_API}/places?${params}`;
      console.log(`    URL: ${url}`);

      const res = await fetch(url, {
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });

      console.log(`    Status: ${res.status} ${res.statusText}`);
      console.log(`    Content-Type: ${res.headers.get("content-type")}`);

      if (!res.ok) {
        const body = await res.text().catch(() => "<unreadable>");
        console.log(`    Error body: ${body.slice(0, 500)}`);
        continue;
      }

      const data = await res.json();
      const isArray = Array.isArray(data);
      const hasFeatures = data?.features && Array.isArray(data.features);
      const items = isArray ? data : hasFeatures ? data.features : [];
      console.log(`    Response shape: ${isArray ? "array" : typeof data} (${items.length} items)`);

      if (items.length > 0) {
        const sample = items[0];
        console.log(`    Sample item keys: ${Object.keys(sample).join(", ")}`);
        if (sample.properties) {
          console.log(`    Sample properties keys: ${Object.keys(sample.properties).join(", ")}`);
          const name = sample.properties.names?.primary ?? sample.properties.name ?? "<no name>";
          console.log(`    Sample name: ${name}`);
        }
        if (sample.geometry?.coordinates) {
          console.log(`    Sample coords: [${sample.geometry.coordinates.join(", ")}]`);
        }
        console.log(`    ✓ ${items.length} places returned`);
      } else {
        console.log("    ⚠ No places returned (empty result)");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    ✗ FAILED: ${msg}`);
      if (err instanceof TypeError && msg.includes("fetch failed")) {
        console.log("    → This usually means the hostname can't be resolved (DNS) or the server refused the connection.");
        console.log("    → Check if the API base URL is correct.");
      }
    }
  }

  // Test 2: Try alternate API patterns
  console.log("\n\nTest 2: Trying alternate endpoint patterns...");
  const alternates = [
    `${OVERTURE_API}/v1/places?q=Tampa&limit=5`,
    `${OVERTURE_API}/places/search?q=Tampa&limit=5`,
    `${OVERTURE_API}/api/places?lat=27.9506&lng=-82.4572&radius=5000&limit=5`,
  ];

  for (const url of alternates) {
    try {
      const res = await fetch(url, {
        headers: { "x-api-key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      console.log(`  ${res.status} ${res.statusText} ← ${url}`);
      if (res.ok) {
        const body = await res.text();
        console.log(`       Response (first 200 chars): ${body.slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`  FAILED ← ${url} (${err instanceof Error ? err.message : err})`);
    }
  }

  // Test 3: DNS resolution check
  console.log("\n\nTest 3: DNS resolution...");
  try {
    const host = new URL(OVERTURE_API).hostname;
    const dns = await import("node:dns/promises");
    const addrs = await dns.resolve4(host);
    console.log(`  ${host} → ${addrs.join(", ")} ✓`);
  } catch (err) {
    const host = new URL(OVERTURE_API).hostname;
    console.log(`  ${host} → FAILED (${err instanceof Error ? err.message : err})`);
    console.log("  → The Overture API hostname cannot be resolved. The URL may be wrong.");
    console.log("  → Overture Maps Foundation data is typically accessed via cloud downloads,");
    console.log("     not a REST API. Consider alternatives:");
    console.log("     - AWS Athena (s3://overturemaps-us-west-2/)");
    console.log("     - Microsoft Planetary Computer");
    console.log("     - DuckDB with httpfs extension");
  }

  console.log("\n── Done ──");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
