import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db/postgres';
import bcrypt from 'bcryptjs';
import { encryptPII, hashSearchable } from '../utils/encrypt';

// ─── Products ────────────────────────────────────────────────────────────────

export async function listProducts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const products = await prisma.product.findMany({
      include: {
        feature_flags: true,
        subscription: true,
        _count: {
          select: {
            users: { where: { roleRef: { name: { in: ['l1_agent', 'l2_agent', 'l3_agent', 'tenant_admin'] } } } },
            tickets: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Look up plan names separately
    const planIds = [...new Set(products.map((p) => p.plan_id))];
    const plans = await prisma.billingPlan.findMany({ where: { id: { in: planIds } } });
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));

    const result = products.map((p) => ({
      ...p,
      plan: planMap[p.plan_id] || null,
      agents_count: p._count.users,
      tickets_count: p._count.tickets,
    }));

    res.json(result);
  } catch (err) {
    console.error('listProducts error:', err);
    res.status(500).json({ error: 'Failed to list products' });
  }
}

export async function getProduct(req: AuthRequest, res: Response): Promise<void> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        feature_flags: true,
        plugin_config: true,
        subscription: true,
        tenants: true,
        _count: {
          select: {
            users: { where: { roleRef: { name: { in: ['l1_agent', 'l2_agent', 'l3_agent', 'tenant_admin'] } } } },
            tickets: true,
          },
        },
      },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const plan = await prisma.billingPlan.findUnique({ where: { id: product.plan_id } });

    res.json({ ...product, plan, agents_count: product._count.users, tickets_count: product._count.tickets });
  } catch (err) {
    console.error('getProduct error:', err);
    res.status(500).json({ error: 'Failed to get product' });
  }
}

export async function createProduct(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, slug, plan_id, admin_email, admin_name, admin_password, primary_color } = req.body;

    if (!name || !slug || !plan_id || !admin_email || !admin_name || !admin_password) {
      res.status(400).json({ error: 'name, slug, plan_id, admin_email, admin_name, admin_password are required' });
      return;
    }

    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      res.status(409).json({ error: 'A product with this slug already exists' });
      return;
    }

    const password_hash = await bcrypt.hash(admin_password, 12);

    const product = await prisma.$transaction(async (tx) => {
      // 1. Create the product
      const prod = await tx.product.create({
        data: {
          name,
          slug,
          plan_id,
          primary_color: primary_color || '#2563EB',
          created_by: req.user!.id,
        },
      });

      // 2. Create default feature flags
      await tx.featureFlag.create({
        data: {
          product_id: prod.id,
          updated_by: req.user!.id,
        },
      });

      // 3. Create default plugin config
      await tx.pluginConfig.create({
        data: { product_id: prod.id },
      });

      // 4. Create the tenant admin user (platform-level admin for this product)
      const roleRecord = await tx.userRole.upsert({
        where: { name: 'tenant_admin' },
        update: {},
        create: { name: 'tenant_admin', label: 'Tenant Admin' },
      });
      await tx.user.create({
        data: {
          product_id: prod.id,
          email: encryptPII(admin_email),
          email_hash: hashSearchable(admin_email),
          password_hash,
          name: encryptPII(admin_name),
          role_id: roleRecord.id,
          user_type: 'individual',
        },
      });

      return prod;
    });

    res.status(201).json(product);
  } catch (err) {
    console.error('createProduct error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

export async function updateProduct(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, primary_color, plan_id, is_active } = req.body;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(primary_color !== undefined && { primary_color }),
        ...(plan_id !== undefined && { plan_id }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    res.json(product);
  } catch (err) {
    console.error('updateProduct error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
}

// ─── Feature Flags ───────────────────────────────────────────────────────────

export async function getFeatureFlags(req: AuthRequest, res: Response): Promise<void> {
  try {
    const flags = await prisma.featureFlag.findUnique({
      where: { product_id: req.params.productId },
    });
    if (!flags) {
      res.status(404).json({ error: 'Feature flags not found for this product' });
      return;
    }
    res.json(flags);
  } catch (err) {
    console.error('getFeatureFlags error:', err);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
}

export async function updateFeatureFlags(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const {
      chatbot_enabled, webform_enabled, email_intake_enabled,
      rest_api_enabled, sms_alerts_enabled, white_label_enabled,
      billing_enforced, ai_suggestions_enabled, kb_public_enabled,
    } = req.body;

    const flags = await prisma.featureFlag.update({
      where: { product_id: productId },
      data: {
        ...(chatbot_enabled !== undefined && { chatbot_enabled }),
        ...(webform_enabled !== undefined && { webform_enabled }),
        ...(email_intake_enabled !== undefined && { email_intake_enabled }),
        ...(rest_api_enabled !== undefined && { rest_api_enabled }),
        ...(sms_alerts_enabled !== undefined && { sms_alerts_enabled }),
        ...(white_label_enabled !== undefined && { white_label_enabled }),
        ...(billing_enforced !== undefined && { billing_enforced }),
        ...(ai_suggestions_enabled !== undefined && { ai_suggestions_enabled }),
        ...(kb_public_enabled !== undefined && { kb_public_enabled }),
        updated_by: req.user!.id,
      },
    });

    res.json(flags);
  } catch (err) {
    console.error('updateFeatureFlags error:', err);
    res.status(500).json({ error: 'Failed to update feature flags' });
  }
}

// ─── Billing Plans ───────────────────────────────────────────────────────────

export async function listPlans(req: AuthRequest, res: Response): Promise<void> {
  try {
    const plans = await prisma.billingPlan.findMany({
      where: { is_active: true },
      orderBy: { price_usd: 'asc' },
    });
    res.json(plans);
  } catch (err) {
    console.error('listPlans error:', err);
    res.status(500).json({ error: 'Failed to list plans' });
  }
}

export async function createPlan(req: AuthRequest, res: Response): Promise<void> {
  try {
    const plan = await prisma.billingPlan.create({ data: req.body });
    res.status(201).json(plan);
  } catch (err) {
    console.error('createPlan error:', err);
    res.status(500).json({ error: 'Failed to create plan' });
  }
}

export async function updatePlan(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, max_agents, max_tickets_per_month, max_products, price_usd, price_inr, overage_per_ticket_usd, overage_per_ticket_inr, is_active } = req.body;

    const plan = await prisma.billingPlan.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(max_agents !== undefined && { max_agents }),
        ...(max_tickets_per_month !== undefined && { max_tickets_per_month }),
        ...(max_products !== undefined && { max_products }),
        ...(price_usd !== undefined && { price_usd }),
        ...(price_inr !== undefined && { price_inr }),
        ...(overage_per_ticket_usd !== undefined && { overage_per_ticket_usd }),
        ...(overage_per_ticket_inr !== undefined && { overage_per_ticket_inr }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    res.json(plan);
  } catch (err) {
    console.error('updatePlan error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
}

export async function deletePlan(req: AuthRequest, res: Response): Promise<void> {
  try {
    await prisma.billingPlan.update({
      where: { id: req.params.id },
      data: { is_active: false },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('deletePlan error:', err);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
}

// ─── Platform Analytics ──────────────────────────────────────────────────────

export async function getPlatformStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [productCount, agentCount, ticketCount, activeProducts] = await Promise.all([
      prisma.product.count(),
      prisma.user.count({ where: { roleRef: { name: { in: ['l1_agent', 'l2_agent', 'l3_agent', 'tenant_admin'] } } } }),
      prisma.ticket.count(),
      prisma.product.count({ where: { is_active: true } }),
    ]);

    res.json({
      total_products: productCount,
      active_products: activeProducts,
      total_agents: agentCount,
      total_tickets: ticketCount,
    });
  } catch (err) {
    console.error('getPlatformStats error:', err);
    res.status(500).json({ error: 'Failed to get platform stats' });
  }
}

// ─── Tenant Products (all tenants, for super-admin dashboard) ──────────────────

export async function listTenantProducts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantProducts = await prisma.tenantProduct.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            product_id: true,
            plan_id: true,
            product: { select: { id: true, name: true, slug: true } },
            plan: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            product_agents: true,
            sla_policies: true,
            escalation_rules: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const tpIds = tenantProducts.map((tp) => tp.id).filter(Boolean);
    const ticketCounts =
      tpIds.length > 0
        ? await prisma.ticket.groupBy({
            by: ['tenant_product_id'],
            where: { tenant_product_id: { in: tpIds } },
            _count: { id: true },
          })
        : [];
    const ticketCountMap = Object.fromEntries(
      ticketCounts.map((g) => [g.tenant_product_id, g._count.id])
    );

    const kbCounts =
      tpIds.length > 0
        ? await prisma.kbArticle.groupBy({
            by: ['tenant_product_id'],
            where: { tenant_product_id: { in: tpIds } },
            _count: { id: true },
          })
        : [];
    const kbCountMap = Object.fromEntries(
      kbCounts.map((g) => [g.tenant_product_id!, g._count.id])
    );

    const result = tenantProducts.map((tp) => ({
      id: tp.id,
      name: tp.name,
      description: tp.description,
      website: tp.website,
      status: tp.status,
      l0_model: tp.l0_model,
      l0_provider: tp.l0_provider,
      created_at: tp.created_at,
      created_by: tp.created_by,
      tenant_id: tp.tenant_id,
      tenant_name: tp.tenant?.name ?? null,
      tenant_slug: tp.tenant?.slug ?? null,
      product_id: tp.tenant?.product_id ?? null,
      product_name: tp.tenant?.product?.name ?? null,
      product_slug: tp.tenant?.product?.slug ?? null,
      plan_name: tp.tenant?.plan?.name ?? null,
      agents_count: tp._count.product_agents,
      tickets_count: ticketCountMap[tp.id] ?? 0,
      sla_count: tp._count.sla_policies,
      escalation_count: tp._count.escalation_rules,
      kb_articles_count: kbCountMap[tp.id] ?? 0,
    }));

    res.json(result);
  } catch (err) {
    console.error('listTenantProducts error:', err);
    res.status(500).json({ error: 'Failed to list tenant products' });
  }
}

export async function getTenantProductStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [total, active, totalAgents, totalTickets, totalTenants] = await Promise.all([
      prisma.tenantProduct.count(),
      prisma.tenantProduct.count({ where: { status: 'active' } }),
      prisma.productAgent.count(),
      prisma.ticket.count(),
      prisma.tenant.count(),
    ]);

    res.json({
      total_tenant_products: total,
      active_tenant_products: active,
      total_agents: totalAgents,
      total_tickets: totalTickets,
      total_tenants: totalTenants,
    });
  } catch (err) {
    console.error('getTenantProductStats error:', err);
    res.status(500).json({ error: 'Failed to get tenant product stats' });
  }
}

// ─── Tickets (all tickets across platform, for super-admin dashboard) ─────────

export async function listTickets(req: AuthRequest, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string | undefined>;
    const status = q.status;
    const tenant_product_id = q.tenant_product_id;
    const sla_breached = q.sla_breached === 'true' ? true : q.sla_breached === 'false' ? false : undefined;
    const take = Math.min(200, Math.max(1, q.take != null ? parseInt(q.take, 10) : 50));
    const skip = Math.max(0, q.skip != null ? parseInt(q.skip, 10) : 0);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tenant_product_id) where.tenant_product_id = tenant_product_id;
    if (sla_breached !== undefined) where.sla_breached = sla_breached;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: [{ updated_at: 'desc' }],
        take,
        skip,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    const ticketIds = tickets.map((t) => t.id);
    const botCounts =
      ticketIds.length > 0
        ? await prisma.ticketComment.groupBy({
            by: ['ticket_id'],
            where: { ticket_id: { in: ticketIds }, is_bot: true },
            _count: { id: true },
          })
        : [];
    const botCountMap = Object.fromEntries(botCounts.map((c) => [c.ticket_id, c._count.id]));

    const tenantProductIds = [...new Set(tickets.map((t) => t.tenant_product_id).filter(Boolean))] as string[];
    const tenantProducts =
      tenantProductIds.length > 0
        ? await prisma.tenantProduct.findMany({
            where: { id: { in: tenantProductIds } },
            select: { id: true, name: true },
          })
        : [];
    const tpMap = Object.fromEntries(tenantProducts.map((tp) => [tp.id, tp]));

    const items = tickets.map((t) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      source: t.source,
      sla_breached: t.sla_breached,
      sla_deadline: t.sla_deadline,
      resolved_at: t.resolved_at,
      closed_at: t.closed_at,
      created_at: t.created_at,
      updated_at: t.updated_at,
      tenant_id: t.tenant_id,
      tenant_name: t.tenant?.name ?? null,
      tenant_slug: t.tenant?.slug ?? null,
      product_id: t.product_id,
      product_name: t.product?.name ?? null,
      tenant_product_id: t.tenant_product_id,
      tenant_product_name: t.tenant_product_id ? tpMap[t.tenant_product_id]?.name ?? null : null,
      bot_replies_count: botCountMap[t.id] ?? 0,
    }));

    res.json({ items, total, take, skip });
  } catch (err) {
    console.error('listTickets (super-admin) error:', err);
    res.status(500).json({ error: 'Failed to list tickets' });
  }
}

export async function getTicketStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [total, byStatus, breached, resolvedClosed, withBotReplies] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.ticket.count({ where: { sla_breached: true } }),
      prisma.ticket.count({ where: { status: { in: ['resolved', 'closed'] } } }),
      prisma.ticketComment.count({ where: { is_bot: true } }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count.id]));

    res.json({
      total_tickets: total,
      by_status: statusMap,
      sla_breached_count: breached,
      resolved_or_closed_count: resolvedClosed,
      bot_replies_total: withBotReplies,
    });
  } catch (err) {
    console.error('getTicketStats error:', err);
    res.status(500).json({ error: 'Failed to get ticket stats' });
  }
}
