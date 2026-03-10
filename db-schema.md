# GKT AI-Enabled Ticketing System — Database Schema

> **For:** Google Antigravity (AI Coding Agent)
> **Version:** 3.0 | March 2026
> **All DB access is in `gkt-backend` only. Frontend and widget never touch the DB.**

---

## Database Split Summary

| Database | What lives there | Why |
|---|---|---|
| **PostgreSQL** | Products, tenants, users, tickets, SLA policies, escalation rules, KB articles, AI provider config, audit logs, billing, notifications, plugin configs, feature flags | Relational + transactional. System of record. ACID, foreign keys, joins. All config owned at Product level. |
| **MongoDB** | Conversations/threads (with base64 attachments), email payloads, AI usage logs, analytics events, notification logs | Flexible schema, high-write, nested document structure. Schema evolves freely. |
| **Qdrant** | KB embeddings, ticket embeddings, resolution embeddings | Purpose-built vector DB. Semantic search, duplicate detection, AI context retrieval. All scoped by `product_id`. |

---

## PostgreSQL Schema (Prisma)

### Key Rules
- Every table (except `billing_plans`) includes `product_id` — all queries scoped to product
- `tenant_id` is **NULLABLE** wherever it appears — null means `user_type = individual`
- All config tables reference `product_id` — **never** `tenant_id`
- Prisma client lives in `gkt-backend/src/db/postgres.ts` only

---

### Table: `products`
Top-level entity. One row per product (e.g. Rewire). Owns all configuration.

```prisma
model Product {
  id                   String   @id @default(uuid())
  name                 String
  slug                 String   @unique              // subdomain routing: rewire.gkt.app
  logo_base64          String?                       // stored as base64 — no external storage
  primary_color        String   @default("#2563EB")
  email_sender_name    String?
  email_sender_address String?
  api_key_hash         String?                       // hashed key for REST /v1/ intake
  plan_id              String                        // FK → billing_plans
  is_active            Boolean  @default(true)
  created_by           String                        // FK → users (GKT Super Admin)
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  tenants             Tenant[]
  users               User[]
  tickets             Ticket[]
  sla_policies        SlaPolicy[]
  escalation_rules    EscalationRule[]
  kb_articles         KbArticle[]
  ai_provider_configs AiProviderConfig[]
  plugin_config       PluginConfig?
  feature_flags       FeatureFlag?
  subscription        ProductSubscription?
  audit_logs          AuditLog[]
  escalation_logs     EscalationLog[]
  notifications       Notification[]
}
```

---

### Table: `tenants`
Grouping/context label only. Belongs to a product. Owns no configuration.

```prisma
model Tenant {
  id            String   @id @default(uuid())
  product_id    String                        // FK → products
  name          String                        // e.g. "ABC College"
  slug          String
  logo_base64   String?                       // optional override
  contact_email String?
  is_active     Boolean  @default(true)
  created_by    String                        // FK → users (Product Admin)
  created_at    DateTime @default(now())

  product  Product  @relation(fields: [product_id], references: [id])
  users    User[]
  tickets  Ticket[]

  @@unique([product_id, slug])
}
```

---

### Table: `users`
All 6 roles in one table. `tenant_id` null for individual users and product-level staff.

```prisma
enum Role {
  student
  faculty
  l1_agent
  l2_agent
  product_admin
  super_admin
}

enum UserType {
  tenant_user   // belongs to a specific tenant
  individual    // direct product user — no tenant
}

model User {
  id                 String    @id @default(uuid())
  product_id         String                         // FK → products
  tenant_id          String?                        // nullable — null if individual
  email              String
  password_hash      String?                        // nullable if passed via plugin
  name               String
  role               Role
  user_type          UserType
  department         String?                        // for agents
  avatar_base64      String?
  active_model       String?                        // user's selected AI model
  notification_prefs Json      @default("{}")
  theme              String    @default("system")
  is_active          Boolean   @default(true)
  is_vip             Boolean   @default(false)
  last_login_at      DateTime?
  created_at         DateTime  @default(now())

  product  Product  @relation(fields: [product_id], references: [id])
  tenant   Tenant?  @relation(fields: [tenant_id], references: [id])

  @@unique([product_id, email])
  @@index([product_id, role, is_active])
  @@index([product_id, tenant_id, user_type])
}
```

---

### Table: `tickets`
Core entity. `product_id` always present. `tenant_id` nullable.

```prisma
enum TicketStatus {
  new
  open
  in_progress
  pending_user    // SLA clock pauses here
  resolved
  closed
}

enum Priority {
  p1   // 1 hour SLA
  p2   // 4 hours
  p3   // 12 hours
  p4   // 48 hours
}

enum TicketSource {
  web_form
  widget
  email
  api
  bot_handoff
}

enum Sentiment {
  positive
  neutral
  frustrated
  critical
}

model Ticket {
  id                   String        @id @default(uuid())
  ticket_number        String        @unique           // TKT-2026-00142
  product_id           String                         // FK → products — ALWAYS present
  tenant_id            String?                        // FK → tenants — NULL if individual
  created_by           String                         // FK → users
  assigned_to          String?                        // FK → users (agent)
  parent_ticket_id     String?                        // FK → tickets (linked/duplicate)
  subject              String
  description          String
  status               TicketStatus  @default(new)
  priority             Priority
  source               TicketSource
  user_type            UserType                       // copied from user on creation
  category             String?
  sub_category         String?
  department           String?
  ai_confidence        Decimal?                       // 0.00–100.00
  sentiment            Sentiment?
  sentiment_trend      String?                        // stable | worsening | improving
  is_vip               Boolean       @default(false)
  sla_deadline         DateTime?
  sla_paused_at        DateTime?                      // set on pending_user
  sla_paused_duration  Int           @default(0)      // seconds paused (running total)
  sla_breached         Boolean       @default(false)
  escalation_level     Int           @default(0)      // 0=none 1=L1 2=L2 3=L3 4=critical 5=vip
  resolved_at          DateTime?
  closed_at            DateTime?
  reopen_deadline      DateTime?                      // 72h after resolved
  csat_score           Int?                           // 1–5
  csat_comment         String?
  course_id            String?                        // LMS context from widget
  course_name          String?
  session_id           String?                        // GPU/lab session ref
  created_at           DateTime      @default(now())
  updated_at           DateTime      @updatedAt

  product   Product        @relation(fields: [product_id], references: [id])
  tenant    Tenant?        @relation(fields: [tenant_id], references: [id])
  comments  TicketComment[]

  @@index([product_id, status, created_at])
  @@index([product_id, tenant_id, status])
  @@index([product_id, assigned_to, status])
  @@index([product_id, sla_deadline])
  @@index([product_id, sla_breached, escalation_level])
}
```

---

### Table: `ticket_comments`
Public replies and internal notes. Full thread + attachments live in MongoDB `conversations`.

```prisma
model TicketComment {
  id           String   @id @default(uuid())
  ticket_id    String                        // FK → tickets
  product_id   String                        // FK → products
  author_id    String                        // FK → users
  body         String
  is_internal  Boolean  @default(false)      // internal note — agents only
  is_bot       Boolean  @default(false)
  sentiment    String?
  ai_suggested Boolean  @default(false)
  ai_accepted  Boolean  @default(false)
  created_at   DateTime @default(now())

  ticket Ticket @relation(fields: [ticket_id], references: [id])

  @@index([ticket_id, created_at])
}
```

---

### Table: `sla_policies`
Owned by Product. Applies to all tenants of that product.

```prisma
model SlaPolicy {
  id                    String   @id @default(uuid())
  product_id            String                        // FK → products
  priority              Priority
  response_time_mins    Int                           // e.g. 60 for P1
  resolution_time_mins  Int
  warning_threshold_pct Int      @default(75)         // % elapsed before warning
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt

  product Product @relation(fields: [product_id], references: [id])

  @@unique([product_id, priority])
}
```

---

### Table: `escalation_rules`
Owned by Product. All 5 escalation levels configured here.

```prisma
enum EscalationTrigger {
  sla_breach
  sentiment
  complexity
  vip
  bot_handoff
  user_unsatisfied
}

model EscalationRule {
  id                     String             @id @default(uuid())
  product_id             String                               // FK → products
  level                  Int                                  // 1=L0→L1 2=L1→L2 3=L2→L3 4=Critical 5=VIP
  trigger_type           EscalationTrigger
  trigger_threshold_mins Int?
  sentiment_trigger      String?                              // "frustrated" | "critical"
  action_assign_role     String                               // l1_agent | l2_agent | l3_agent | product_admin
  notify_roles           Json               @default("[]")
  notify_sms             Boolean            @default(false)
  is_active              Boolean            @default(true)
  created_at             DateTime           @default(now())

  product Product @relation(fields: [product_id], references: [id])
}
```

---

### Table: `kb_articles`
Owned by Product. Images stored as base64 in JSONB — no external storage.

```prisma
model KbArticle {
  id                String   @id @default(uuid())
  product_id        String
  title             String
  body              String                          // rich text HTML from Tiptap
  images            Json     @default("[]")         // [{name, base64, mime_type}]
  category          String
  audience          String                          // student | faculty | agent | all
  tags              Json     @default("[]")
  is_published      Boolean  @default(false)
  qdrant_point_id   String?                         // FK → Qdrant kb_embeddings point
  view_count        Int      @default(0)
  helpful_count     Int      @default(0)
  not_helpful_count Int      @default(0)
  deflected_count   Int      @default(0)            // viewed KB → did not submit ticket
  is_flagged        Boolean  @default(false)
  created_by        String
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  product Product @relation(fields: [product_id], references: [id])

  @@index([product_id, is_published, category])
}
```

---

### Table: `ai_provider_configs`
Owned by Product. Each product has its own AI provider keys and model selection.

```prisma
model AiProviderConfig {
  id                String   @id @default(uuid())
  product_id        String?                         // nullable = GKT platform default
  provider_name     String                          // openai | claude | gemini | custom
  api_key_encrypted String                          // AES-256 encrypted
  enabled           Boolean  @default(false)
  available_models  Json                            // array of model strings
  default_model     String?
  custom_base_url   String?                         // for self-hosted models
  created_by        String
  created_at        DateTime @default(now())
}
```

---

### Table: `plugin_configs`
Owned by Product. Controls chatbot + form embed behaviour.

```prisma
model PluginConfig {
  id                     String   @id @default(uuid())
  product_id             String   @unique
  chatbot_enabled        Boolean  @default(true)
  form_enabled           Boolean  @default(true)
  widget_position        String   @default("bottom_right")
  allowed_domains        Json     @default("[]")          // CORS whitelist
  context_fields         Json     @default("[]")
  custom_welcome_message String?
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt

  product Product @relation(fields: [product_id], references: [id])
}
```

---

### Table: `audit_logs`

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  product_id String
  ticket_id  String?
  actor_id   String?                               // null = system action
  action     String                                // status_changed | escalated | assigned | ai_classified
  from_value String?
  to_value   String?
  metadata   Json     @default("{}")
  created_at DateTime @default(now())

  product Product @relation(fields: [product_id], references: [id])

  @@index([ticket_id, created_at])
}
```

---

### Table: `escalation_logs`

```prisma
model EscalationLog {
  id             String   @id @default(uuid())
  product_id     String
  ticket_id      String
  from_level     Int
  to_level       Int
  trigger_reason String                           // sla_breach | sentiment | vip | bot_handoff
  triggered_by   String                           // system | agent | user
  actor_id       String?
  notified_users Json     @default("[]")
  created_at     DateTime @default(now())

  product Product @relation(fields: [product_id], references: [id])
}
```

---

### Table: `notifications`

```prisma
model Notification {
  id            String   @id @default(uuid())
  product_id    String
  user_id       String
  type          String                            // ticket_assigned | sla_warning | escalated | resolved | new_reply
  title         String
  body          String
  ticket_id     String?
  is_read       Boolean  @default(false)
  channels_sent Json     @default("[]")           // [in_app, email, sms]
  created_at    DateTime @default(now())

  product Product @relation(fields: [product_id], references: [id])

  @@index([user_id, is_read, created_at])
}
```

---

### Table: `billing_plans`

```prisma
model BillingPlan {
  id                       String  @id @default(uuid())
  name                     String                        // Starter | Growth | Enterprise
  max_agents               Int                           // -1 = unlimited
  max_tickets_per_month    Int                           // -1 = unlimited
  price_inr                Decimal
  price_usd                Decimal
  overage_per_ticket_inr   Decimal @default(0)
  overage_per_ticket_usd   Decimal @default(0)
  features                 Json    @default("{}")
  is_active                Boolean @default(true)
}
```

---

### Table: `product_subscriptions`
Billing at Product level — Rewire pays GKT.

```prisma
enum SubscriptionStatus {
  active
  past_due
  cancelled
  trialing
}

model ProductSubscription {
  id                       String             @id @default(uuid())
  product_id               String             @unique
  plan_id                  String
  status                   SubscriptionStatus
  payment_provider         String             // stripe | razorpay
  external_subscription_id String
  current_period_start     DateTime
  current_period_end       DateTime
  tickets_used_this_month  Int                @default(0)
  agents_count             Int                @default(0)
  created_at               DateTime           @default(now())
  updated_at               DateTime           @updatedAt

  product Product @relation(fields: [product_id], references: [id])
}
```

---

### Table: `feature_flags`
One row per product. Set by GKT Super Admin.

```prisma
model FeatureFlag {
  id                     String   @id @default(uuid())
  product_id             String   @unique
  chatbot_enabled        Boolean  @default(true)
  webform_enabled        Boolean  @default(true)
  email_intake_enabled   Boolean  @default(true)
  rest_api_enabled       Boolean  @default(true)
  sms_alerts_enabled     Boolean  @default(false)
  white_label_enabled    Boolean  @default(false)
  billing_enforced       Boolean  @default(true)
  ai_suggestions_enabled Boolean  @default(true)
  kb_public_enabled      Boolean  @default(true)
  updated_by             String
  updated_at             DateTime @updatedAt

  product Product @relation(fields: [product_id], references: [id])
}
```

---

## MongoDB Collections (Mongoose)

All in `gkt-backend/mongo/models/`. Frontend never accesses these directly.

---

### Collection: `conversations`
Full ticket thread + bot chat sessions. Attachments stored as base64 here.

```typescript
// gkt-backend/mongo/models/conversation.model.ts
import mongoose, { Schema } from 'mongoose';

const AttachmentSchema = new Schema({
  filename:   { type: String, required: true },
  mime_type:  { type: String, required: true },
  size_bytes: { type: Number, required: true },
  base64:     { type: String, required: true },   // max 5MB
}, { _id: false });

const MessageSchema = new Schema({
  message_id:        { type: String, required: true },
  author_type:       { type: String, enum: ['user','agent','bot','system'] },
  author_id:         { type: String, required: true },  // FK → PostgreSQL users.id
  author_name:       { type: String, required: true },
  body:              { type: String, required: true },
  is_internal:       { type: Boolean, default: false }, // internal note — agents only
  sentiment:         { type: String },
  ai_suggested:      { type: Boolean, default: false },
  ai_draft_accepted: { type: Boolean, default: false },
  attachments:       { type: [AttachmentSchema], default: [] },
  created_at:        { type: Date, default: Date.now },
}, { _id: false });

const BotSessionSchema = new Schema({
  resolved_by_bot:  { type: Boolean },
  turns_count:      { type: Number },
  handoff_reason:   { type: String },
  model_used:       { type: String },
  kb_articles_used: { type: [String], default: [] },
  ended_at:         { type: Date },
}, { _id: false });

const ConversationSchema = new Schema({
  product_id:  { type: String, required: true, index: true },
  tenant_id:   { type: String, default: null },   // null for individual users
  ticket_id:   { type: String, required: true },  // FK → PostgreSQL tickets.id
  type:        { type: String, enum: ['ticket','bot'] },
  messages:    { type: [MessageSchema], default: [] },
  bot_session: { type: BotSessionSchema, default: null },
  created_at:  { type: Date, default: Date.now },
  updated_at:  { type: Date, default: Date.now },
});

ConversationSchema.index({ product_id: 1, ticket_id: 1 });
ConversationSchema.index({ product_id: 1, type: 1, created_at: -1 });
```

---

### Collection: `email_payloads`
Raw inbound emails. Used for debugging + reprocessing failed email-to-ticket conversions.

```typescript
// gkt-backend/mongo/models/email-payload.model.ts
const EmailPayloadSchema = new Schema({
  product_id:        { type: String, required: true, index: true },
  from_email:        { type: String, required: true },
  from_name:         { type: String },
  to_email:          { type: String, required: true },
  subject:           { type: String },
  body_text:         { type: String },
  body_html:         { type: String },
  headers:           { type: Schema.Types.Mixed },
  parsed_ticket_id:  { type: String },          // FK after processing
  is_reply:          { type: Boolean, default: false },
  processing_status: { type: String, enum: ['pending','processed','failed'], default: 'pending' },
  received_at:       { type: Date, default: Date.now },
});
```

---

### Collection: `ai_usage_logs`
Every AI API call. Powers cost monitoring + performance analytics per product.

```typescript
// gkt-backend/mongo/models/ai-usage-log.model.ts
const AiUsageLogSchema = new Schema({
  product_id:        { type: String, required: true },
  user_id:           { type: String },
  ticket_id:         { type: String },
  provider:          { type: String, required: true },   // openai | claude | gemini
  model:             { type: String, required: true },
  feature:           { type: String, required: true },
  // feature values: classify | sentiment | suggest_reply | duplicate_check | chat | embed
  prompt_tokens:     { type: Number },
  completion_tokens: { type: Number },
  total_tokens:      { type: Number },
  latency_ms:        { type: Number },
  cost_usd:          { type: Number },
  success:           { type: Boolean, required: true },
  error_message:     { type: String },
  created_at:        { type: Date, default: Date.now },
});

AiUsageLogSchema.index({ product_id: 1, provider: 1, created_at: -1 });
AiUsageLogSchema.index({ product_id: 1, feature: 1, created_at: -1 });
```

---

### Collection: `analytics_events`
Event stream. Powers all analytics dashboard aggregations.

```typescript
// gkt-backend/mongo/models/analytics-event.model.ts
const AnalyticsEventSchema = new Schema({
  product_id: { type: String, required: true },
  tenant_id:  { type: String, default: null },    // null for individual user events
  user_type:  { type: String },                   // tenant_user | individual
  event_type: { type: String, required: true },
  // event_type values:
  // ticket_created | ticket_resolved | bot_resolved | sla_breached |
  // escalation_triggered | kb_viewed | kb_deflected | csat_submitted
  actor_id:   { type: String },
  ticket_id:  { type: String },
  metadata:   { type: Schema.Types.Mixed, default: {} },
  date:       { type: Date },                     // date only — for daily aggregations
  created_at: { type: Date, default: Date.now, expires: '365d' }, // TTL: 1 year
});

AnalyticsEventSchema.index({ product_id: 1, event_type: 1, date: -1 });
AnalyticsEventSchema.index({ product_id: 1, tenant_id: 1, event_type: 1 });
```

---

### Collection: `notification_logs`

```typescript
// gkt-backend/mongo/models/notification-log.model.ts
const NotificationLogSchema = new Schema({
  product_id:          { type: String, required: true },
  notification_id:     { type: String },           // FK → PostgreSQL notifications.id
  user_id:             { type: String },
  channel:             { type: String, enum: ['in_app','email','sms'] },
  provider:            { type: String },            // sendgrid | twilio | socket
  status:              { type: String, enum: ['sent','delivered','failed','bounced'] },
  provider_message_id: { type: String },
  error:               { type: String },
  sent_at:             { type: Date, default: Date.now },
});
```

---

## Qdrant Collections

All in `gkt-backend/src/services/embedding.service.ts`. Frontend and widget never call Qdrant.

### Key Rules
- **Every search MUST filter by `product_id` first** — this is the isolation boundary
- `tenant_id` in payload for optional sub-filtering
- Vector dimension: `1536` (OpenAI `text-embedding-3-small`)

---

### Collection: `kb_embeddings`

```typescript
// Insert — called when KB article is published
await qdrantClient.upsert('kb_embeddings', {
  points: [{
    id: article.qdrant_point_id,
    vector: await provider.embed(article.title + ' ' + article.body),
    payload: {
      product_id:   article.product_id,   // ALWAYS filter by this
      article_id:   article.id,
      title:        article.title,
      category:     article.category,
      audience:     article.audience,
      is_published: true,
      updated_at:   article.updated_at.toISOString(),
    }
  }]
});

// Query — called on every bot message and ticket form KB suggestion
await qdrantClient.search('kb_embeddings', {
  vector: await provider.embed(userQuery),
  filter: {
    must: [
      { key: 'product_id',   match: { value: productId } },
      { key: 'is_published', match: { value: true } },
    ]
  },
  limit: 5,
  with_payload: true,
});
```

---

### Collection: `ticket_embeddings`

```typescript
// Insert — called when ticket is created
await qdrantClient.upsert('ticket_embeddings', {
  points: [{
    id: uuidv4(),
    vector: await provider.embed(ticket.subject + ' ' + ticket.description),
    payload: {
      product_id:    ticket.product_id,
      tenant_id:     ticket.tenant_id ?? null,
      ticket_id:     ticket.id,
      ticket_number: ticket.ticket_number,
      status:        ticket.status,
      category:      ticket.category,
      user_type:     ticket.user_type,
      created_at:    ticket.created_at.toISOString(),
    }
  }]
});

// Duplicate detection — called on ticket submit, before saving
await qdrantClient.search('ticket_embeddings', {
  vector: await provider.embed(subject + ' ' + description),
  filter: {
    must: [{ key: 'product_id', match: { value: productId } }],
    should: [
      { key: 'status', match: { value: 'open' } },
      { key: 'status', match: { value: 'in_progress' } },
      { key: 'status', match: { value: 'resolved' } },
    ]
  },
  limit: 3,
  score_threshold: 0.85,
  with_payload: true,
});
```

---

### Collection: `resolution_embeddings`

```typescript
// Insert — called when ticket is resolved
await qdrantClient.upsert('resolution_embeddings', {
  points: [{
    id: uuidv4(),
    vector: await provider.embed(ticket.description + ' ' + resolutionText),
    payload: {
      product_id:          ticket.product_id,
      tenant_id:           ticket.tenant_id ?? null,
      ticket_id:           ticket.id,
      category:            ticket.category,
      resolution_summary:  resolutionText,   // injected into suggestReply() context
      resolved_at:         ticket.resolved_at.toISOString(),
    }
  }]
});

// Query — called when agent opens a ticket (AI suggested reply)
await qdrantClient.search('resolution_embeddings', {
  vector: await provider.embed(currentTicket.description),
  filter: {
    must: [
      { key: 'product_id', match: { value: productId } },
      { key: 'category',   match: { value: ticket.category } },
    ]
  },
  limit: 3,
  with_payload: true,
});
```

---

## Cross-Database Action Map

| User Action | PostgreSQL | MongoDB | Qdrant |
|---|---|---|---|
| GKT creates Product | Write `products`, `feature_flags`, `plugin_configs` | — | — |
| Product Admin creates Tenant | Write `tenants` | — | — |
| User registers / plugin loads | Write `users` (product_id + tenant_id or null) | — | — |
| KB article published | Write `kb_articles` (metadata + images as base64) | — | Write vector to `kb_embeddings` |
| Ticket submitted (any source) | Write `tickets` (product_id + nullable tenant_id) | Write `conversations` (messages[0]) | Write vector to `ticket_embeddings` |
| AI classification fires | Update `tickets` (category, priority, sentiment) | Write `ai_usage_log` | — |
| Duplicate detection | — | — | Search `ticket_embeddings` (score ≥ 0.85) |
| Attachment uploaded | — | Append base64 to `conversations.messages[].attachments[]` | — |
| Bot chat message | — | Append to `conversations.messages[]` | Search `kb_embeddings` + `resolution_embeddings` |
| Bot → human handoff | Write `tickets` (source=bot_handoff) | Update `bot_session` in conversation | — |
| Agent replies / adds note | Write `ticket_comments` | Append to `conversations.messages[]` | — |
| AI suggested reply | — | Write `ai_usage_log` | Search `resolution_embeddings` |
| SLA breach | Update `tickets` (sla_breached=true), write `escalation_logs` | Write `analytics_event` | — |
| Escalation fires | Write `escalation_logs`, update `tickets.escalation_level` | Write `analytics_event` | — |
| Ticket resolved | Update `tickets` (resolved_at), write `audit_logs` | Write `analytics_event` | Write vector to `resolution_embeddings` |
| CSAT submitted | Update `tickets` (csat_score, csat_comment) | Write `analytics_event` | — |
| Analytics dashboard | — | Aggregate `analytics_events` by product_id | — |
| AI cost report | — | Aggregate `ai_usage_logs` by product_id + provider | — |
| Notification sent | Write `notifications` | Write `notification_log` | — |

---

## Critical Indexes

### PostgreSQL
| Table + Columns | Purpose |
|---|---|
| `tickets (product_id, status, created_at)` | Agent queue — most frequent query |
| `tickets (product_id, tenant_id, status)` | Per-tenant view in Product Admin |
| `tickets (product_id, assigned_to, status)` | Agent's own queue |
| `tickets (product_id, sla_deadline)` | SLA cron — near-breach tickets |
| `tickets (product_id, sla_breached, escalation_level)` | Escalation cron query |
| `ticket_comments (ticket_id, created_at)` | Load comment thread |
| `audit_logs (ticket_id, created_at)` | Audit timeline |
| `notifications (user_id, is_read, created_at)` | Bell badge unread count |
| `kb_articles (product_id, is_published, category)` | KB portal browse |
| `users (product_id, role, is_active)` | Agent roster |
| `users (product_id, tenant_id, user_type)` | Segment by type |

### MongoDB
| Collection + Fields | Purpose |
|---|---|
| `conversations: { product_id, ticket_id }` | Load thread for a ticket |
| `conversations: { product_id, type, created_at }` | Bot session history |
| `ai_usage_logs: { product_id, provider, created_at }` | Cost per provider |
| `ai_usage_logs: { product_id, feature, created_at }` | Feature usage breakdown |
| `analytics_events: { product_id, event_type, date }` | Dashboard aggregations |
| `analytics_events: { product_id, tenant_id, event_type }` | Per-tenant analytics |
| `analytics_events: { created_at } TTL` | Auto-expire after 1 year |

### Qdrant
| Collection | Mandatory Filter | Optional Filters |
|---|---|---|
| `kb_embeddings` | `product_id` | `is_published=true`, `audience`, `category` |
| `ticket_embeddings` | `product_id` | `status`, `user_type`, date range |
| `resolution_embeddings` | `product_id` | `category`, resolved date range |

---

*See `project-setup.md` for folder structure, environment variables, packages, and plugin payload.*
