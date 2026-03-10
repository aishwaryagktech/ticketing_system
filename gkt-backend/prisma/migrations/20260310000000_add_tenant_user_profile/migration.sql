-- AlterTable: add tenant profile / signup fields
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "contact_email_hash" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "employee_count" INTEGER;

-- AlterTable: add user profile fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" TEXT;
