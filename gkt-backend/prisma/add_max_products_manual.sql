-- Run this once on your database if migrations are stuck.
-- Adds max_products to billing_plans (0 = unlimited).
-- Safe to run: skips if column already exists (Postgres 9.5+).

ALTER TABLE "billing_plans"
ADD COLUMN IF NOT EXISTS "max_products" INTEGER NOT NULL DEFAULT 0;
