DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_sources'
  ) THEN
    ALTER TABLE "kb_sources"
    ADD COLUMN IF NOT EXISTS "source_type" TEXT NOT NULL DEFAULT 'crawled';
  END IF;
END $$;

