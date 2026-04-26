-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "baywire";

-- CreateEnum
CREATE TYPE "baywire"."City" AS ENUM ('tampa', 'st_petersburg', 'clearwater', 'brandon', 'bradenton', 'other');

-- CreateTable
CREATE TABLE "baywire"."sources" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ,
    "last_status" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baywire"."scrape_runs" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "events_seen" INTEGER NOT NULL DEFAULT 0,
    "events_inserted" INTEGER NOT NULL DEFAULT 0,
    "events_updated" INTEGER NOT NULL DEFAULT 0,
    "events_skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "scrape_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baywire"."events" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "venue_name" TEXT,
    "address" TEXT,
    "city" "baywire"."City" NOT NULL DEFAULT 'other',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "price_min" DECIMAL(10,2),
    "price_max" DECIMAL(10,2),
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image_url" TEXT,
    "event_url" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_slug_key" ON "baywire"."sources"("slug");

-- CreateIndex
CREATE INDEX "scrape_runs_source_started_idx" ON "baywire"."scrape_runs"("source_id", "started_at");

-- CreateIndex
CREATE INDEX "events_start_at_idx" ON "baywire"."events"("start_at");

-- CreateIndex
CREATE INDEX "events_city_start_at_idx" ON "baywire"."events"("city", "start_at");

-- CreateIndex
CREATE INDEX "events_is_free_start_at_idx" ON "baywire"."events"("is_free", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "events_source_source_event_id_uidx" ON "baywire"."events"("source_id", "source_event_id");

-- AddForeignKey
ALTER TABLE "baywire"."scrape_runs" ADD CONSTRAINT "scrape_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "baywire"."sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baywire"."events" ADD CONSTRAINT "events_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "baywire"."sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

