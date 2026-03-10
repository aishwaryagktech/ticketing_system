CREATE TABLE IF NOT EXISTS "tenant_channel_settings" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" TEXT NOT NULL UNIQUE,
  "chat_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "chat_position" TEXT NOT NULL DEFAULT 'bottom-right',
  "chat_primary_color" TEXT NOT NULL DEFAULT '#FACC15',
  "webform_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "webform_path" TEXT NOT NULL DEFAULT '/support',
  "email_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "support_email" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_channel_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

