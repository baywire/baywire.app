# Baywire

> The live wire for Tampa Bay.

A modern, AI-curated guide to live music, festivals, food, and family fun across the Tampa Bay area — Tampa, St. Petersburg, Clearwater, Brandon, and Bradenton. Lives at [baywire.app](https://baywire.app).

Baywire pulls candidate events from nine high-signal sources daily. Each source runs as its own GitHub Actions matrix job: adapters first try a structured surface (JSON-LD on detail pages, the WordPress Tribe Events JSON API, iCal exports) and only fall back to OpenAI extraction when no structured data is available. Vercel hosts the read-only Next.js app — it no longer runs scrapes.

```text
   GHA cron (daily 12:00 UTC)
       │  matrix: one job per source
       ▼
   adapter.listEvents
       │
       ├─ tryStructured() ── parse JSON-LD / ICS / vendor JSON ──┐
       │                                                          ▼
       └─ fetchAndReduce() ── HTML reducer ── OpenAI extractor ──▶ Prisma Postgres + Accelerate
                                                                      │
                                                                      ▼
                                                              Vercel Next.js (read-only)
```

## Stack

- **Next.js 16** (App Router, React 19, RSC by default)
- **Tailwind CSS v4** + custom coastal palette
- **Prisma ORM** + **Prisma Postgres** + **Prisma Accelerate** (managed Postgres + edge cache / connection pool in one URL)
- **OpenAI `gpt-4.1-mini`** with Zod-typed structured outputs (also works with any OpenAI-compatible proxy via `OPENAI_BASE_URL`, e.g. Poe / Groq / Together)
- `cheerio` for HTML reduction, `p-limit` for per-host pacing
- **GitHub Actions** drives the daily scrape (one matrix job per source)
- **Vercel** hosts the read-only Next.js app and the public events JSON API

## Sources

| Slug                       | Site                                | Path                | Notes                                                |
| -------------------------- | ----------------------------------- | ------------------- | ---------------------------------------------------- |
| `eventbrite`               | eventbrite.com                      | JSON-LD             | Geo-search across all 7 cities, 2 pages each         |
| `visit_tampa_bay`          | visittampabay.com/events            | JSON-LD             | Official tourism, curated                            |
| `visit_st_pete_clearwater` | visitstpeteclearwater.com           | JSON-LD             | Both `/events` and `/events-festivals` listings      |
| `tampa_gov`                | tampa.gov/calendar                  | JSON-LD + ICS       | City of Tampa public events calendar                 |
| `ilovetheburg`             | ilovetheburg.com                    | Tribe REST API      | St. Pete blog                                        |
| `thats_so_tampa`           | thatssotampa.com                    | Tribe REST API      | Tampa-side blog                                      |
| `tampa_bay_times`          | tampabay.com/things-to-do           | HTML + LLM          | Editorial weekend picks                              |
| `tampa_bay_markets`        | tampabaymarkets.com                 | HTML + LLM          | Recurring farmers' markets across the bay            |
| `safety_harbor`            | cityofsafetyharbor.com              | RSS hint + LLM      | CivicPlus RSS feed → SSR detail pages                |

**Deferred:** `feverup.com/en/tampa` (JS SPA, no public JSON-LD/sitemap),
`unation.com` (Cloudflare bot challenge), and
`dunedin.gov/Community/City-Calendar` (Akamai edge block on HTML, no public
ICS/JSON-LD endpoint discovered). These will be re-enabled by adding a
`tryStructured` slot pointed at any structured surface they expose; we
explicitly do **not** ship Playwright/headless browsers for them. Status is
tracked inline in [`src/lib/scrapers/index.ts`](src/lib/scrapers/index.ts).

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

Baywire is deployed in two parts: Vercel hosts the Next.js read path, and
GitHub Actions runs the daily scrape.

### Vercel (read-only web app)

1. Push to GitHub and import the repo into Vercel.
2. In **Project Settings → Environment Variables**, add `DATABASE_URL` (and
   `CRON_SECRET` if you still want the manual `/api/cron/scrape` lever to be
   bearer-token gated; the route is no longer triggered automatically).
3. Deploy. There are no Vercel cron schedules — `vercel.json` is intentionally
   empty.

### GitHub Actions (daily scrape)

The workflow at [`.github/workflows/scrape.yml`](.github/workflows/scrape.yml)
runs every day at **12:00 UTC** and fans out to one matrix job per source.
Each cell installs deps, runs `npm run scrape:local -- <source>`, parses the
`[scrape:result]` line into a step summary table, and uploads
`scripts/.last-html/` plus `scrape.log` as artifacts when the job fails.

Required repo secrets:

| Secret                  | Required | Notes                                              |
| ----------------------- | -------- | -------------------------------------------------- |
| `DATABASE_URL`          | yes      | Same Prisma Postgres URL Vercel uses               |
| `OPENAI_API_KEY`        | yes      | Used only by HTML+LLM fallbacks                    |
| `OPENAI_BASE_URL`       | optional | OpenAI-compatible proxy (Poe / Groq / …)           |
| `OPENAI_EXTRACT_MODEL`  | optional | Override default `gpt-4.1-mini`                    |

Notes:

- `workflow_dispatch` accepts an optional `source` input to scrape a single
  adapter. Leave it blank to run every adapter in parallel.
- GitHub-hosted scheduled runs may start 5–30 minutes late under platform
  load. That is acceptable for a daily aggregator; if you need it tighter,
  trigger from `workflow_dispatch` or `curl` the bearer-gated endpoint below.
- The Vercel route `POST /api/cron/scrape` is preserved as a manual lever:

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" \
       https://your-app.vercel.app/api/cron/scrape
  ```

  It returns immediately and continues the work in the background via
  `next/after`. Use it for ad-hoc reseeds; the GHA workflow is the
  source of truth.

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
- **Structured-first**: adapters with JSON-LD / ICS / vendor JSON skip the LLM entirely via `tryStructured`. The HTML+LLM fallback runs only when no structured surface exists for a given event.
- Content-hash short-circuit: events whose structured payload (or reduced HTML) hasn't changed never re-hit the LLM.
- Reduced HTML is capped at 16k characters (well under 4k tokens) before being sent to `gpt-4.1-mini`.
- A daily run currently touches ~100–200 unique events. With Phase 2 structured-first enabled, most adapters do zero LLM calls per event; only `tampa_bay_times`, `tampa_bay_markets`, and `safety_harbor` consistently use the LLM, plus any detail page where structured extraction returned `null`.
- All public read queries pass `cacheStrategy: { ttl: 60, swr: 300 }` to Prisma Accelerate, so the home page hits the edge cache for up to 60 seconds and serves stale-while-revalidate up to 5 minutes — even bursty traffic stays cheap.

## Attribution & ToS

This project respects each source's `robots.txt` and only fetches public listing and detail pages. Every event card links back to the original source, and the footer credits all four upstream providers. If a publisher requests removal, contact them or open an issue and we'll disable the relevant adapter.
