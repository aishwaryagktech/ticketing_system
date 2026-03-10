import { Response } from 'express';
import { prisma } from '../db/postgres';
import { AuthRequest } from '../middleware/auth';
import { encryptPII, hashSearchable } from '../utils/encrypt';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function getOnboarding(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const tenantId = req.user?.tenant_id;
  const productId = req.user?.product_id;
  if (!userId || !tenantId || !productId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        tenant_products: true,
        ticket_settings: true,
      },
    });
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const agentCount = await prisma.user.count({
      where: {
        tenant_id: tenantId,
        roleRef: { name: { in: ['l1_agent', 'l2_agent', 'l3_agent', 'tenant_admin'] } },
      },
    });
    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan_id: tenant.plan_id,
        onboarding_step: tenant.onboarding_step,
        plan: tenant.plan,
        tenant_products: tenant.tenant_products,
        ticket_settings: tenant.ticket_settings,
        agent_count: agentCount,
      },
    });
  } catch (e) {
    console.error('getOnboarding error:', e);
    res.status(500).json({ error: 'Failed to load onboarding state' });
  }
}

export async function setPlan(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const { plan_id } = req.body;
  if (!plan_id) {
    res.status(400).json({ error: 'plan_id required' });
    return;
  }
  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { plan_id, onboarding_step: 'plan_selected' },
    });
    res.json({ message: 'Plan selected', onboarding_step: 'plan_selected' });
  } catch (e) {
    console.error('setPlan error:', e);
    res.status(500).json({ error: 'Failed to set plan' });
  }
}

export async function updateStep(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const { step } = req.body;
  if (!step || typeof step !== 'string') {
    res.status(400).json({ error: 'step required' });
    return;
  }
  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { onboarding_step: step },
    });
    res.json({ message: 'Step updated', onboarding_step: step });
  } catch (e) {
    console.error('updateStep error:', e);
    res.status(500).json({ error: 'Failed to update step' });
  }
}

export async function listTenantProducts(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  try {
    const list = await prisma.tenantProduct.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
    });
    res.json(list);
  } catch (e) {
    console.error('listTenantProducts error:', e);
    res.status(500).json({ error: 'Failed to list products' });
  }
}

export async function createTenantProduct(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const { name, description, status } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name required' });
    return;
  }
  try {
    const created = await prisma.tenantProduct.create({
      data: {
        tenant_id: tenantId,
        name: name.trim(),
        description: description?.trim() || null,
        status: status === 'inactive' ? 'inactive' : 'active',
      },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error('createTenantProduct error:', e);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

export async function listAgents(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const productId = req.user?.product_id;
  if (!tenantId || !productId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  try {
    const users = await prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        product_id: productId,
        roleRef: { name: { in: ['l1_agent', 'l2_agent', 'l3_agent', 'tenant_admin'] } },
        is_active: true,
      },
      include: { product_agents: { include: { tenant_product: true } } },
    });
    res.json(users);
  } catch (e) {
    console.error('listAgents error:', e);
    res.status(500).json({ error: 'Failed to list agents' });
  }
}

export async function inviteAgent(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const productId = req.user?.product_id;
  if (!tenantId || !productId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const { name, email, role, assigned_products, support_level } = req.body;
  // assigned_products: array of tenant_product_id; support_level: L1|L2|L3
  if (!name || !email) {
    res.status(400).json({ error: 'name and email required' });
    return;
  }
  try {
    const emailHash = hashSearchable(email);
    const existing = await prisma.user.findFirst({
      where: { product_id: productId, email_hash: emailHash },
    });
    if (existing) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }
    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const desiredRoleName = role === 'tenant_admin' ? 'tenant_admin' : role === 'l2_agent' ? 'l2_agent' : role === 'l3_agent' ? 'l3_agent' : 'l1_agent';
    const roleRecord = await prisma.userRole.upsert({
      where: { name: desiredRoleName },
      update: {},
      create: { name: desiredRoleName, label: desiredRoleName.replace('_', ' ').toUpperCase() },
    });

    const user = await prisma.user.create({
      data: {
        product_id: productId,
        tenant_id: tenantId,
        email: encryptPII(email),
        email_hash: emailHash,
        password_hash: passwordHash,
        name: encryptPII(name.trim()),
        role_id: roleRecord.id,
        user_type: 'tenant_user',
      },
    });
    const assignments = Array.isArray(assigned_products) ? assigned_products : [];
    const level = support_level === 'L2' ? 'L2' : support_level === 'L3' ? 'L3' : 'L1';
    for (const tpId of assignments) {
      await prisma.productAgent.create({
        data: { tenant_product_id: tpId, user_id: user.id, support_level: level },
      }).catch(() => { /* ignore duplicate */ });
    }
    res.status(201).json({ user: { id: user.id, email }, message: 'Agent invited (password set; email later)' });
  } catch (e) {
    console.error('inviteAgent error:', e);
    res.status(500).json({ error: 'Failed to invite agent' });
  }
}

export async function upsertTicketSettings(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const {
    ticket_prefix,
    default_priority,
    categories,
    attachment_limit_mb,
    assignment_rule,
  } = req.body;
  try {
    const data: Record<string, unknown> = {};
    if (ticket_prefix != null) data.ticket_prefix = String(ticket_prefix).slice(0, 20);
    if (default_priority != null) data.default_priority = String(default_priority);
    if (Array.isArray(categories)) data.categories = categories;
    if (typeof attachment_limit_mb === 'number') data.attachment_limit_mb = attachment_limit_mb;
    if (assignment_rule != null) data.assignment_rule = String(assignment_rule);
    const settings = await prisma.tenantTicketSettings.upsert({
      where: { tenant_id: tenantId },
      create: { tenant_id: tenantId, ...data } as never,
      update: data as never,
    });
    res.json(settings);
  } catch (e) {
    console.error('upsertTicketSettings error:', e);
    res.status(500).json({ error: 'Failed to save ticket settings' });
  }
}

export async function upsertSlaPolicies(req: AuthRequest, res: Response): Promise<void> {
  const productId = req.user?.product_id;
  if (!productId) {
    res.status(403).json({ error: 'Product required' });
    return;
  }

  const { policies } = req.body as {
    policies?: Array<{
      priority: 'p1' | 'p2' | 'p3' | 'p4' | string;
      response_time_mins: number;
      resolution_time_mins: number;
      warning_threshold_pct?: number;
    }>;
  };

  if (!Array.isArray(policies) || policies.length === 0) {
    res.status(400).json({ error: 'policies array required' });
    return;
  }

  try {
    const allowed = new Set(['p1', 'p2', 'p3', 'p4']);
    const results = [];

    for (const p of policies) {
      const priority = String(p.priority).toLowerCase();
      if (!allowed.has(priority)) continue;

      const response_time_mins = Number(p.response_time_mins);
      const resolution_time_mins = Number(p.resolution_time_mins);
      const warning_threshold_pct =
        p.warning_threshold_pct != null ? Number(p.warning_threshold_pct) : undefined;

      if (!Number.isFinite(response_time_mins) || !Number.isFinite(resolution_time_mins)) continue;
      if (response_time_mins <= 0 || resolution_time_mins <= 0) continue;

      const saved = await prisma.slaPolicy.upsert({
        where: { product_id_priority: { product_id: productId, priority: priority as any } },
        create: {
          product_id: productId,
          priority: priority as any,
          response_time_mins,
          resolution_time_mins,
          ...(warning_threshold_pct != null ? { warning_threshold_pct } : {}),
        },
        update: {
          response_time_mins,
          resolution_time_mins,
          ...(warning_threshold_pct != null ? { warning_threshold_pct } : {}),
        },
      });
      results.push(saved);
    }

    res.json({ saved: results });
  } catch (e) {
    console.error('upsertSlaPolicies error:', e);
    res.status(500).json({ error: 'Failed to save SLA policies' });
  }
}

export async function listSlaPolicies(req: AuthRequest, res: Response): Promise<void> {
  const productId = req.user?.product_id;
  if (!productId) {
    res.status(403).json({ error: 'Product required' });
    return;
  }
  try {
    const rows = await prisma.slaPolicy.findMany({
      where: { product_id: productId },
      orderBy: { priority: 'asc' },
    });
    res.json(rows);
  } catch (e) {
    console.error('listSlaPolicies error:', e);
    res.status(500).json({ error: 'Failed to load SLA policies' });
  }
}

export async function listEscalationRules(req: AuthRequest, res: Response): Promise<void> {
  const productId = req.user?.product_id;
  if (!productId) {
    res.status(403).json({ error: 'Product required' });
    return;
  }
  try {
    const rows = await prisma.escalationRule.findMany({
      where: { product_id: productId },
      orderBy: [{ level: 'asc' }, { created_at: 'asc' }],
    });
    res.json(rows);
  } catch (e) {
    console.error('listEscalationRules error:', e);
    res.status(500).json({ error: 'Failed to load escalation rules' });
  }
}

export async function upsertEscalationRules(req: AuthRequest, res: Response): Promise<void> {
  const productId = req.user?.product_id;
  if (!productId) {
    res.status(403).json({ error: 'Product required' });
    return;
  }

  const { rules } = req.body as {
    rules?: Array<{
      id?: string;
      level: number;
      trigger_type: string;
      trigger_threshold_mins?: number | null;
      sentiment_trigger?: string | null;
      action_assign_role: string;
      notify_roles?: any;
      notify_sms?: boolean;
      is_active?: boolean;
    }>;
  };

  if (!Array.isArray(rules) || rules.length === 0) {
    res.status(400).json({ error: 'rules array required' });
    return;
  }

  try {
    const saved = [];
    for (const r of rules) {
      const level = Number(r.level);
      if (!Number.isFinite(level) || level < 1 || level > 5) continue;

      const trigger_type = String(r.trigger_type || '').trim();
      const action_assign_role = String(r.action_assign_role || '').trim();
      if (!trigger_type || !action_assign_role) continue;

      const data: any = {
        product_id: productId,
        level,
        trigger_type: trigger_type as any,
        trigger_threshold_mins:
          r.trigger_threshold_mins === null || r.trigger_threshold_mins === undefined
            ? null
            : Number(r.trigger_threshold_mins),
        sentiment_trigger: r.sentiment_trigger ?? null,
        action_assign_role,
        notify_roles: r.notify_roles ?? [],
        notify_sms: !!r.notify_sms,
        is_active: r.is_active !== false,
      };

      if (r.id) {
        const updated = await prisma.escalationRule.update({
          where: { id: r.id },
          data,
        });
        saved.push(updated);
      } else {
        const created = await prisma.escalationRule.create({ data });
        saved.push(created);
      }
    }

    res.json({ saved });
  } catch (e) {
    console.error('upsertEscalationRules error:', e);
    res.status(500).json({ error: 'Failed to save escalation rules' });
  }
}

export async function getChannelSettings(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  try {
    const settings = await prisma.tenantChannelSettings.findUnique({
      where: { tenant_id: tenantId },
    });
    if (!settings) {
      res.json(null);
      return;
    }
    res.json(settings);
  } catch (e) {
    console.error('getChannelSettings error:', e);
    res.status(500).json({ error: 'Failed to load channel settings' });
  }
}

export async function upsertChannelSettings(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const {
    chat_enabled,
    chat_position,
    chat_primary_color,
    webform_enabled,
    webform_path,
    email_enabled,
    support_email,
    default_product_id,
  } = req.body || {};
  try {
    const data: any = {};
    if (typeof chat_enabled === 'boolean') data.chat_enabled = chat_enabled;
    if (chat_position) data.chat_position = String(chat_position);
    if (chat_primary_color) data.chat_primary_color = String(chat_primary_color);
    if (typeof webform_enabled === 'boolean') data.webform_enabled = webform_enabled;
    if (webform_path) data.webform_path = String(webform_path);
    if (typeof email_enabled === 'boolean') data.email_enabled = email_enabled;
    if (support_email !== undefined) data.support_email = support_email ? String(support_email) : null;
    if (default_product_id !== undefined) data.default_product_id = default_product_id ? String(default_product_id) : null;

    const settings = await prisma.tenantChannelSettings.upsert({
      where: { tenant_id: tenantId },
      create: { tenant_id: tenantId, ...data },
      update: data,
    });
    res.json(settings);
  } catch (e) {
    console.error('upsertChannelSettings error:', e);
    res.status(500).json({ error: 'Failed to save channel settings' });
  }
}

export async function getBranding(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const productId = req.user?.product_id;
  if (!tenantId || !productId) {
    res.status(403).json({ error: 'Tenant & product required' });
    return;
  }
  try {
    const [tenant, product] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.product.findUnique({ where: { id: productId } }),
    ]);
    if (!tenant || !product) {
      res.status(404).json({ error: 'Tenant or product not found' });
      return;
    }
    res.json({
      logo_base64: tenant.logo_base64 ?? null,
      primary_color: product.primary_color,
      custom_domain: (tenant as any).custom_domain ?? null,
    });
  } catch (e) {
    console.error('getBranding error:', e);
    res.status(500).json({ error: 'Failed to load branding' });
  }
}

export async function upsertBranding(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const productId = req.user?.product_id;
  if (!tenantId || !productId) {
    res.status(403).json({ error: 'Tenant & product required' });
    return;
  }
  const { logo_base64, primary_color, custom_domain } = req.body || {};
  try {
    const ops: Promise<unknown>[] = [];
    if (logo_base64 !== undefined || custom_domain !== undefined) {
      const data: any = {};
      if (logo_base64 !== undefined) data.logo_base64 = logo_base64 || null;
      if (custom_domain !== undefined) data.custom_domain = custom_domain || null;
      ops.push(
        prisma.tenant.update({
          where: { id: tenantId },
          data,
        })
      );
    }
    if (primary_color !== undefined) {
      ops.push(
        prisma.product.update({
          where: { id: productId },
          data: { primary_color: String(primary_color) || '#2563EB' },
        })
      );
    }
    await Promise.all(ops);
    // Return latest branding
    const [tenant, product] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.product.findUnique({ where: { id: productId } }),
    ]);
    res.json({
      logo_base64: tenant?.logo_base64 ?? null,
      primary_color: product?.primary_color ?? '#2563EB',
      custom_domain: (tenant as any)?.custom_domain ?? null,
    });
  } catch (e) {
    console.error('upsertBranding error:', e);
    res.status(500).json({ error: 'Failed to save branding' });
  }
}

export async function seedRewireStarterKb(req: AuthRequest, res: Response): Promise<void> {
  const productId = req.user?.product_id;
  const userId = req.user?.id;
  if (!productId || !userId) {
    res.status(403).json({ error: 'Product required' });
    return;
  }

  // Minimal starter pack based on rewirelearning.com beta flow
  const starter = [
    {
      title: 'Getting started with ReWire Beta',
      category: 'Getting Started',
      audience: 'student',
      tags: ['rewire', 'beta', 'onboarding'],
      body: [
        '## Overview',
        'ReWire is an AI study agent trained on your regulation, units, and topics, and can answer in multiple languages.',
        '',
        '## How to claim your spot',
        '1. Open the ReWire beta page and click **Claim your spot**.',
        '2. Enter your **Full Name**, **Email**, and **Phone Number**.',
        '3. Add your academic details: **College**, **City**, **University**, **Department**, **Year**, and **Semester**.',
        '4. Submit to reserve your spot in the batch.',
        '',
        '## What happens next',
        '- Your dedicated instance is provisioned based on your selected university/department/semester.',
        '- You receive **login credentials via email** once provisioning is complete.',
      ].join('\\n'),
    },
    {
      title: 'I did not receive my ReWire login credentials email',
      category: 'Access & Login',
      audience: 'student',
      tags: ['rewire', 'login', 'email'],
      body: [
        '## Checklist',
        '- Check your **Spam / Promotions** folder.',
        '- Confirm you used the correct **email address** during registration.',
        '- Wait for provisioning to complete (it may take some time during beta).',
        '',
        '## Still not received?',
        'Contact support with:',
        '- Your registered email',
        '- Phone number used during signup',
        '- College + University affiliation',
      ].join('\\n'),
    },
    {
      title: 'Supported languages in ReWire',
      category: 'Using ReWire',
      audience: 'student',
      tags: ['rewire', 'languages'],
      body: [
        'ReWire can respond in multiple languages (including **Tamil**, **Hindi**, and **English**).',
        '',
        '## Tips',
        '- Ask your question in your preferred language.',
        '- If the answer language is not what you want, explicitly request: “Reply in Tamil/Hindi/English”.',
      ].join('\\n'),
    },
    {
      title: 'Question limits (Beta)',
      category: 'Using ReWire',
      audience: 'student',
      tags: ['rewire', 'limits', 'beta'],
      body: [
        'During beta, accounts may have a daily question limit (e.g., **50 questions/day**).',
        '',
        '## If you hit the limit',
        '- Try again after the daily reset.',
        '- Consolidate follow-up questions into a single message when possible.',
      ].join('\\n'),
    },
    {
      title: 'How to choose the right university / affiliation during signup',
      category: 'Getting Started',
      audience: 'student',
      tags: ['rewire', 'university', 'signup'],
      body: [
        'Selecting the correct university affiliation helps ReWire calibrate your syllabus/regulation accurately.',
        '',
        '## If your university is not listed',
        '- Choose **Other** and enter the university name exactly as on your documents.',
      ].join('\\n'),
    },
    {
      title: 'College search not finding my college',
      category: 'Getting Started',
      audience: 'student',
      tags: ['rewire', 'college', 'signup'],
      body: [
        '## Try this',
        '- Type at least **2 letters**.',
        '- Try alternate spellings/abbreviations (e.g., “Engg”, “Tech”).',
        '',
        '## If still missing',
        'Select the closest match (if allowed) or contact support with your college name and city.',
      ].join('\\n'),
    },
    {
      title: 'Exam practice mode: what it is and how to use it',
      category: 'Exam Prep',
      audience: 'student',
      tags: ['rewire', 'exam', 'practice'],
      body: [
        '## What it does',
        'Exam practice mode helps you prepare with unit-aligned questions and structured follow-ups.',
        '',
        '## Best practices',
        '- Start with a unit/topic (e.g., “Unit 1: SQL Injection”).',
        '- Ask for: **2-mark / 10-mark** style questions if needed.',
        '- Request solutions and common mistakes.',
      ].join('\\n'),
    },
    {
      title: 'Unit-wise tracking: understanding your readiness score',
      category: 'Exam Prep',
      audience: 'student',
      tags: ['rewire', 'tracking', 'readiness'],
      body: [
        'ReWire can show unit-wise progress/readiness based on your interactions.',
        '',
        '## How to improve your score',
        '- Focus on low-scoring units first.',
        '- Ask for concept explanations + practice questions.',
        '- Use follow-up questions to clarify weak areas.',
      ].join('\\n'),
    },
    {
      title: 'ReWire gives an answer that does not match my syllabus',
      category: 'Troubleshooting',
      audience: 'student',
      tags: ['rewire', 'syllabus', 'accuracy'],
      body: [
        '## Quick fixes',
        '- Mention your **subject code** and **unit/topic** in the question.',
        '- Ask: “Answer based on my regulation and semester syllabus.”',
        '',
        '## Report the mismatch',
        'Share the question and the expected topic/unit so we can improve calibration.',
      ].join('\\n'),
    },
    {
      title: 'Privacy & data usage (Beta)',
      category: 'Account & Privacy',
      audience: 'student',
      tags: ['rewire', 'privacy'],
      body: [
        'ReWire uses your academic details to provision an instance aligned to your syllabus/regulation.',
        '',
        '## What we collect',
        '- Name, email, phone',
        '- College, city, university affiliation, department, year/semester',
        '',
        '## What we do not do',
        '- No spam emails.\n- No selling of your data.',
      ].join('\\n'),
    },
  ];

  try {
    const created = [];
    for (const a of starter) {
      // Avoid duplicates by title
      const exists = await prisma.kbArticle.findFirst({
        where: { product_id: productId, title: a.title },
      });
      if (exists) continue;
      const row = await prisma.kbArticle.create({
        data: {
          product_id: productId,
          title: a.title,
          body: a.body,
          category: a.category,
          audience: a.audience,
          tags: a.tags,
          is_published: true,
          created_by: userId,
        },
      });
      created.push(row);
    }
    res.json({ created_count: created.length, created });
  } catch (e) {
    console.error('seedRewireStarterKb error:', e);
    res.status(500).json({ error: 'Failed to seed starter KB' });
  }
}

function stripHtmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = withoutScripts
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return text;
}

export async function crawlKbSource(req: AuthRequest, res: Response): Promise<void> {
  let productId = req.user?.product_id;
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  if (!userId || !tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  if (!productId) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { product_id: true } });
    if (!t) {
      res.status(403).json({ error: 'Tenant not found' });
      return;
    }
    productId = t.product_id;
  }
  const { url, tenant_product_id } = req.body as { url?: string; tenant_product_id?: string };
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  try {
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) {
      res.status(400).json({ error: `Failed to fetch URL (${resp.status})` });
      return;
    }
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      res.status(400).json({ error: 'Only HTML pages are supported right now' });
      return;
    }

    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().slice(0, 200) : null;
    const content_text = stripHtmlToText(html);
    if (!content_text || content_text.length < 80) {
      res.status(400).json({ error: 'Not enough readable text found on this page' });
      return;
    }

    const content_hash = crypto.createHash('sha256').update(content_text).digest('hex');
    const existing = await prisma.kbSource.findFirst({
      where: { product_id: productId, content_hash },
    });
    if (existing) {
      // "Touch" the source so UI reflects a refresh time even if content is unchanged.
      const touched = await prisma.kbSource.update({
        where: { id: existing.id },
        data: {
          url,
          title,
          source_type: 'crawled',
          status: 'extracted',
          error: null,
        },
      });
      res.json(touched);
      return;
    }

    const source = await prisma.kbSource.create({
      data: {
        product_id: productId,
        tenant_id: tenantId ?? null,
        tenant_product_id: tenant_product_id ?? null,
        source_type: 'crawled',
        url,
        title,
        content_text,
        content_hash,
        status: 'extracted',
        created_by: userId,
      },
    });

    res.status(201).json(source);
  } catch (e) {
    console.error('crawlKbSource error:', e);
    res.status(500).json({ error: 'Failed to crawl and extract source' });
  }
}

export async function listKbSources(req: AuthRequest, res: Response): Promise<void> {
  let productId = req.user?.product_id;
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  if (!productId) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { product_id: true } });
    if (!t) {
      res.status(403).json({ error: 'Tenant not found' });
      return;
    }
    productId = t.product_id;
  }
  try {
    const sources = await prisma.kbSource.findMany({
      where: {
        product_id: productId,
        tenant_id: tenantId ?? null,
      },
      orderBy: { updated_at: 'desc' },
      take: 100,
    });
    res.json(sources);
  } catch (e) {
    console.error('listKbSources error:', e);
    res.status(500).json({ error: 'Failed to load sources' });
  }
}

export async function getKbSource(req: AuthRequest, res: Response): Promise<void> {
  let productId = req.user?.product_id;
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  if (!productId) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { product_id: true } });
    if (!t) {
      res.status(403).json({ error: 'Tenant not found' });
      return;
    }
    productId = t.product_id;
  }
  try {
    const src = await prisma.kbSource.findUnique({ where: { id } });
    if (!src || src.product_id !== productId || (src.tenant_id || null) !== (tenantId ?? null)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(src);
  } catch (e) {
    console.error('getKbSource error:', e);
    res.status(500).json({ error: 'Failed to load source' });
  }
}

export async function convertKbSourceToArticle(req: AuthRequest, res: Response): Promise<void> {
  let productId = req.user?.product_id;
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId || !tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  if (!productId) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { product_id: true } });
    if (!t) {
      res.status(403).json({ error: 'Tenant not found' });
      return;
    }
    productId = t.product_id;
  }
  const { title, body, category, audience, tags, is_published } = req.body as any;
  const tenant_product_id = req.body?.tenant_product_id as string | undefined;
  if (!title || !body || !category || !audience) {
    res.status(400).json({ error: 'title, body, category, audience are required' });
    return;
  }
  try {
    const src = await prisma.kbSource.findUnique({ where: { id } });
    if (!src || src.product_id !== productId || (src.tenant_id || null) !== (tenantId ?? null)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const normalized = {
      product_id: productId,
      tenant_product_id: tenant_product_id ?? null,
      title: String(title).slice(0, 200),
      body: String(body),
      category: String(category).slice(0, 80),
      audience: String(audience).slice(0, 80),
      tags: Array.isArray(tags) ? tags : [],
      is_published: is_published === true, // default draft unless explicitly published
      created_by: userId,
    };

    // Basic dedupe: avoid creating identical article twice
    const existing = await prisma.kbArticle.findFirst({
      where: {
        product_id: normalized.product_id,
        tenant_product_id: normalized.tenant_product_id,
        title: normalized.title,
        category: normalized.category,
        audience: normalized.audience,
        body: normalized.body,
      },
      orderBy: { updated_at: 'desc' },
    });
    if (existing) {
      res.status(200).json(existing);
      return;
    }

    const article = await prisma.kbArticle.create({ data: normalized });
    res.status(201).json(article);
  } catch (e) {
    console.error('convertKbSourceToArticle error:', e);
    res.status(500).json({ error: 'Failed to create article' });
  }
}

export async function deleteKbSource(req: AuthRequest, res: Response): Promise<void> {
  let productId = req.user?.product_id;
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  if (!productId) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { product_id: true } });
    if (!t) {
      res.status(403).json({ error: 'Tenant not found' });
      return;
    }
    productId = t.product_id;
  }
  try {
    const src = await prisma.kbSource.findUnique({ where: { id } });
    if (!src || src.product_id !== productId || (src.tenant_id || null) !== (tenantId ?? null)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await prisma.kbSource.delete({ where: { id } });
    res.json({ message: 'deleted' });
  } catch (e) {
    console.error('deleteKbSource error:', e);
    res.status(500).json({ error: 'Failed to delete source' });
  }
}

export async function deleteKbArticle(req: AuthRequest, res: Response): Promise<void> {
  let productId = req.user?.product_id;
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  if (!productId) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { product_id: true } });
    if (!t) {
      res.status(403).json({ error: 'Tenant not found' });
      return;
    }
    productId = t.product_id;
  }
  try {
    const a = await prisma.kbArticle.findUnique({ where: { id } });
    if (!a || a.product_id !== productId) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await prisma.kbArticle.delete({ where: { id } });
    res.json({ message: 'deleted' });
  } catch (e) {
    console.error('deleteKbArticle error:', e);
    res.status(500).json({ error: 'Failed to delete article' });
  }
}

export async function uploadKbDocument(req: AuthRequest, res: Response): Promise<void> {
  let productId = req.user?.product_id;
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  if (!tenantId || !userId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  if (!productId) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { product_id: true } });
    if (!t) {
      res.status(403).json({ error: 'Tenant not found' });
      return;
    }
    productId = t.product_id;
  }

  const file = (req as any).file as { originalname: string; mimetype: string; buffer: Buffer } | undefined;
  const tenant_product_id = (req as any).body?.tenant_product_id as string | undefined;

  if (!file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }

  try {
    let text = '';
    if (file.mimetype === 'text/plain') {
      text = file.buffer.toString('utf8');
    } else if (file.mimetype === 'application/pdf') {
      const parsed = await pdfParse(file.buffer);
      text = parsed.text || '';
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value || '';
    } else {
      res.status(400).json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' });
      return;
    }

    text = String(text).replace(/\r\n/g, '\n').trim();
    if (!text || text.length < 80) {
      res.status(400).json({ error: 'Not enough readable text in document' });
      return;
    }

    const content_hash = crypto.createHash('sha256').update(text).digest('hex');
    const existing = await prisma.kbSource.findFirst({ where: { product_id: productId, content_hash } });
    if (existing) {
      const touched = await prisma.kbSource.update({
        where: { id: existing.id },
        data: {
          source_type: 'upload',
          title: file.originalname,
          url: `upload:${file.originalname}`,
          status: 'extracted',
          error: null,
        },
      });
      res.json(touched);
      return;
    }

    const source = await prisma.kbSource.create({
      data: {
        product_id: productId,
        tenant_id: tenantId ?? null,
        tenant_product_id: tenant_product_id ?? null,
        url: `upload:${file.originalname}`,
        title: file.originalname,
        content_text: text,
        content_hash,
        status: 'extracted',
        created_by: userId,
      },
    });

    res.status(201).json(source);
  } catch (e) {
    console.error('uploadKbDocument error:', e);
    res.status(500).json({ error: 'Failed to process document' });
  }
}

export async function listKbArticles(req: AuthRequest, res: Response): Promise<void> {
  let productId = req.user?.product_id;
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  if (!productId) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { product_id: true } });
    if (!t) {
      res.status(403).json({ error: 'Tenant not found' });
      return;
    }
    productId = t.product_id;
  }
  try {
    const tenant_product_id = (req.query.tenant_product_id as string | undefined) || undefined;
    const articles = await prisma.kbArticle.findMany({
      where: { product_id: productId, ...(tenant_product_id ? { tenant_product_id } : {}) },
      orderBy: { updated_at: 'desc' },
      take: 200,
    });
    res.json(articles);
  } catch (e) {
    console.error('listKbArticles error:', e);
    res.status(500).json({ error: 'Failed to load articles' });
  }
}

export async function listAvailableModels(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  try {
    // Models configured by super admin are stored with product_id = null
    const providers = await prisma.aiProviderConfig.findMany({
      where: { product_id: null, enabled: true },
      orderBy: { provider_name: 'asc' },
    });

    const models = providers.flatMap((p) => {
      const list = Array.isArray(p.available_models) ? (p.available_models as any[]) : [];
      return list.map((m) => ({
        provider_name: p.provider_name,
        model: String(m),
        default_model: p.default_model,
      }));
    });

    res.json({ providers: providers.map((p) => ({ id: p.id, provider_name: p.provider_name, default_model: p.default_model, available_models: p.available_models })), models });
  } catch (e) {
    console.error('listAvailableModels error:', e);
    res.status(500).json({ error: 'Failed to load models' });
  }
}

export async function setL0Model(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const { tenant_product_id, provider_name, model } = req.body as any;
  if (!tenant_product_id || !provider_name || !model) {
    res.status(400).json({ error: 'tenant_product_id, provider_name, model are required' });
    return;
  }
  try {
    // Verify tenant product belongs to this tenant
    const tp = await prisma.tenantProduct.findUnique({ where: { id: tenant_product_id } });
    if (!tp || tp.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Tenant product not found' });
      return;
    }

    // Verify model exists in enabled global provider configs
    const provider = await prisma.aiProviderConfig.findFirst({
      where: { product_id: null, enabled: true, provider_name: String(provider_name) },
    });
    const allowed = provider && Array.isArray(provider.available_models) ? (provider.available_models as any[]).map(String) : [];
    if (!provider || !allowed.includes(String(model))) {
      res.status(400).json({ error: 'Selected model is not available' });
      return;
    }

    const updated = await prisma.tenantProduct.update({
      where: { id: tenant_product_id },
      data: { l0_provider: String(provider_name), l0_model: String(model) },
    });

    res.json(updated);
  } catch (e) {
    console.error('setL0Model error:', e);
    res.status(500).json({ error: 'Failed to save L0 model' });
  }
}
