-- CreateTable
CREATE TABLE "baywire"."canonical_events" (
    "id" UUID NOT NULL,
    "primary_event_id" UUID,
    "deduped_title" TEXT,
    "summary" TEXT,
    "vibes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience" TEXT,
    "indoor_outdoor" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "why_its_cool" TEXT,
    "editorial_score" DOUBLE PRECISION,
    "editorial_hash" TEXT,
    "editorial_updated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "canonical_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "baywire"."events" ADD COLUMN "canonical_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "canonical_events_primary_event_id_key" ON "baywire"."canonical_events"("primary_event_id");

-- CreateIndex
CREATE INDEX "canonical_events_editorial_score_idx" ON "baywire"."canonical_events"("editorial_score");

-- CreateIndex
CREATE INDEX "events_canonical_id_idx" ON "baywire"."events"("canonical_id");

-- AddForeignKey
ALTER TABLE "baywire"."events"
ADD CONSTRAINT "events_canonical_id_fkey"
FOREIGN KEY ("canonical_id")
REFERENCES "baywire"."canonical_events"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baywire"."canonical_events"
ADD CONSTRAINT "canonical_events_primary_event_id_fkey"
FOREIGN KEY ("primary_event_id")
REFERENCES "baywire"."events"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
