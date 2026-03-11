-- Add tenant_product_id to escalation_rules for per-product escalation
ALTER TABLE "escalation_rules" ADD COLUMN IF NOT EXISTS "tenant_product_id" TEXT;

ALTER TABLE "escalation_rules"
  ADD CONSTRAINT "escalation_rules_tenant_product_id_fkey"
  FOREIGN KEY ("tenant_product_id") REFERENCES "tenant_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
