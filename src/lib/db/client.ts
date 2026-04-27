import { PrismaPg } from "@prisma/adapter-pg";
import { withAccelerate } from "@prisma/extension-accelerate";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Singleton Prisma client.
 *
 * - If `DATABASE_URL` is a Prisma Postgres / Accelerate URL (`prisma://` or
 *   `prisma+postgres://`), the client is constructed with `accelerateUrl` and
 *   extended with `withAccelerate()`. Public read queries pass `cacheStrategy`
 *   so the home page is served from the edge cache.
 * - Otherwise we assume a plain Postgres URL and use the `@prisma/adapter-pg`
 *   driver adapter. Same query API; no Accelerate cache.
 */
function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to your .env.local (see .env.example).",
    );
  }

  const log: ("warn" | "error")[] =
    process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

  const client =
    url.startsWith("prisma://") || url.startsWith("prisma+postgres://")
      ? new PrismaClient({ accelerateUrl: url, log })
      : new PrismaClient({
          adapter: new PrismaPg({ connectionString: url }),
          log,
        });

  // Accelerate-cache hints become no-ops with a direct adapter, so we still
  // extend with `withAccelerate()` to keep one query API everywhere.
  return client.$extends(withAccelerate());
}

export type AppPrismaClient = ReturnType<typeof createClient>;

declare global {
  var __prisma: AppPrismaClient | undefined;
}

export const prisma: AppPrismaClient = globalThis.__prisma ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
