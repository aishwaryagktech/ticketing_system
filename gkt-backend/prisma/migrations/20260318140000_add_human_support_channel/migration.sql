-- Add human_support_channel column to tenant_channel_settings
-- Values: 'chat' (keep chat widget open, bot_handoff flow)
--         'email' (close chat, switch source to web_form so agent contacts via email)
ALTER TABLE "tenant_channel_settings"
  ADD COLUMN IF NOT EXISTS "human_support_channel" TEXT NOT NULL DEFAULT 'email';
