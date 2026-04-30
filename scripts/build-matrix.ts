import "dotenv/config";

import { prisma } from "../src/lib/db/client";
import fs from "node:fs/promises";

async function main() {
  const rows = await prisma.source.findMany({
    where: { enabled: true },
    select: { slug: true },
    orderBy: { slug: "asc" },
  });
  const slugs = rows.map((r) => r.slug);
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GITHUB_OUTPUT is not set");
  const matrix = JSON.stringify({ source: slugs });
  await fs.appendFile(output, `matrix=${matrix}\n`);
  console.log(`Matrix: ${matrix}`);
}

main()
  .catch((err) => {
    console.error("[build-matrix] fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
