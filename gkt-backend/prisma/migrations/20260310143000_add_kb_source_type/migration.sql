ALTER TABLE "kb_sources"
ADD COLUMN IF NOT EXISTS "source_type" TEXT NOT NULL DEFAULT 'crawled';

