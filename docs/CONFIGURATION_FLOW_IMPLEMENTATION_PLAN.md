# Configuration Flow: Product-Centric Setup Status & Implementation Plan

## 1. Goal

- **Visibility:** Admin sees which **product** (TenantProduct, e.g. "Rewire", "Relearn") has which configuration areas **not yet done**.
- **Action:** Selecting a product opens a **checklist for that product**; user can complete only the incomplete items for that product.
- **Flow:** Configuration becomes **product-first**: choose product → see what’s missing → configure.

---

## 2. Reference Implementations & UX Patterns

| Source | Pattern | Use in our app |
|--------|--------|----------------|
| **Zendesk (Guide / Support)** | Per-brand “Get started” checklist; each brand has setup steps with done/not-done. | One checklist per TenantProduct; steps = Agents, KB, L0 bot (+ tenant-wide steps once). |
| **Intercom** | Product/settings → “Complete your setup” with progress (e.g. 4/7). | Show “3/8 configured” per product and overall. |
| **Freshdesk / Zoho** | Group/product selector in settings; some settings are per-product. | Sidebar or dropdown: “Configure: [Product A ▼]” then list only that product’s steps. |
| **Userflow / onboarding checklists** | Checklist with checkmarks and “Configure” CTA per item. | Each config area = one row: status (done / not done) + “Configure” link. |
| **AWS / GCP consoles** | “Resource” (e.g. instance) → “Configuration” tab with status per section. | Product = resource; Configuration = tab with per-area status. |

**Recommended pattern:** **Product-first checklist**

1. **Configuration** in sidebar opens a **Configuration hub**.
2. Hub shows **list of tenant products** with a **setup status** per product (e.g. “4/6” or “3 incomplete”).
3. User **selects one product** (card or dropdown).
4. For that product, show a **checklist**: each config area (Agents, Ticket settings, SLA, …) with:
   - **Done** (checkmark) vs **Not done** (warning or empty).
   - **“Configure”** button that opens the existing config UI (with product context where needed).
5. **Tenant-level** areas (Ticket settings, SLA, Escalation, Channels, Branding) can be shown once at the top or under a “Workspace” section; “done” applies to the whole tenant.

---

## 3. Configuration Areas & Scoping (Current Data Model)

| Area | Scope | Stored in | "Configured" rule |
|------|--------|-----------|-------------------|
| **Agents** | Per TenantProduct | `product_agents` (tenant_product_id, user_id) | At least one row with this `tenant_product_id` |
| **Ticket settings** | Tenant | `tenant_ticket_settings` (tenant_id) | Row exists for tenant |
| **SLA** | Global product (tenant.product_id) | `sla_policies` (product_id) | At least one row for tenant’s `product_id` |
| **Escalation** | Global product | `escalation_rules` (product_id) | At least one row for tenant’s `product_id` |
| **Knowledge base** | Per TenantProduct (optional) | `kb_articles` / `kb_sources` (tenant_product_id) | At least one article or source with this `tenant_product_id` (or we could require both; defined in plan below) |
| **L0 AI bot** | Per TenantProduct | `tenant_products.l0_model`, `l0_provider` | Both `l0_model` and `l0_provider` set |
| **Support channels** | Tenant | `tenant_channel_settings` (tenant_id) | Row exists for tenant |
| **Branding** | Tenant + Product | Tenant + Product tables (logo, primary_color, custom_domain) | Consider “done” if tenant has been updated once or we have a dedicated “branding_completed” flag; for MVP we can treat as “done” if tenant has logo or primary_color ever set |

**Per-product areas:** Agents, KB, L0 bot.  
**Tenant-only (or global product):** Ticket settings, SLA, Escalation, Channels, Branding.

---

## 4. New API: Configuration Status

### 4.1 Endpoint

- **GET** ` /api/onboarding/configuration-status`  
  - Auth: tenant admin (existing auth middleware).  
  - Returns: status for **all tenant products** plus **tenant-level** and **global-product-level** areas.

### 4.2 Response shape (recommended)

```ts
{
  "tenant_id": "uuid",
  "product_id": "uuid",           // tenant's global product_id (for SLA/Escalation)
  "tenant_level": {
    "ticket_settings": true,
    "sla": true,
    "escalation": true,
    "channels": true,
    "branding": true
  },
  "products": [
    {
      "id": "tenant_product_uuid",
      "name": "Rewire",
      "status": "active",
      "configuration": {
        "agents": true,
        "kb": false,
        "l0_bot": true
      },
      "incomplete_count": 1,
      "complete_count": 2
    }
  ]
}
```

- **tenant_level:** booleans for each tenant-wide (or global-product) area.  
- **products[].configuration:** booleans for agents, kb, l0_bot.  
- **incomplete_count / complete_count:** number of per-product areas not done / done (for badges).

### 4.3 Backend logic (per area)

- **agents:** `ProductAgent` count for this `tenant_product_id` > 0.  
- **kb:** at least one of: `KbArticle` or `KbSource` with this `tenant_product_id` (or both; product owner can decide).  
- **l0_bot:** `TenantProduct.l0_model` and `l0_provider` both non-null.  
- **ticket_settings:** `TenantTicketSettings` exists for `tenant_id`.  
- **sla:** `SlaPolicy` exists for `product_id` (tenant’s product_id).  
- **escalation:** `EscalationRule` exists for `product_id`.  
- **channels:** `TenantChannelSettings` exists for `tenant_id`.  
- **branding:** e.g. tenant has `logo_base64` or `primary_color` ever set; or add a simple “branding_updated_at” if you prefer.

---

## 5. Application Flow Changes

### 5.1 Sidebar

- Keep **Configuration** as a single entry.
- Clicking it opens the **Configuration hub** (new default view when entering Configuration), not the first config sub-item.

### 5.2 Configuration hub (new view)

- **Title:** e.g. “Configuration” or “Setup status”.
- **Product selector:** Dropdown or card list: “Select a product to configure” → list of tenant products with status badge (e.g. “2/3” or “1 incomplete”).
- **Selected product:** Show product name and then the **checklist**:
  - **Per-product (for this product):** Agents, Knowledge base, L0 AI bot. Each row: status (done / not done) + “Configure” → existing Agents / KB / L0 UI, with `tenant_product_id` set to selected product.
  - **Tenant-level (show once):** Ticket settings, SLA, Escalation, Support channels, Branding. Each row: status + “Configure” → existing UI (no product selector needed for these).

### 5.3 When “Configure” is clicked

- **Agents:** Open existing Agents config; optionally pre-filter or highlight the selected product in “Assigned products” (or open with selected product as context so that adding an agent can default to this product).  
- **KB:** Open KB config with **selected product** pre-selected in the product dropdown (tenant_product_id in all KB API calls).  
- **L0 AI bot:** Open L0 config with **selected product** pre-selected.  
- **Ticket settings / SLA / Escalation / Channels / Branding:** Open existing screens as today (tenant-level).

### 5.4 Optional: URL state

- Support query params, e.g. `?product=<tenant_product_id>&section=kb`, so that:
  - From hub, “Configure KB” for Product A → `/admin/dashboard?product=<id>&section=kb` (or same page with state).
  - On load, if `product` and `section` are present, open Configuration hub with that product selected and either show the checklist with that section expanded or navigate directly to that section’s form.

---

## 6. Phased Implementation Plan

### Phase 1: Backend – configuration status API

1. **Add** `GET /api/onboarding/configuration-status` in onboarding (or admin) routes.
2. **Implement** in onboarding controller (e.g. `getConfigurationStatus`):
   - Load tenant, tenant_products, and for each product run the “configured” checks (agents, kb, l0_bot).
   - Load tenant_level flags (ticket_settings, sla, escalation, channels, branding).
   - Return JSON as in §4.2.
3. **No DB migrations** required; only read from existing tables.
4. **Frontend:** Call this API from the dashboard when entering Configuration (or on dashboard load) and store result in state.

### Phase 2: Frontend – Configuration hub and product selector

1. **Configuration entry point:** When user clicks “Configuration” in sidebar, show the **Configuration hub** (product list + selector) instead of immediately showing “Agents” or another sub-section.
2. **State:**  
   - `configProductId: string | null` = selected tenant product for configuration.  
   - `configurationStatus: ConfigurationStatus | null` = result of GET configuration-status.
3. **Hub UI:**
   - Fetch and display `configurationStatus`.
   - List products with status badges (e.g. “2/3 configured”).
   - On product select, set `configProductId` and show the checklist for that product + tenant-level section.
4. **Checklist UI:** For selected product, render one row per area (Agents, KB, L0; then Ticket settings, SLA, Escalation, Channels, Branding) with:
   - Done / Not done (from `configurationStatus`).
   - “Configure” button → set `activeConfig` to the corresponding section (e.g. `agents`, `kb`, `ai-bot`) and, for product-scoped areas, set a “context product” so that KB and L0 (and optionally Agents) use the selected product.

### Phase 3: Pass selected product into product-scoped config UIs

1. **KB:** Ensure KbInline (and KB API calls) receive and use `tenant_product_id` from hub selection (e.g. from `configProductId`). When opening from hub “Configure KB”, pre-set the product dropdown to `configProductId`.
2. **L0 AI bot:** Same: AiBotInline receives `configProductId` and pre-selects that product; on save, use that `tenant_product_id`.
3. **Agents:** Optional: when opening from hub for “Product X”, pre-select “Product X” in “Assigned products” when adding a new agent, or show a filter “Agents for Product X” (implementation choice).

### Phase 4: Sidebar and navigation polish

1. **Configuration sub-items:** Either:
   - **Option A:** Keep Agents, Ticket settings, … as sub-items under Configuration; clicking them still opens that section, but the “default” Configuration view is the hub.  
   - **Option B:** Remove sub-items and only show “Configuration”; everything is reached from the hub checklist.  
   - Recommendation: **Option A** for backward compatibility and power users who want to go directly to a section.
2. **Badge on Configuration:** Optional: show a badge like “2 incomplete” (across all products) using `configurationStatus.products` (sum of incomplete_count or similar).

### Phase 5: Optional enhancements

- **Deep link:** `?product=<id>&section=kb` to open hub with product and section.
- **Tenant-level only view:** If no product is selected, show only tenant-level checklist (Ticket settings, SLA, Escalation, Channels, Branding).
- **“Mark as done” override:** If you add explicit “setup_completed” flags in the future, allow marking an area as done without filling every field (optional).

---

## 7. File-Level Checklist

### Backend

| File | Change |
|------|--------|
| `gkt-backend/src/controllers/onboarding.controller.ts` | Add `getConfigurationStatus(req, res)`: load tenant, tenant_products, run all “configured” checks, return JSON. |
| `gkt-backend/src/routes/onboarding.routes.ts` | Add `GET /configuration-status`, auth middleware. |

### Frontend

| File | Change |
|------|--------|
| `gkt-frontend/src/app/(product-admin)/admin/dashboard/page.tsx` | Add state: `configProductId`, `configurationStatus`. When `activeConfig === 'configuration-hub'` (or first time in Configuration), show hub (product list + checklist). Fetch configuration-status on mount or when entering Configuration. |
| Same | When “Configure” is clicked from hub for a product-scoped area, set `activeConfig` to that section and set “context product” (e.g. `configProductId`) so KbInline / AiBotInline use it. |
| Same | KbInline: accept optional `initialTenantProductId` and use it to pre-select product and send in API calls. |
| Same | AiBotInline: same `initialTenantProductId` for L0 model selection. |
| `gkt-frontend/src/lib/api/onboarding.api.ts` | Add `getConfigurationStatus(): Promise<ConfigurationStatus>`. |

### Types

| File | Change |
|------|--------|
| Frontend (e.g. dashboard or api types) | Define `ConfigurationStatus` and per-product `ProductConfigurationStatus` matching §4.2. |

---

## 8. Summary

- **Backend:** One new read-only API returns configuration status per product (agents, kb, l0_bot) and per tenant (ticket_settings, sla, escalation, channels, branding).
- **Frontend:** Configuration becomes product-first: hub lists products with status → user selects product → checklist shows what’s done/not done → “Configure” opens existing UIs with product context where needed.
- **No schema change** required for Phase 1–4; only reads from existing tables. Optional later: store explicit “setup_completed” or “branding_updated_at” if you want stricter or faster checks.

This plan gives you a clear path to “see which product has what not configured” and “select that product to configure what’s not done,” aligned with common SaaS configuration patterns.
