-- Ensure UUID generation exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Ensure roles table exists (Prisma maps UserRole -> roles)
CREATE TABLE IF NOT EXISTS "roles" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL
);

-- If roles table already existed without a default, set it.
ALTER TABLE "roles"
ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();

-- 2) Seed system roles (idempotent)
INSERT INTO "roles" ("name", "label") VALUES
  ('super_admin', 'Super Admin'),
  ('tenant_admin', 'Tenant Admin'),
  ('l1_agent', 'L1 Agent'),
  ('l2_agent', 'L2 Agent'),
  ('l3_agent', 'L3 Agent'),
  ('user', 'User')
ON CONFLICT ("name") DO NOTHING;

-- Fix any accidental null IDs (shouldn't happen, but safe)
UPDATE "roles" SET "id" = uuid_generate_v4() WHERE "id" IS NULL;

-- 3) Backfill users.role_id from legacy users.role enum (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role_id'
  ) THEN
    UPDATE "users" u
    SET "role_id" = r."id"
    FROM "roles" r
    WHERE u."role_id" IS NULL
      AND r."name" = CASE u."role"::text
        WHEN 'super_admin' THEN 'super_admin'
        WHEN 'product_admin' THEN 'tenant_admin'
        WHEN 'l1_agent' THEN 'l1_agent'
        WHEN 'l2_agent' THEN 'l2_agent'
        WHEN 'student' THEN 'user'
        WHEN 'faculty' THEN 'user'
        ELSE 'user'
      END;
  END IF;
END $$;

-- 4) Enforce NOT NULL on role_id (after backfill), only if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE "users"
    ALTER COLUMN "role_id" SET NOT NULL;
  END IF;
END $$;

-- 5) Drop legacy users.role column and Role enum type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE "users" DROP COLUMN "role";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    DROP TYPE "Role";
  END IF;
END $$;

