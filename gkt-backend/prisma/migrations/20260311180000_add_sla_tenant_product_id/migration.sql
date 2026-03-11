-- AlterTable: add tenant_product_id to sla_policies for per-product SLA
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "tenant_product_id" TEXT;

-- Add FK to tenant_products (CASCADE on delete)
ALTER TABLE "sla_policies"
  ADD CONSTRAINT "sla_policies_tenant_product_id_fkey"
  FOREIGN KEY ("tenant_product_id") REFERENCES "tenant_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old product_id+priority unique (tenant-agnostic)
DROP INDEX IF EXISTS "sla_policies_product_id_priority_key";

-- New unique: one SLA set per tenant-product per priority
CREATE UNIQUE INDEX IF NOT EXISTS "sla_policies_tenant_product_id_priority_key"
  ON "sla_policies"("tenant_product_id", "priority");
