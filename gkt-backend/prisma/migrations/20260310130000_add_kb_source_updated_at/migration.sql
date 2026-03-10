-- Add updated_at to kb_sources for "last refreshed" timestamp.
ALTER TABLE "kb_sources"
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows.
UPDATE "kb_sources"
SET "updated_at" = COALESCE("updated_at", "created_at");

