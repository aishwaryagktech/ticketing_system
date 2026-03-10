-- Add updated_at to kb_sources for "last refreshed" timestamp, but only if table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_sources'
  ) THEN
    ALTER TABLE "kb_sources"
    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

    -- Backfill existing rows.
    UPDATE "kb_sources"
    SET "updated_at" = COALESCE("updated_at", "created_at");
  END IF;
END $$;

