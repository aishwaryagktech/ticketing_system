-- Add tenant_product_id to tickets for product-scoped SLA/escalation/queues

ALTER TABLE "tickets"
ADD COLUMN IF NOT EXISTS "tenant_product_id" TEXT;

-- Helpful indices for agent queues
CREATE INDEX IF NOT EXISTS "tickets_tenant_product_id_status_created_at_idx"
ON "tickets"("tenant_product_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "tickets_tenant_product_id_assigned_to_status_idx"
ON "tickets"("tenant_product_id", "assigned_to", "status");

