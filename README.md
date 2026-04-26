# Baywire

> The live wire for Tampa Bay.

A modern, AI-curated guide to live music, festivals, food, and family fun across the Tampa Bay area — Tampa, St. Petersburg, Clearwater, Brandon, and Bradenton. Lives at [baywire.app](https://baywire.app).

Baywire pulls candidate events from four high-signal sources every six hours, hands the raw HTML to OpenAI for structured extraction, and serves the deduplicated, normalized result as a mobile-first browsing experience.

```text
   Vercel Cron ─▶ /api/cron/scrape ─▶ source adapters ─▶ HTML reducer
                                                          │
                                            OpenAI structured outputs
                                                          │
                                            Prisma Postgres + Accelerate
                                                          │
                                                Next.js RSC pages
```

## Stack

- **Next.js 16** (App Router, React 19, RSC by default)
- **Tailwind CSS v4** + custom coastal palette
- **Prisma ORM** + **Prisma Postgres** + **Prisma Accelerate** (managed Postgres + edge cache / connection pool in one URL)
- **OpenAI `gpt-4.1-mini`** with Zod-typed structured outputs (also works with any OpenAI-compatible proxy via `OPENAI_BASE_URL`, e.g. Poe / Groq / Together)
- `cheerio` for HTML reduction, `p-limit` for per-host pacing
- Deployed to **Vercel** with **Vercel Cron**

## Sources

| Slug                       | Site                                | Notes                                  |
| -------------------------- | ----------------------------------- | -------------------------------------- |
| `eventbrite`               | eventbrite.com                      | Geo-search across all 5 cities, 2 pages each |
| `visit_tampa_bay`          | visittampabay.com/events            | Official tourism, curated              |
| `visit_st_pete_clearwater` | visitstpeteclearwater.com/events    | Covers St Pete, Clearwater, outskirts  |
| `tampa_bay_times`          | tampabay.com/things-to-do           | Editorial weekend picks                |

## Local setup

```bash
# 1. Install dependencies (postinstall runs `prisma generate`)
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local: set DATABASE_URL (Prisma Postgres URL),
#                   OPENAI_API_KEY, CRON_SECRET

# 3. Push the schema to the database
npm run db:push

# 4. Seed it with one full scrape
npm run scrape:local
# or scrape a single source:
npm run scrape:local eventbrite

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Provisioning Prisma Postgres

1. Sign in at [console.prisma.io](https://console.prisma.io) and create a Prisma Postgres database.
2. Copy the connection string — it looks like `prisma+postgres://accelerate.prisma-data.net/?api_key=...` — and paste it into `DATABASE_URL` in `.env.local`.
3. Run `npm run db:push` to materialize the schema. (Use `npm run db:migrate:dev` once you want versioned migrations.)

The same URL handles both the live query path (via Accelerate, with edge caching) and migrations, so you don't need a separate "direct URL".

## Useful scripts

| Command                          | What it does                                    |
| -------------------------------- | ----------------------------------------------- |
| `npm run dev`                    | Next.js dev server                              |
| `npm run build`                  | `prisma generate` then `next build`             |
| `npm run typecheck`              | `tsc --noEmit`                                  |
| `npm run lint`                   | ESLint via Next.js config                       |
| `npm run db:push`                | Push schema to the database (dev only)          |
| `npm run db:migrate:dev`         | Generate + apply a development migration        |
| `npm run db:migrate`             | Apply existing migrations (production)          |
| `npm run db:studio`              | Open Prisma Studio                              |
| `npm run scrape:local [slug]`    | Run the scrape pipeline once, locally           |

## Deployment

1. Push to GitHub and import the repo into Vercel.
2. In **Project Settings → Environment Variables**, add `DATABASE_URL`, `OPENAI_API_KEY`, and `CRON_SECRET`.
3. The included `vercel.json` registers a cron at `0 */6 * * *` hitting `/api/cron/scrape`. Vercel automatically forwards the configured `CRON_SECRET` as `Authorization: Bearer …`.
4. After the first deploy, run `npm run db:push` against the production `DATABASE_URL` once, then trigger a manual scrape via:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/scrape
   ```

## Project layout

```
src/
  app/                    Next.js App Router pages + API routes
    api/cron/scrape/      Cron-protected pipeline trigger
    api/events/           Public read-only events JSON API
    event/[id]/           Event detail page
  components/             RSC + client components (city filter, event card, …)
  lib/
    cities.ts             City constants, shared between DB enum + UI
    db/                   Prisma client (Accelerate-extended) and query helpers
    extract/              OpenAI structured-output extraction
    pipeline/             Orchestrator + normalization
    scrapers/             One adapter per source + shared fetch/reduce
    time/                 America/New_York-aware window helpers
    utils.ts              Misc helpers (cn, formatPrice, …)
prisma/
  schema.prisma           Prisma schema (City enum, Source/ScrapeRun/Event)
  migrations/             Generated SQL migrations (after `db:migrate:dev`)
scripts/scrape-local.ts   `npm run scrape:local`
```

## Cost & rate posture

- Per-host pacing is 1 request / 1.1 seconds with concurrent extraction at 4 in flight.
- Content-hash short-circuit: pages whose reduced HTML hasn't changed never re-hit the LLM.
- Reduced HTML is capped at 16k characters (well under 4k tokens) before being sent to `gpt-4.1-mini`.
- A typical 6-hour run touches roughly 100–150 unique events; expect a few hundred LLM calls per day at first, dropping to a fraction of that as the content-hash cache warms.
- All public read queries pass `cacheStrategy: { ttl: 60, swr: 300 }` to Prisma Accelerate, so the home page hits the edge cache for up to 60 seconds and serves stale-while-revalidate up to 5 minutes — even bursty traffic stays cheap.

## Attribution & ToS

This project respects each source's `robots.txt` and only fetches public listing and detail pages. Every event card links back to the original source, and the footer credits all four upstream providers. If a publisher requests removal, contact them or open an issue and we'll disable the relevant adapter.
