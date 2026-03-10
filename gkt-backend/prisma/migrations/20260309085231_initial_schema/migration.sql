-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'faculty', 'l1_agent', 'l2_agent', 'product_admin', 'super_admin');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('tenant_user', 'individual');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('new', 'open', 'in_progress', 'pending_user', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('p1', 'p2', 'p3', 'p4');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('web_form', 'widget', 'email', 'api', 'bot_handoff');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('positive', 'neutral', 'frustrated', 'critical');

-- CreateEnum
CREATE TYPE "EscalationTrigger" AS ENUM ('sla_breach', 'sentiment', 'complexity', 'vip', 'bot_handoff', 'user_unsatisfied');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'cancelled', 'trialing');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_base64" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#2563EB',
    "email_sender_name" TEXT,
    "email_sender_address" TEXT,
    "api_key_hash" TEXT,
    "plan_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_base64" TEXT,
    "contact_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "user_type" "UserType" NOT NULL,
    "department" TEXT,
    "avatar_base64" TEXT,
    "active_model" TEXT,
    "notification_prefs" JSONB NOT NULL DEFAULT '{}',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "created_by" TEXT NOT NULL,
    "assigned_to" TEXT,
    "parent_ticket_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'new',
    "priority" "Priority" NOT NULL,
    "source" "TicketSource" NOT NULL,
    "user_type" "UserType" NOT NULL,
    "category" TEXT,
    "sub_category" TEXT,
    "department" TEXT,
    "ai_confidence" DECIMAL(65,30),
    "sentiment" "Sentiment",
    "sentiment_trend" TEXT,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "sla_deadline" TIMESTAMP(3),
    "sla_paused_at" TIMESTAMP(3),
    "sla_paused_duration" INTEGER NOT NULL DEFAULT 0,
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "reopen_deadline" TIMESTAMP(3),
    "csat_score" INTEGER,
    "csat_comment" TEXT,
    "course_id" TEXT,
    "course_name" TEXT,
    "session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" TEXT,
    "ai_suggested" BOOLEAN NOT NULL DEFAULT false,
    "ai_accepted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "response_time_mins" INTEGER NOT NULL,
    "resolution_time_mins" INTEGER NOT NULL,
    "warning_threshold_pct" INTEGER NOT NULL DEFAULT 75,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_rules" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "trigger_type" "EscalationTrigger" NOT NULL,
    "trigger_threshold_mins" INTEGER,
    "sentiment_trigger" TEXT,
    "action_assign_role" TEXT NOT NULL,
    "notify_roles" JSONB NOT NULL DEFAULT '[]',
    "notify_sms" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_articles" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "images" JSONB NOT NULL DEFAULT '[]',
    "category" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "qdrant_point_id" TEXT,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "not_helpful_count" INTEGER NOT NULL DEFAULT 0,
    "deflected_count" INTEGER NOT NULL DEFAULT 0,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "provider_name" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "available_models" JSONB NOT NULL,
    "default_model" TEXT,
    "custom_base_url" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_configs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "chatbot_enabled" BOOLEAN NOT NULL DEFAULT true,
    "form_enabled" BOOLEAN NOT NULL DEFAULT true,
    "widget_position" TEXT NOT NULL DEFAULT 'bottom_right',
    "allowed_domains" JSONB NOT NULL DEFAULT '[]',
    "context_fields" JSONB NOT NULL DEFAULT '[]',
    "custom_welcome_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "from_value" TEXT,
    "to_value" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_logs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "from_level" INTEGER NOT NULL,
    "to_level" INTEGER NOT NULL,
    "trigger_reason" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "actor_id" TEXT,
    "notified_users" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ticket_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "channels_sent" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "max_agents" INTEGER NOT NULL,
    "max_tickets_per_month" INTEGER NOT NULL,
    "price_inr" DECIMAL(65,30) NOT NULL,
    "price_usd" DECIMAL(65,30) NOT NULL,
    "overage_per_ticket_inr" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "overage_per_ticket_usd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_subscriptions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "payment_provider" TEXT NOT NULL,
    "external_subscription_id" TEXT NOT NULL,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "tickets_used_this_month" INTEGER NOT NULL DEFAULT 0,
    "agents_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "chatbot_enabled" BOOLEAN NOT NULL DEFAULT true,
    "webform_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_intake_enabled" BOOLEAN NOT NULL DEFAULT true,
    "rest_api_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_alerts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "white_label_enabled" BOOLEAN NOT NULL DEFAULT false,
    "billing_enforced" BOOLEAN NOT NULL DEFAULT true,
    "ai_suggestions_enabled" BOOLEAN NOT NULL DEFAULT true,
    "kb_public_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_product_id_slug_key" ON "tenants"("product_id", "slug");

-- CreateIndex
CREATE INDEX "users_product_id_role_is_active_idx" ON "users"("product_id", "role", "is_active");

-- CreateIndex
CREATE INDEX "users_product_id_tenant_id_user_type_idx" ON "users"("product_id", "tenant_id", "user_type");

-- CreateIndex
CREATE UNIQUE INDEX "users_product_id_email_key" ON "users"("product_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_product_id_status_created_at_idx" ON "tickets"("product_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "tickets_product_id_tenant_id_status_idx" ON "tickets"("product_id", "tenant_id", "status");

-- CreateIndex
CREATE INDEX "tickets_product_id_assigned_to_status_idx" ON "tickets"("product_id", "assigned_to", "status");

-- CreateIndex
CREATE INDEX "tickets_product_id_sla_deadline_idx" ON "tickets"("product_id", "sla_deadline");

-- CreateIndex
CREATE INDEX "tickets_product_id_sla_breached_escalation_level_idx" ON "tickets"("product_id", "sla_breached", "escalation_level");

-- CreateIndex
CREATE INDEX "ticket_comments_ticket_id_created_at_idx" ON "ticket_comments"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_product_id_priority_key" ON "sla_policies"("product_id", "priority");

-- CreateIndex
CREATE INDEX "kb_articles_product_id_is_published_category_idx" ON "kb_articles"("product_id", "is_published", "category");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_configs_product_id_key" ON "plugin_configs"("product_id");

-- CreateIndex
CREATE INDEX "audit_logs_ticket_id_created_at_idx" ON "audit_logs"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_subscriptions_product_id_key" ON "product_subscriptions"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_product_id_key" ON "feature_flags"("product_id");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_configs" ADD CONSTRAINT "plugin_configs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_logs" ADD CONSTRAINT "escalation_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_subscriptions" ADD CONSTRAINT "product_subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
