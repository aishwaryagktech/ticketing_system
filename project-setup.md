# GKT AI-Enabled Ticketing System — Project Setup

> **For:** Google Antigravity (AI Coding Agent)
> **Version:** 3.0 | March 2026

---

## Repository Structure

```
gkt-ticketing/                   ← monorepo root (or 3 separate repos)
├── gkt-backend/                 ← Express.js + Node.js
│                                   ALL business logic, DB access, AI calls
│                                   Serves: gkt-frontend, gkt-widget, gkt-mobile (next phase)
│
├── gkt-frontend/                ← Next.js 14 (App Router)
│                                   UI only — no DB access, no AI calls
│                                   Communicates with gkt-backend via REST + WebSockets
│
└── gkt-widget/                  ← Standalone embeddable bundle
                                    Builds to a single widget.js file
                                    Served from CDN or gkt-backend /static
                                    Clients paste one <script> tag — done
```

---

## Platform Hierarchy

```
GKT (Super Admin)
  └── Product  (e.g. "Rewire")
        ├── Owns: SLA rules, Escalation flow, KB articles
        ├── Owns: Agents, AI provider config, Plugin codes
        ├── Owns: Branding, Feature flags, Billing plan
        └── Tenant  (e.g. "ABC College")  ← grouping label only, owns nothing
              └── User  (e.g. "John")
                    └── user_type: tenant_user | individual
```

**Key rules:**
- Every config (SLA, escalation, KB, agents, AI provider) belongs to **Product** — not Tenant
- Tenant is a pure context/grouping label — name and ID only, nothing configurable
- `tenant_id` is **NULLABLE** on tickets — null when `user_type = individual`
- Billing is at Product level — Rewire pays GKT, not individual tenants
- **Backend is the only layer that touches the database** — frontend and widget call backend API only

---

## How the Three Repos Communicate

```
gkt-frontend  ──── REST API ─────────────────────────────► gkt-backend
              ──── WebSocket (Socket.io) ─────────────────► gkt-backend
                                                                 │
gkt-widget    ──── REST API ─────────────────────────────► gkt-backend
              ──── WebSocket (Socket.io) ─────────────────► gkt-backend
                                                                 │
gkt-mobile    ──── REST API (next phase) ────────────────► gkt-backend
              ──── WebSocket (Socket.io) ─────────────────► gkt-backend
                                                                 │
                                                      ┌──────────▼──────────┐
                                                      │  PostgreSQL          │
                                                      │  MongoDB             │
                                                      │  Qdrant              │
                                                      └─────────────────────┘
```

- **REST API** — all CRUD, auth, config, KB, analytics, billing
- **WebSocket (Socket.io)** — real-time ticket queue updates, SLA countdown timers, notification bell, in-app toasts
- Frontend and widget **never touch the DB directly — ever**
- All AI calls made from backend services only

---

## TypeScript Types

Types are **duplicated** across repos — simple, no shared package needed.

- `gkt-backend/src/types/` — source of truth (matches DB schema exactly)
- `gkt-frontend/src/types/` — mirrors backend types (API response shapes)
- `gkt-widget/src/types/` — minimal (only what widget needs)

When a type changes in backend, manually update frontend. Faster than maintaining a shared package at this stage.

---

## Plugin Payload

Rewire integrates the widget by pasting one script tag. Widget calls `gkt-backend` directly.

```html
<!-- Chatbot Widget — paste before </body> -->
<script
  src="https://widget.gkt.app/widget.js"
  data-product-id="rewire_prod_xxx"
  data-product-name="Rewire"
  data-tenant-id="abc_college_xxx"         <!-- null if individual user -->
  data-tenant-name="ABC College"           <!-- null if individual user -->
  data-user-id="john_123"
  data-user-name="John Doe"
  data-user-email="john@abc.edu"
  data-user-type="tenant_user"             <!-- tenant_user | individual -->
  data-course-id="CS401"                   <!-- optional context -->
  data-course-name="Machine Learning">
</script>

<!-- Web Form — iFrame option -->
<iframe
  src="https://widget.gkt.app/form/rewire_prod_xxx"
  width="100%" height="600px" frameborder="0">
</iframe>

<!-- Web Form — JS inject option -->
<div id="gkt-ticket-form"></div>
<script
  src="https://widget.gkt.app/widget.js"
  data-product-id="rewire_prod_xxx"
  data-type="form"
  data-container="gkt-ticket-form"
  data-user-email="{{user.email}}"
  data-user-type="{{user.type}}">
</script>
```

| Field | Required | Notes |
|---|---|---|
| `data-product-id` | ✅ Always | Scopes SLA, KB, agents |
| `data-product-name` | ✅ Always | Display in admin |
| `data-tenant-id` | ⚠️ Conditional | NULL if individual |
| `data-tenant-name` | ⚠️ Conditional | NULL if individual |
| `data-user-id` | ✅ Always | Product's internal user ID |
| `data-user-name` | ✅ Always | Pre-fills ticket form |
| `data-user-email` | ✅ Always | Primary identifier |
| `data-user-type` | ✅ Always | `tenant_user` or `individual` |
| `data-course-id` | Optional | Auto-tags ticket |
| `data-session-id` | Optional | GPU/lab session reference |

---

## File Storage Strategy

**No external storage service. All files stored as base64 directly in the database.**

| What | Where | How |
|---|---|---|
| Ticket attachments | MongoDB `conversations.messages[].attachments[]` | base64 + filename + mime_type + size_bytes |
| KB article images | PostgreSQL `kb_articles.images` JSONB | `[{name, base64, mime_type}]` |
| Product logo | PostgreSQL `products.logo_base64` | TEXT column |
| Tenant logo override | PostgreSQL `tenants.logo_base64` | TEXT column |
| User avatar | PostgreSQL `users.avatar_base64` | TEXT column, optional |

**Limits enforced in backend `/api/upload`:**
- Max 5MB per file
- Max 3 attachments per ticket
- Allowed types: `jpg, jpeg, png, gif, webp, pdf, txt, log, csv`
- Use `sharp` to compress images before base64 encoding

---

## gkt-backend — Folder Structure

```
gkt-backend/
├── src/
│   ├── app.ts                          # Express app + middleware registration
│   ├── server.ts                       # HTTP server + Socket.io init + cron start
│   │
│   ├── config/
│   │   ├── env.ts                      # Zod-validated env vars
│   │   ├── db.ts                       # Prisma + Mongoose + Qdrant init
│   │   └── socket.ts                   # Socket.io server config + room logic
│   │
│   ├── routes/                         # Express routers — thin, delegate to controllers
│   │   ├── auth.routes.ts              # POST /api/auth/register /login /refresh /logout
│   │   ├── ticket.routes.ts            # CRUD /api/tickets /api/tickets/:id
│   │   ├── comment.routes.ts           # POST /api/tickets/:id/comments
│   │   ├── bot.routes.ts               # POST /api/bot/chat /api/bot/handoff
│   │   ├── kb.routes.ts                # CRUD /api/kb/articles, GET /api/kb/search /suggest
│   │   ├── agent.routes.ts             # /api/agents — roster, invite, deactivate
│   │   ├── notification.routes.ts      # GET /api/notifications, PATCH /:id/read
│   │   ├── upload.routes.ts            # POST /api/upload — base64 file handler
│   │   ├── product-admin.routes.ts     # /api/admin/sla /escalation /branding /ai-providers
│   │   ├── super-admin.routes.ts       # /api/super-admin/products /flags /billing
│   │   ├── analytics.routes.ts         # GET /api/analytics/* — all dashboard data
│   │   ├── billing.routes.ts           # /api/billing — plans, subscriptions, invoices
│   │   ├── plugin.routes.ts            # GET /api/plugin/codes — returns embed codes
│   │   ├── public.routes.ts            # Public REST API (API key auth) /api/v1/tickets
│   │   └── webhook.routes.ts           # POST /api/webhooks/email /stripe /razorpay
│   │
│   ├── controllers/                    # Handle req/res — call services, return response
│   │   ├── auth.controller.ts
│   │   ├── ticket.controller.ts
│   │   ├── comment.controller.ts
│   │   ├── bot.controller.ts
│   │   ├── kb.controller.ts
│   │   ├── agent.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── upload.controller.ts
│   │   ├── product-admin.controller.ts
│   │   ├── super-admin.controller.ts
│   │   ├── analytics.controller.ts
│   │   ├── billing.controller.ts
│   │   ├── plugin.controller.ts
│   │   └── webhook.controller.ts
│   │
│   ├── services/                       # All business logic — no req/res here
│   │   ├── ticket.service.ts           # Ticket lifecycle, status machine
│   │   ├── sla.service.ts              # SLA clock start/pause/resume, breach detection
│   │   ├── escalation.service.ts       # All 5 escalation levels, rule evaluation
│   │   ├── bot.service.ts              # Chatbot conversation, handoff logic
│   │   ├── kb.service.ts               # Article CRUD, inline suggestions
│   │   ├── embedding.service.ts        # Generate embeddings, Qdrant insert/search
│   │   ├── notification.service.ts     # In-app (Socket.io), email (SendGrid), SMS (Twilio)
│   │   ├── upload.service.ts           # File validation, compression (sharp), base64
│   │   ├── billing.service.ts          # Stripe + Razorpay subscription management
│   │   ├── product.service.ts          # Product + tenant provisioning
│   │   └── plugin.service.ts           # Embed code generation per product
│   │
│   ├── ai/                             # AI abstraction layer
│   │   ├── provider.ts                 # Reads active provider from DB, routes to adapter
│   │   └── adapters/
│   │       ├── openai.ts               # Implements all 6 AI methods
│   │       ├── claude.ts               # Same interface
│   │       └── gemini.ts               # Same interface
│   │
│   ├── middleware/
│   │   ├── auth.ts                     # JWT verify → attach user + product_id to req
│   │   ├── rbac.ts                     # Role permission guard factory
│   │   ├── product.ts                  # Subdomain/header → resolve product_id
│   │   ├── apiKey.ts                   # API key auth for public /v1/ routes
│   │   ├── errorHandler.ts             # Global error handler
│   │   └── rateLimiter.ts              # express-rate-limit config
│   │
│   ├── cron/
│   │   ├── index.ts                    # Register all cron jobs on server start
│   │   ├── sla.cron.ts                 # Every 5 min — SLA deadlines + alerts
│   │   └── escalation.cron.ts          # Every 5 min — escalation rule evaluation
│   │
│   ├── sockets/
│   │   ├── index.ts                    # Register all socket namespaces
│   │   ├── ticket.socket.ts            # ticket:new, ticket:updated, ticket:assigned
│   │   ├── sla.socket.ts               # sla:warning, sla:breached
│   │   └── notification.socket.ts      # notification:new
│   │
│   ├── db/
│   │   ├── postgres.ts                 # Prisma client singleton
│   │   ├── mongo.ts                    # Mongoose connection
│   │   └── qdrant.ts                   # Qdrant client singleton
│   │
│   ├── utils/
│   │   ├── encrypt.ts                  # AES-256 for AI API key encryption
│   │   ├── file.ts                     # base64 helpers, size/type validation
│   │   ├── pagination.ts               # Cursor-based pagination
│   │   ├── ticketNumber.ts             # TKT-YYYY-NNNNN generator
│   │   └── response.ts                 # Standardised API response helper
│   │
│   └── types/                          # Source of truth for all types
│       ├── ticket.types.ts
│       ├── user.types.ts               # UserType enum: tenant_user | individual
│       ├── ai.types.ts                 # Provider, model, adapter interface
│       ├── product.types.ts
│       └── express.d.ts                # Extend Express Request with user, product_id
│
├── prisma/
│   ├── schema.prisma                   # Full PostgreSQL schema
│   ├── migrations/
│   └── seed.ts
│
├── mongo/
│   └── models/
│       ├── conversation.model.ts
│       ├── email-payload.model.ts
│       ├── ai-usage-log.model.ts
│       ├── analytics-event.model.ts
│       └── notification-log.model.ts
│
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

---

## gkt-frontend — Folder Structure

```
gkt-frontend/
├── src/
│   ├── app/                            # Next.js 14 App Router — UI pages only
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── (portal)/                   # Student & faculty facing
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── tickets/page.tsx
│   │   │   ├── tickets/[id]/page.tsx
│   │   │   ├── kb/page.tsx
│   │   │   └── chat/page.tsx
│   │   │
│   │   ├── (agent)/                    # L1, L2, L3 agent views
│   │   │   ├── queue/page.tsx          # Real-time ticket queue
│   │   │   ├── tickets/[id]/page.tsx   # Detail + AI suggested replies + notes
│   │   │   └── faculty/page.tsx
│   │   │
│   │   ├── (product-admin)/            # Product Admin panel
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── sla/page.tsx
│   │   │   ├── escalation/page.tsx
│   │   │   ├── agents/page.tsx
│   │   │   ├── kb/page.tsx
│   │   │   ├── ai-providers/page.tsx
│   │   │   ├── plugin/page.tsx         # Embed codes + integration page
│   │   │   ├── billing/page.tsx
│   │   │   ├── branding/page.tsx
│   │   │   ├── tenants/page.tsx
│   │   │   └── tenants/[id]/page.tsx
│   │   │
│   │   └── (super-admin)/
│   │       ├── products/page.tsx
│   │       ├── products/new/page.tsx
│   │       ├── products/[id]/page.tsx
│   │       ├── billing/page.tsx
│   │       └── feature-flags/page.tsx
│   │
│   ├── components/
│   │   ├── ui/                         # shadcn/ui base components
│   │   ├── tickets/                    # TicketForm, TicketCard, TicketThread
│   │   ├── agent/                      # AgentQueue, TicketDetail, InternalNote
│   │   ├── product-admin/              # SlaEditor, EscalationRuleBuilder, KbManager
│   │   ├── charts/                     # Recharts wrappers
│   │   ├── kb/                         # ArticleEditor (Tiptap), KbPortal, KbSearch
│   │   ├── notifications/              # NotificationBell, Toast, Dropdown
│   │   └── plugin/                     # EmbedCodeDisplay, CopyButton, PreviewModal
│   │
│   ├── lib/
│   │   ├── api/                        # All backend API calls — one file per domain
│   │   │   ├── client.ts               # Axios base client with JWT auth header
│   │   │   ├── auth.api.ts
│   │   │   ├── ticket.api.ts
│   │   │   ├── bot.api.ts
│   │   │   ├── kb.api.ts
│   │   │   ├── agent.api.ts
│   │   │   ├── analytics.api.ts
│   │   │   ├── billing.api.ts
│   │   │   ├── plugin.api.ts
│   │   │   └── admin.api.ts
│   │   │
│   │   └── socket.ts                   # Socket.io client — connect, subscribe to events
│   │
│   ├── hooks/
│   │   ├── useSocket.ts
│   │   ├── useTickets.ts
│   │   ├── useSLA.ts
│   │   └── useNotifications.ts
│   │
│   ├── store/                          # Zustand
│   │   ├── auth.store.ts               # user, role, product_id, tenant_id, token
│   │   ├── ticket.store.ts
│   │   └── ui.store.ts
│   │
│   └── types/                          # Mirrors backend types manually
│       ├── ticket.types.ts
│       ├── user.types.ts
│       ├── ai.types.ts
│       └── product.types.ts
│
├── .env.local
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## gkt-widget — Folder Structure

```
gkt-widget/
├── src/
│   ├── index.tsx                       # Entry — reads data-* attrs, mounts widget
│   ├── bootstrap.ts                    # Validates required attrs, injects Shadow DOM root
│   │
│   ├── components/
│   │   ├── ChatWidget.tsx              # Floating bubble + conversation thread
│   │   ├── FormWidget.tsx              # Ticket form UI
│   │   ├── MessageBubble.tsx           # Single message in thread
│   │   ├── QuickReplies.tsx            # Bot quick-reply buttons
│   │   └── HandoffConfirm.tsx          # "Ticket created" confirmation
│   │
│   ├── api/
│   │   ├── client.ts                   # Fetch wrapper — points to BACKEND_URL
│   │   ├── bot.api.ts                  # POST /api/bot/chat, /api/bot/handoff
│   │   └── ticket.api.ts               # POST /api/tickets (form submit)
│   │
│   ├── store/
│   │   └── widget.store.ts             # Zustand — chat history, open/close state
│   │
│   ├── types/
│   │   └── widget.types.ts
│   │
│   └── styles/
│       └── shadow.css                  # Shadow DOM — host CSS cannot bleed in
│
├── vite.config.ts                      # Vite → outputs dist/widget.js (single bundle)
├── .env
├── package.json
├── tsconfig.json
└── README.md                           # Integration guide for client developers
```

> **Build tool:** Vite — simpler than Next.js custom build for standalone bundle output
> **Build output:** `dist/widget.js` — single file, deployed independently

---

## Environment Variables

### gkt-backend `.env`
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
WIDGET_URL="http://localhost:4000"
PLATFORM_DOMAIN="gkt.app"

DATABASE_URL="postgresql://user:pass@localhost:5432/gkt_ticketing"
MONGODB_URI="mongodb://localhost:27017/gkt_ticketing"
QDRANT_URL="http://localhost:6333"
QDRANT_API_KEY="your_qdrant_key"

JWT_SECRET="min_32_char_secret"
JWT_REFRESH_SECRET="min_32_char_refresh_secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

AI_ENCRYPTION_KEY="32_char_key_for_aes256_encryption"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="AIza..."

SENDGRID_API_KEY="SG.xxx"
SENDGRID_FROM_EMAIL="support@gkt.app"
MAILGUN_API_KEY="key-xxx"
MAILGUN_DOMAIN="mail.gkt.app"

TWILIO_ACCOUNT_SID="ACxxx"
TWILIO_AUTH_TOKEN="xxx"
TWILIO_PHONE_NUMBER="+1xxxxxxxxxx"

STRIPE_SECRET_KEY="sk_live_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
RAZORPAY_KEY_ID="rzp_live_xxx"
RAZORPAY_KEY_SECRET="xxx"

MAX_FILE_SIZE_BYTES=5242880
MAX_ATTACHMENTS_PER_TICKET=3
ALLOWED_FILE_TYPES="jpg,jpeg,png,gif,webp,pdf,txt,log,csv"
```

### gkt-frontend `.env.local`
```env
NEXT_PUBLIC_API_URL="http://localhost:5000"
NEXT_PUBLIC_SOCKET_URL="http://localhost:5000"
NEXT_PUBLIC_WIDGET_URL="http://localhost:4000/widget.js"
```

### gkt-widget `.env`
```env
VITE_BACKEND_URL="http://localhost:5000"
```

---

## Package Dependencies

### gkt-backend
```json
{
  "dependencies": {
    "express": "^4",
    "cors": "^2",
    "helmet": "^7",
    "express-rate-limit": "^7",
    "socket.io": "^4",
    "node-cron": "^3",
    "@prisma/client": "^5",
    "mongoose": "^8",
    "@qdrant/js-client-rest": "^1",
    "openai": "^4",
    "@anthropic-ai/sdk": "^0.20",
    "@google/generative-ai": "^0.3",
    "tiktoken": "^1",
    "jsonwebtoken": "^9",
    "bcryptjs": "^2",
    "crypto-js": "^4",
    "@sendgrid/mail": "^8",
    "twilio": "^5",
    "nodemailer": "^6",
    "stripe": "^14",
    "razorpay": "^2",
    "sharp": "^0.33",
    "multer": "^1",
    "zod": "^3",
    "date-fns": "^3",
    "uuid": "^9",
    "json2csv": "^6",
    "jspdf": "^2",
    "jspdf-autotable": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "ts-node-dev": "^2",
    "prisma": "^5",
    "@types/express": "^4",
    "@types/node": "^20",
    "@types/jsonwebtoken": "^9",
    "@types/bcryptjs": "^2",
    "@types/multer": "^1",
    "@types/uuid": "^9"
  }
}
```

### gkt-frontend
```json
{
  "dependencies": {
    "next": "14",
    "react": "^18",
    "react-dom": "^18",
    "axios": "^1",
    "socket.io-client": "^4",
    "zustand": "^4",
    "tailwindcss": "^3",
    "recharts": "^2",
    "@tiptap/react": "^2",
    "next-themes": "^0.3",
    "date-fns": "^3",
    "zod": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18"
  }
}
```

### gkt-widget
```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "zustand": "^4"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5"
  }
}
```

---

## AI Provider Abstraction (gkt-backend only)

```typescript
// src/ai/provider.ts — all adapters implement this interface
interface AIAdapter {
  classify(text: string): Promise<ClassifyResult>
  detectSentiment(text: string): Promise<SentimentResult>
  suggestReply(ticket: Ticket, history: Message[]): Promise<string[]>
  checkDuplicate(text: string, productId: string): Promise<DuplicateResult>
  chat(messages: ChatMessage[], kbContext: string): Promise<string>
  embed(text: string): Promise<number[]>
}
```

Switching provider = flip `enabled` flag in `ai_provider_configs` table. Zero code changes.

---

## Socket.io Rooms (gkt-backend)

```
product:{product_id}      ← all users of a product
agent:{agent_id}          ← specific agent's private channel
ticket:{ticket_id}        ← everyone viewing a specific ticket
admin:{product_id}        ← product admin dashboard
```

**Events emitted by backend:**

| Event | Payload | Who receives |
|---|---|---|
| `ticket:new` | ticket summary | `product:{id}` room |
| `ticket:updated` | updated fields | `ticket:{id}` room |
| `sla:warning` | ticket_id, pct elapsed | `agent:{id}` room |
| `sla:breached` | ticket_id | `agent:{id}` + `admin:{id}` |
| `escalation:triggered` | ticket_id, level | `agent:{id}` + `admin:{id}` |
| `notification:new` | notification object | `agent:{id}` room |
| `bot:message` | message object | `ticket:{id}` room |

---

## Cron Jobs (gkt-backend)

Both run every 5 minutes:

**`src/cron/sla.cron.ts`**
1. Query all open tickets where `sla_deadline` is approaching or passed
2. At 75% elapsed → emit `sla:warning` via Socket.io + write notification row
3. At 100% elapsed → set `sla_breached = true` + email + SMS (P1) + emit `sla:breached`

**`src/cron/escalation.cron.ts`**
1. Query all open tickets grouped by `product_id`
2. Load that product's `escalation_rules` from DB
3. Evaluate each active rule against ticket state (SLA, sentiment trend, vip flag)
4. If rule matches → reassign, elevate priority, notify, write `escalation_logs`

---

## Mobile App — Next Phase

When `gkt-mobile` (React Native) is built it calls **the exact same `gkt-backend`** with zero backend changes needed:
- Add `mobile` to CORS allowed origins in `gkt-backend`
- JWT auth works identically
- Socket.io works in React Native via `socket.io-client`
- Only new work is building the React Native UI screens

---

*See `db-schema.md` for the complete database schema.*
