-- Backfill first_name / last_name from existing encrypted name PII
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    UPDATE "users"
    SET "first_name" = COALESCE("first_name", "name"),
        "last_name"  = COALESCE("last_name", "name")
    WHERE "name" IS NOT NULL;
  END IF;
END $$;

-- Drop indexes that depend on product_id / user_type
DROP INDEX IF EXISTS "users_product_id_role_is_active_idx";
DROP INDEX IF EXISTS "users_product_id_tenant_id_user_type_idx";
DROP INDEX IF EXISTS "users_product_id_email_key";

-- Drop FK from users.product_id to products.id, if it exists
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_product_id_fkey";

-- Drop columns product_id, name, user_type from users
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "product_id",
  DROP COLUMN IF EXISTS "name",
  DROP COLUMN IF EXISTS "user_type";

-- Ensure we have a unique index on email_hash alone (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_hash'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'users_email_hash_key'
    ) THEN
      CREATE UNIQUE INDEX "users_email_hash_key" ON "users"("email_hash");
    END IF;
  END IF;
END $$;

