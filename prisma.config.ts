import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // process.env (rather than the throwing `env()` helper) so commands like
  // `prisma generate` don't fail in CI when DATABASE_URL is unset.
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
