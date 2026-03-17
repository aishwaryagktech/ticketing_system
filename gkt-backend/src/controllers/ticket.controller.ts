import { Response } from 'express';
import { prisma } from '../db/postgres';
import { ApiKeyRequest } from '../middleware/apiKey';
import { AuthRequest } from '../middleware/auth';
import { getActiveAdapter } from '../ai/provider';
import { OpenAIAdapter } from '../ai/adapters/openai';
import { Conversation } from '../../mongo/models/conversation.model';
import {
  getResolutionTimeMins,
  computeSlaDeadline,
  shouldBeBreached,
  markBreachedTickets,
} from '../services/sla.service';
import { env } from '../config/env';
import { decryptPII, decryptForDisplay } from '../utils/encrypt';
import { parseTranscriptFromDescription } from '../utils/transcript';
import { getIO } from '../config/socket';
import { embedQuery, searchKb } from '../services/embedding.service';
import { EscalationService } from '../services/escalation.service';

// GET /api/tickets
export async function listTickets(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const tenantId = req.user?.tenant_id;
  if (!userId || !tenantId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }

  const q = req.query as any;
  const status = typeof q.status === 'string' ? q.status : undefined;
  const priority = typeof q.priority === 'string' ? q.priority : undefined;
  const assigned = typeof q.assigned === 'string' ? q.assigned : undefined; // me | unassigned | any
  const escalation_level = q.escalation_level != null ? Number(q.escalation_level) : undefined;
  const tenant_product_id = typeof q.tenant_product_id === 'string' ? q.tenant_product_id : undefined;
  const sla_breached =
    typeof q.sla_breached === 'string'
      ? q.sla_breached === 'true'
      : typeof q.sla_breached === 'boolean'
        ? q.sla_breached
        : undefined;
  const take = Math.min(100, Math.max(1, q.take != null ? Number(q.take) : 50));
  const skip = Math.max(0, q.skip != null ? Number(q.skip) : 0);

  try {
    // Keep sla_breached in sync so list views and stats are accurate
    await markBreachedTickets();
    await EscalationService.evaluateAutoEscalation();
    const where: any = {
      tenant_id: tenantId,
      ...(tenant_product_id ? { tenant_product_id } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(Number.isFinite(escalation_level) ? { escalation_level } : {}),
      ...(sla_breached !== undefined ? { sla_breached } : {}),
    };

    if (assigned === 'me') {
      where.OR = [
        { assigned_to: userId },
        { escalated_by: userId }
      ];
    }
    if (assigned === 'unassigned') where.assigned_to = null;

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: [{ updated_at: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        ticket_number: true,
        subject: true,
        status: true,
        priority: true,
        escalation_level: true,
        assigned_to: true,
        escalated_by: true,
        tenant_product_id: true,
        sla_deadline: true,
        sla_breached: true,
        created_at: true,
        updated_at: true,
        tenant_product: {
          select: {
            name: true,
          },
        },
      },
    });

    const userIds = [...new Set([
      ...tickets.map((t: any) => t.escalated_by).filter(Boolean),
      ...tickets.map((t: any) => t.assigned_to).filter(Boolean)
    ])] as string[];
    let userNames: Record<string, string> = {};
    if (userIds.length > 0) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, first_name: true, last_name: true, email: true },
        });
        for (const u of users) {
          const parts: string[] = [];
          if (u.first_name) {
            try {
              parts.push(decryptPII(u.first_name));
            } catch {
              parts.push(u.first_name);
            }
          }
          if (u.last_name) {
            try {
              parts.push(decryptPII(u.last_name));
            } catch {
              parts.push(u.last_name);
            }
          }
          if (parts.length) {
            userNames[u.id] = parts.join(' ').trim();
          } else if (u.email) {
            try {
              userNames[u.id] = decryptPII(u.email);
            } catch {
              userNames[u.id] = u.email;
            }
          } else {
            userNames[u.id] = u.id;
          }
        }
      } catch {
        // ignore
      }
    }

    const items = await Promise.all(tickets.map(async (t: any) => ({
      ...t,
      escalated_by_name: t.escalated_by ? userNames[t.escalated_by] ?? null : null,
      assigned_to_name: t.assigned_to ? userNames[t.assigned_to] ?? null : null,
      next_escalation_at: await EscalationService.getNextEscalationDue(t.id),
    })));

    res.json({ items, take, skip });
  } catch (e) {
    console.error('listTickets error:', e);
    res.status(500).json({ error: 'Failed to list tickets' });
  }
}

// GET /api/tickets/:id
export async function getTicket(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }
  try {
    await EscalationService.evaluateAutoEscalation();
    let ticket = await prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        comments: { orderBy: { created_at: 'asc' } },
        product: {
          select: {
            email_sender_address: true,
            email_sender_name: true,
          },
        },
        tenant_product: {
          select: {
            name: true,
          },
        },
      },
    });
    if (!ticket) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    // Sync sla_breached if deadline passed and ticket not resolved/closed
    const breached = shouldBeBreached(
      ticket.sla_deadline,
      ticket.status,
      ticket.sla_breached
    );
    if (breached && !ticket.sla_breached) {
      ticket = await prisma.ticket.update({
        where: { id },
        data: { sla_breached: true },
        include: { comments: { orderBy: { created_at: 'asc' } } },
      });
    }
    // For web_form tickets, the outbound sender should match the configured mail provider sender.
    // If Gmail sync is configured, show the Gmail inbox address; otherwise fall back to product/SendGrid sender.
    let agentEmailResolved: string | null =
      env.GMAIL_SYNC_ACCOUNT ||
      ticket.product?.email_sender_address ||
      env.SENDGRID_FROM_EMAIL ||
      null;
    let escalatedByName: string | null = null;
    const escalatedBy = (ticket as any).escalated_by;
    if (escalatedBy) {
      try {
        const escalator = await prisma.user.findUnique({
          where: { id: escalatedBy },
          select: { first_name: true, last_name: true, email: true },
        });
        if (escalator) {
          const parts: string[] = [];
          if (escalator.first_name) {
            try {
              parts.push(decryptPII(escalator.first_name));
            } catch {
              parts.push(escalator.first_name);
            }
          }
          if (escalator.last_name) {
            try {
              parts.push(decryptPII(escalator.last_name));
            } catch {
              parts.push(escalator.last_name);
            }
          }
          if (parts.length) escalatedByName = parts.join(' ').trim();
          else if (escalator.email) {
            try {
              escalatedByName = decryptPII(escalator.email);
            } catch {
              escalatedByName = escalator.email;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    const next_escalation_at = await EscalationService.getNextEscalationDue(ticket.id);

    res.json({
      ...ticket,
      agent_email: agentEmailResolved,
      escalated_by_name: escalatedByName,
      next_escalation_at,
    });
  } catch (e) {
    console.error('getTicket error:', e);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
}

// POST /api/tickets
// Used by both authenticated app and public /api/v1/tickets (with API key).
export async function createTicket(req: ApiKeyRequest, res: Response): Promise<void> {
  const productId = (req as ApiKeyRequest).productId;
  if (!productId) {
    res.status(403).json({ error: 'Product context required' });
    return;
  }

  const {
    name,
    email,
    subject,
    description,
    priority,
    source,
    user_type,
    tenant_id,
    tenant_product_id,
    product_id: bodyProductId,
  } = (req.body as any) || {};

  if (!subject || !description) {
    res.status(400).json({ error: 'subject and description are required' });
    return;
  }

  const ticketNumber =
    'TKT-' +
    Date.now().toString(36).toUpperCase() +
    '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase();

  try {
    const effectiveProductId = bodyProductId || productId;
    const textForAi = `${subject}\n\n${description}`;

    let category: string | null = null;
    let subCategory: string | null = null;
    let aiPriority: string | null = null;
    let department: string | null = null;
    let aiConfidence: number | null = null;
    let sentiment: string | null = null;
    let sentimentTrend: string | null = null;
    let duplicate: { is_duplicate: boolean; matches: Array<{ ticket_id: string; ticket_number: string; score: number }> } =
      { is_duplicate: false, matches: [] };

    try {
      const adapter = await getActiveAdapter(effectiveProductId);
      const [cls, snt, dup] = await Promise.all([
        adapter.classify(textForAi),
        adapter.detectSentiment(textForAi),
        adapter.checkDuplicate(textForAi, effectiveProductId),
      ]);

      category = cls.category || null;
      subCategory = cls.sub_category || null;
      aiPriority = (cls.priority || '').toLowerCase();
      aiConfidence = typeof cls.confidence === 'number' ? cls.confidence : null;

      const catLower = (category || '').toLowerCase();
      if (catLower === 'technical') department = 'Engineering';
      else if (catLower === 'billing') department = 'Finance';
      else if (catLower === 'course') department = 'Academics';
      else if (catLower === 'mentor') department = 'Mentorship';
      else if (catLower === 'hardware') department = 'IT Operations';
      else if (catLower === 'access') department = 'Access Management';

      sentiment = (snt.sentiment || '').toLowerCase() || null;
      sentimentTrend = snt.trend || null;

      duplicate = {
        is_duplicate: dup.is_duplicate,
        matches: dup.matches || [],
      };
    } catch (aiErr) {
      console.warn('createTicket: AI enrichment failed (continuing without AI):', (aiErr as Error).message);
    }

    const normalizedPriority = (function () {
      const explicit = typeof priority === 'string' ? priority.toLowerCase() : null;
      const fromAi = aiPriority;
      const val = explicit || fromAi;
      if (val === 'p1' || val === 'p2' || val === 'p3' || val === 'p4') return val;
      return 'p3';
    })();

    const effectiveTenantProductId = tenant_product_id ? String(tenant_product_id) : null;
    let slaDeadline: Date | null = null;
    try {
      const resolutionMins = await getResolutionTimeMins(
        effectiveProductId,
        effectiveTenantProductId,
        normalizedPriority
      );
      if (resolutionMins != null && resolutionMins > 0) {
        const createdAt = new Date();
        slaDeadline = computeSlaDeadline(createdAt, resolutionMins);
      }
    } catch (slaErr) {
      console.warn('createTicket: SLA policy lookup failed (continuing without SLA):', (slaErr as Error).message);
    }

    const ticket = await prisma.ticket.create({
      data: {
        ticket_number: ticketNumber,
        product_id: effectiveProductId,
        tenant_product_id: effectiveTenantProductId,
        subject: String(subject),
        description: String(description),
        created_by: email ? String(email) : 'public',
        priority: normalizedPriority as any,
        source: (source as any) || 'web_form',
        user_type: (user_type as any) || 'individual',
        category: category,
        sub_category: subCategory,
        department: department,
        ai_confidence: aiConfidence,
        sentiment: sentiment as any,
        sentiment_trend: sentimentTrend,
        tenant_id: tenant_id ? String(tenant_id) : null,
        sla_deadline: slaDeadline,
      },
    });
    res.status(201).json({
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      duplicate: duplicate,
    });
  } catch (e) {
    console.error('createTicket error:', e);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
}

// GET /api/tickets/:id/escalation-history
export async function getTicketEscalationHistory(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }
  try {
    const ticket = await prisma.ticket.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
    if (!ticket) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const logs = await prisma.escalationLog.findMany({
      where: { ticket_id: id },
      orderBy: { created_at: 'asc' },
    });
    const userIds = [...new Set(logs.map((l) => l.triggered_by).filter(Boolean))];
    let names: Record<string, string> = {};
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, first_name: true, last_name: true, email: true },
      });
      for (const u of users) {
        const parts: string[] = [];
        if (u.first_name) {
          try {
            parts.push(decryptPII(u.first_name));
          } catch {
            parts.push(u.first_name);
          }
        }
        if (u.last_name) {
          try {
            parts.push(decryptPII(u.last_name));
          } catch {
            parts.push(u.last_name);
          }
        }
        if (parts.length) {
          names[u.id] = parts.join(' ').trim();
        } else if (u.email) {
          try {
            names[u.id] = decryptPII(u.email);
          } catch {
            names[u.id] = u.email;
          }
        } else {
          names[u.id] = u.id;
        }
      }
    }
    const items = logs.map((log) => ({
      from_level: log.from_level,
      to_level: log.to_level,
      trigger_reason: log.trigger_reason,
      triggered_by: log.triggered_by,
      triggered_by_name: names[log.triggered_by] ?? null,
      actor_id: log.actor_id,
      created_at: log.created_at,
    }));
    res.json({ items });
  } catch (e) {
    console.error('getTicketEscalationHistory error:', e);
    res.status(500).json({ error: 'Failed to load escalation history' });
  }
}

// PATCH /api/tickets/:id
export async function updateTicket(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const role = req.user?.role;
  const { id } = req.params;
  if (!tenantId || !userId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }

  const body = (req.body as any) || {};
  const allowed: any = {};
  if (typeof body.priority === 'string') allowed.priority = body.priority;
  if (typeof body.status === 'string') allowed.status = body.status;
  if (typeof body.escalation_level === 'number') allowed.escalation_level = body.escalation_level;
  if (typeof body.assigned_to === 'string' || body.assigned_to === null) allowed.assigned_to = body.assigned_to;

  try {
    const t = await prisma.ticket.findFirst({ where: { id, tenant_id: tenantId } });
    if (!t) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // Basic permission: agents can update assigned tickets; admins can update all
    const isAdmin = role === 'tenant_admin' || role === 'super_admin';
    const isOwner = t.assigned_to === userId;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Not allowed' });
      return;
    }

    const data: any = { ...allowed };

    // If level is increasing OR reassigned to another agent/queue, track who did it
    const levelIncreasing = typeof allowed.escalation_level === 'number' && allowed.escalation_level > (t.escalation_level ?? 0);
    const reassignedAway = (typeof allowed.assigned_to === 'string' && allowed.assigned_to !== userId) ||
      (allowed.assigned_to === null && t.assigned_to === userId);

    if (levelIncreasing || reassignedAway) {
      data.escalated_by = userId;

      // If reassigned to another specific agent, ensure status is 'open' for them to 'start'
      if (typeof allowed.assigned_to === 'string' && allowed.assigned_to !== userId && !allowed.status) {
        data.status = 'open';
      }
    }

    // If priority is changing, recompute SLA deadline based on new priority
    if (typeof allowed.priority === 'string' && allowed.priority !== t.priority) {
      try {
        const resolutionMins = await getResolutionTimeMins(
          t.product_id,
          t.tenant_product_id,
          String(allowed.priority)
        );
        if (resolutionMins != null && resolutionMins > 0) {
          const createdAt = t.created_at ?? new Date();
          data.sla_deadline = computeSlaDeadline(createdAt, resolutionMins);
          // Reset breach flag when SLA is recalculated
          data.sla_breached = false;
        }
      } catch (slaErr) {
        console.warn('updateTicket: SLA recompute failed (continuing without SLA change):', (slaErr as Error).message);
      }
    }

    const updated = await prisma.ticket.update({ where: { id }, data });

    const fromLevel = Number(t.escalation_level ?? 0);
    const toLevel = typeof data.escalation_level === 'number' ? data.escalation_level : fromLevel;
    const levelChanged = toLevel !== fromLevel;
    const reassigned = (typeof data.assigned_to === 'string' || data.assigned_to === null) && data.assigned_to !== (t.assigned_to ?? null);
    if (levelChanged || reassigned) {
      try {
        await prisma.escalationLog.create({
          data: {
            product_id: t.product_id,
            ticket_id: id,
            from_level: fromLevel,
            to_level: toLevel,
            trigger_reason: 'manual',
            triggered_by: userId,
            actor_id: typeof data.assigned_to === 'string' ? data.assigned_to : null,
          },
        });
      } catch (logErr) {
        console.warn('updateTicket: EscalationLog create failed (continuing):', (logErr as Error).message);
      }

      // Emit real-time escalation event so chatbot and agents see it instantly
      try {
        const resolveUserName = async (uid: string | null | undefined): Promise<string | null> => {
          if (!uid) return null;
          const u = await prisma.user.findUnique({ where: { id: uid }, select: { first_name: true, last_name: true, email: true } });
          if (!u) return null;
          const parts = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
          if (parts) return parts;
          try { return decryptPII(u.email || ''); } catch { return u.email || null; }
        };
        const escalatedByName = await resolveUserName(userId);
        const assignedToName = typeof data.assigned_to === 'string' ? await resolveUserName(data.assigned_to) : null;
        getIO().to(`ticket:${id}`).emit('ticket:escalated', {
          ticket_id: id,
          escalated_by_name: escalatedByName,
          assigned_to_name: assignedToName,
          to_level: toLevel,
        });

        // Persist the escalation as a system message so it survives page reloads
        const tpId = (t as any).tenant_product_id;
        if (tpId) {
          const convType = (t as any).source === 'web_form' ? 'ticket' : 'bot';
          const toName = assignedToName ? ` to ${assignedToName}` : '';
          const sysBody = `${escalatedByName || 'Agent'} transferred this chat${toName}. Please wait while the next agent connects.`;
          await Conversation.updateOne(
            { tenant_product_id: tpId, ticket_id: id, type: convType },
            {
              $setOnInsert: { tenant_product_id: tpId, tenant_id: tenantId, ticket_id: id, type: convType, created_at: new Date() },
              $set: { updated_at: new Date() },
              $push: { messages: { message_id: `sys-esc-${Date.now()}`, author_type: 'system', author_name: 'System', body: sysBody, is_internal: false, created_at: new Date() } },
            },
            { upsert: true, strict: false },
          ).catch((e: Error) => console.warn('updateTicket: failed to save system message:', e.message));
        }
      } catch (socketErr) {
        console.warn('updateTicket: failed to emit ticket:escalated (continuing):', (socketErr as Error).message);
      }
    }

    res.json(updated);
  } catch (e) {
    console.error('updateTicket error:', e);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
}

// POST /api/public/support-suggest (via /api/v1 or /api/public prefix with API key)
export async function publicSupportSuggest(req: ApiKeyRequest, res: Response): Promise<void> {
  const productId = (req as ApiKeyRequest).productId;
  if (!productId) {
    res.status(403).json({ error: 'Product context required' });
    return;
  }

  const { subject, description } = (req.body as any) || {};
  if (!subject || !description) {
    res.status(400).json({ error: 'subject and description are required' });
    return;
  }

  const textForAi = `${subject}\n\n${description}`;

  try {
    const adapter = await getActiveAdapter(productId);
    const [cls, snt, reply] = await Promise.all([
      adapter.classify(textForAi),
      adapter.detectSentiment(textForAi),
      adapter.chat(
        [
          {
            role: 'user',
            content:
              'You are a first-line support assistant. The user submitted the following issue from a web form.\n' +
              'Explain a concise, step-by-step suggestion to fix or unblock them.\n' +
              'Use simple language, and keep it under 250 words.\n\n' +
              `Issue:\n${textForAi}`,
          },
        ],
        ''
      ),
    ]);

    const normalizedPriority = (function () {
      const val = (cls.priority || '').toLowerCase();
      if (val === 'p1' || val === 'p2' || val === 'p3' || val === 'p4') return val;
      return 'p3';
    })();

    res.json({
      suggestion: reply || 'We could not generate a specific fix suggestion. Please continue and create a ticket.',
      priority: normalizedPriority,
      meta: {
        category: cls.category || null,
        sub_category: cls.sub_category || null,
        sentiment: (snt.sentiment || '').toLowerCase() || null,
        trend: snt.trend || null,
        confidence: typeof cls.confidence === 'number' ? cls.confidence : null,
      },
    });
  } catch (e) {
    console.error('publicSupportSuggest error:', e);
    res.status(500).json({ error: 'Failed to generate AI suggestion' });
  }
}

// PATCH /api/tickets/:id/assign
// Priority-based assignment: P1 → only L3 agents; P2/P3/P4 → only L1 agents. Admins can always assign.
// Role comes from JWT (mapped from role_id -> roles.name: l1_agent, l2_agent, l3_agent, tenant_admin).
export async function assignTicket(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const role = req.user?.role;
  const { id } = req.params;
  if (!tenantId || !userId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }

  try {
    const existing = await prisma.ticket.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const priority = String(existing.priority || 'p2').toLowerCase();
    const isP1 = priority === 'p1';
    const isL1 = role === 'l1_agent';
    const isL3 = role === 'l3_agent';
    const isAdmin = role === 'tenant_admin' || role === 'super_admin';

    if (isP1) {
      if (!isL3 && !isAdmin) {
        res.status(403).json({
          error: 'P1 tickets can only be assigned to L3 agents.',
        });
        return;
      }
    } else {
      if (!isL1 && !isAdmin) {
        res.status(403).json({
          error: 'Non-P1 tickets can only be assigned to L1 agents. This ticket has priority ' + priority.toUpperCase() + '.',
        });
        return;
      }
    }

    if (existing.assigned_to && existing.assigned_to !== userId) {
      res.status(409).json({ error: 'already_assigned' });
      return;
    }

    if (existing.assigned_to === userId) {
      res.json(existing);
      return;
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { assigned_to: userId },
    });
    res.json(updated);
  } catch (e) {
    console.error('assignTicket error:', e);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
}

// PATCH /api/tickets/:id/status
export async function updateStatus(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const role = req.user?.role;
  const { id } = req.params;
  const { status } = (req.body as any) || {};
  if (!tenantId || !userId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }
  if (typeof status !== 'string') {
    res.status(400).json({ error: 'status required' });
    return;
  }

  try {
    const t = await prisma.ticket.findFirst({ where: { id, tenant_id: tenantId } });
    if (!t) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const isAdmin = role === 'tenant_admin' || role === 'super_admin';
    const isOwner = t.assigned_to === userId;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Not allowed' });
      return;
    }

    const updated = await prisma.ticket.update({ where: { id }, data: { status } });

    // Notify chatbot in real time when an agent starts working on the ticket
    if (status === 'in_progress') {
      try {
        const agent = await prisma.user.findUnique({ where: { id: userId }, select: { first_name: true, last_name: true, email: true } });
        let agentName: string | null = null;
        if (agent) {
          try {
            const fn = agent.first_name ? decryptPII(agent.first_name) : '';
            const ln = agent.last_name ? decryptPII(agent.last_name) : '';
            const parts = [fn, ln].filter(Boolean).join(' ').trim();
            if (parts) agentName = parts;
            else agentName = agent.email ? decryptPII(agent.email) : null;
          } catch {
            const fn = agent.first_name ?? '';
            const ln = agent.last_name ?? '';
            const parts = [fn, ln].filter(Boolean).join(' ').trim();
            if (parts) agentName = parts;
            else agentName = agent.email ?? null;
          }
        }
        getIO().to(`ticket:${id}`).emit('ticket:agent_started', {
          ticket_id: id,
          agent_name: agentName,
        });

        // Persist the agent-joined event as a system message
        const tpId = (t as any).tenant_product_id;
        if (tpId) {
          const convType = (t as any).source === 'web_form' ? 'ticket' : 'bot';
          const sysBody = `${agentName || 'An agent'} has joined the conversation.`;
          await Conversation.updateOne(
            { tenant_product_id: tpId, ticket_id: id, type: convType },
            {
              $setOnInsert: { tenant_product_id: tpId, tenant_id: tenantId, ticket_id: id, type: convType, created_at: new Date() },
              $set: { updated_at: new Date() },
              $push: { messages: { message_id: `sys-start-${Date.now()}`, author_type: 'system', author_name: 'System', body: sysBody, is_internal: false, created_at: new Date() } },
            },
            { upsert: true, strict: false },
          ).catch((e: Error) => console.warn('updateStatus: failed to save system message:', e.message));
        }
      } catch (socketErr) {
        console.warn('updateStatus: failed to emit ticket:agent_started (continuing):', (socketErr as Error).message);
      }
    }

    // When resolved or closed: add thank-you / end-of-conversation message, then notify so socket can close
    if (status === 'resolved' || status === 'closed') {
      try {
        const tpId = (t as any).tenant_product_id;
        if (tpId) {
          const convType = (t as any).source === 'web_form' ? 'ticket' : 'bot';
          const thankYouBody = 'Thank you for contacting us. This conversation is now closed.';
          await Conversation.updateOne(
            { tenant_product_id: tpId, ticket_id: id, type: convType },
            {
              $setOnInsert: { tenant_product_id: tpId, tenant_id: tenantId, ticket_id: id, type: convType, created_at: new Date() },
              $set: { updated_at: new Date() },
              $push: { messages: { message_id: `sys-closed-${Date.now()}`, author_type: 'system', author_name: 'System', body: thankYouBody, is_internal: false, created_at: new Date() } },
            },
            { upsert: true, strict: false },
          ).catch((e: Error) => console.warn('updateStatus: failed to save closed message:', e.message));
        }
        getIO().to(`ticket:${id}`).emit('ticket:closed', {
          ticket_id: id,
          closed_message: thankYouBody,
        });
      } catch (err) {
        console.warn('updateStatus: failed to emit ticket:closed or save thank-you message:', (err as Error).message);
      }
    }

    res.json(updated);
  } catch (e) {
    console.error('updateStatus error:', e);
    res.status(500).json({ error: 'Failed to update status' });
  }
}

// GET /api/tickets/:id/conversation
export async function getTicketConversation(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        tenant_id: true,
        tenant_product_id: true,
        description: true,
        subject: true,
        created_at: true,
        source: true,
        product_id: true,
        created_by: true,
      },
    });
    if (!ticket) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // Bot handoff: one Conversation doc holds full thread (L0 + agent + user). Return all messages for UI.
    if (ticket.source !== 'web_form' && ticket.tenant_product_id) {
      try {
        const convo = await Conversation.findOne(
          { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'bot' },
        ).lean();
        if (convo && Array.isArray(convo.messages) && convo.messages.length > 0) {
          const msgs = convo.messages
            .map((m: any) => ({
              id: m.message_id,
              from: m.author_type === 'system' ? 'system' : m.author_type === 'bot' ? 'bot' : m.author_type === 'user' ? 'user' : 'agent',
              author_name: m.author_name && m.author_type === 'agent' ? decryptForDisplay(m.author_name) : undefined,
              text: decryptForDisplay(m.body),
              is_internal: m.is_internal || false,
              created_at: m.created_at ? new Date(m.created_at) : new Date(),
            }))
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          res.json({ messages: msgs });
          return;
        }
      } catch (e) {
        console.warn('getTicketConversation: failed to load Conversation, falling back:', (e as Error).message);
      }
    }

    // Email thread for web_form: prefer Mongo Conversation (type 'ticket') when present
    // (this includes Gmail-synced messages). Falls back to Postgres comments on first load.
    if (ticket.source === 'web_form') {
      const emailConvo = ticket.tenant_product_id
        ? await Conversation.findOne(
          { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'ticket' },
        ).lean()
        : null;
      if (emailConvo && Array.isArray(emailConvo.messages) && emailConvo.messages.length > 0) {
        const sorted = (emailConvo.messages as any[])
          .map((m: any) => ({
            id: m.message_id,
            from: m.author_type === 'system' ? 'system' : m.author_type === 'agent' ? 'agent' : 'user',
            author_name: m.author_name && m.author_type === 'agent' ? decryptForDisplay(m.author_name) : undefined,
            text: decryptForDisplay(m.body),
            is_internal: m.is_internal || false,
            created_at: m.created_at ? new Date(m.created_at) : new Date(),
          }))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const originalFirst = sorted[0]?.from === 'user' && sorted[0]?.id === 'ticket-original';
        const msgs = originalFirst
          ? sorted
          : [
            { id: 'ticket-original', from: 'user' as const, text: (ticket.description || ticket.subject || '').trim() || '—', created_at: ticket.created_at },
            ...sorted,
          ];
        res.json({ messages: msgs });
        return;
      }

      const comments = await prisma.ticketComment.findMany({
        where: { ticket_id: ticket.id },
        orderBy: { created_at: 'asc' },
      });

      const createdByLower = (ticket.created_by || '').toLowerCase();
      const firstMsg = {
        id: 'ticket-original',
        from: 'user' as const,
        text: (ticket.description || ticket.subject || '').trim() || '—',
        created_at: ticket.created_at,
      };
      const commentMsgs = comments.map((c) => ({
        id: c.id,
        from: (c.author_id || '').toLowerCase() === createdByLower ? ('user' as const) : ('agent' as const),
        text: c.body,
        is_internal: c.is_internal || false,
        created_at: c.created_at,
      }));
      const msgs = [firstMsg, ...commentMsgs];

      if (ticket.tenant_product_id) {
        try {
          const messageDocs = msgs.map((m, i) => ({
            message_id: m.id,
            author_type: m.from,
            author_id: m.from === 'user' ? (ticket.created_by || 'user') : 'agent',
            author_name: m.from === 'agent' ? 'Agent' : 'Requester',
            body: m.text,
            is_internal: false,
            created_at: m.created_at,
          }));
          await Conversation.updateOne(
            {
              tenant_product_id: ticket.tenant_product_id,
              ticket_id: ticket.id,
              type: 'ticket',
            },
            {
              $setOnInsert: {
                tenant_product_id: ticket.tenant_product_id,
                tenant_id: ticket.tenant_id ?? null,
                ticket_id: ticket.id,
                type: 'ticket',
                created_at: new Date(),
              },
              $set: { updated_at: new Date(), messages: messageDocs },
            },
            { upsert: true, strict: false },
          );
        } catch (e) {
          console.warn('getTicketConversation: failed to sync email thread to Mongo:', (e as Error).message);
        }
      }

      res.json({ messages: msgs });
      return;
    }

    // For other sources (or when Mongo fails), parse transcript into conversation view or show full description
    const description = (ticket.description || ticket.subject || '').trim() || '—';
    const parsedTranscript = parseTranscriptFromDescription(ticket.description || '');

    if (parsedTranscript.length > 0) {
      const msgs = parsedTranscript.map((m, i) => ({
        id: `transcript-${i}`,
        from: m.from as 'user' | 'bot',
        text: decryptForDisplay(m.text),
        is_internal: false,
        created_at: new Date(ticket.created_at.getTime() + i),
      }));
      res.json({ messages: msgs });
    } else {
      res.json({
        messages: [
          {
            id: 'ticket-desc',
            from: 'user' as const,
            text: decryptForDisplay(description),
            created_at: ticket.created_at,
          },
        ],
      });
    }
  } catch (e) {
    console.error('getTicketConversation error:', e);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
}

// GET /api/tickets/:id/conversation-summary
export async function getConversationSummary(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        product_id: true,
        tenant_product_id: true,
        source: true,
        description: true,
        subject: true,
        created_at: true,
        created_by: true,
      },
    });
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const lines: string[] = [];
    if (ticket.source !== 'web_form' && ticket.tenant_product_id) {
      try {
        const convo = await Conversation.findOne(
          { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'bot' },
        ).lean();
        if (convo && Array.isArray(convo.messages) && convo.messages.length > 0) {
          const msgs = (convo.messages as any[])
            .map((m: any) => ({ from: m.author_type || 'user', text: m.body || '', created_at: m.created_at }))
            .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
          msgs.forEach((m: any) => lines.push(`${m.from}: ${m.text}`));
        }
      } catch (e) {
        console.warn('getConversationSummary: Mongo bot convo failed:', (e as Error).message);
      }
    }
    if (lines.length === 0 && ticket.source === 'web_form') {
      const emailConvo = ticket.tenant_product_id
        ? await Conversation.findOne(
          { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'ticket' },
        ).lean()
        : null;
      if (emailConvo && Array.isArray(emailConvo.messages) && emailConvo.messages.length > 0) {
        const sorted = (emailConvo.messages as any[])
          .map((m: any) => ({ from: m.author_type || 'user', text: m.body || '', created_at: m.created_at }))
          .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        sorted.forEach((m: any) => lines.push(`${m.from}: ${m.text}`));
      } else {
        const comments = await prisma.ticketComment.findMany({
          where: { ticket_id: ticket.id, is_internal: false },
          orderBy: { created_at: 'asc' },
          select: { body: true, author_id: true },
        });
        const createdByLower = (ticket.created_by || '').toString().toLowerCase();
        lines.push(`user: ${(ticket.description || ticket.subject || '').trim() || '—'}`);
        comments.forEach((c: any) => {
          const from = (c.author_id || '').toString().toLowerCase() === createdByLower ? 'user' : 'agent';
          lines.push(`${from}: ${c.body}`);
        });
      }
    }
    if (lines.length === 0) {
      let base = ticket.description || ticket.subject || '';
      const marker = '\n---\nChat transcript\n---';
      const idx = base.indexOf(marker);
      if (idx >= 0) base = base.slice(0, idx).trim();
      lines.push(`user: ${base || ticket.subject || '—'}`);
    }

    const conversationText = lines.join('\n\n');
    if (!conversationText.trim()) {
      res.json({ summary: 'No conversation content yet.' });
      return;
    }

    try {
      const adapter = await getActiveAdapter(ticket.product_id);
      const summary = await adapter.chat(
        [
          {
            role: 'user',
            content:
              'Summarize this support conversation in 2–3 short sentences for an agent. Focus on what the customer asked and the current state. Be concise.\n\n' +
              conversationText,
          },
        ],
        '',
      );
      res.json({ summary: summary || 'Unable to generate summary.' });
    } catch (aiErr) {
      console.warn('getConversationSummary: AI failed:', (aiErr as Error).message);
      res.status(200).json({ summary: '' });
    }
  } catch (e) {
    console.error('getConversationSummary error:', e);
    res.status(500).json({ error: 'Failed to generate conversation summary' });
  }
}

/** Build 3 resourceful, agent-ready fallback suggestions when AI/KB is unavailable. */
function buildFallbackSuggestions(ticket: any, history: Array<{ body: string; is_internal?: boolean }>): string[] {
  const subject = String(ticket.subject || '').trim();
  const description = String(ticket.description || '').trim().slice(0, 120);
  const lastUserMsg = [...history].reverse().find((h) => !h.is_internal)?.body?.trim() || '';
  const isGenericSubject =
    !subject ||
    /support request|from chatbot|ticket|help request/i.test(subject);
  const topicHint = isGenericSubject
    ? (lastUserMsg || description).slice(0, 80)
    : subject;

  return [
    topicHint
      ? `Thank you for reaching out${topicHint ? ` — "${topicHint.replace(/"/g, "'")}"` : ''}. I'm looking into this and will get back to you shortly.`
      : 'Thank you for reaching out. I\'m looking into this and will get back to you shortly.',
    'Could you share a bit more detail (or a screenshot) so I can give you a precise answer?',
    'I\'ve noted this. If you see any error message, please paste it here—that will help us resolve this faster.',
  ];
}

// GET /api/tickets/:id/ai-suggestions
export async function suggestReplies(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        comments: {
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!ticket) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    let history: Array<{ body: string; is_internal?: boolean }> = (ticket.comments || []).map((c: any) => ({
      body: c.body,
      is_internal: c.is_internal ?? false,
    }));

    // Prefer Mongo conversation when available so AI has full thread context
    if (ticket.tenant_product_id) {
      try {
        const convoType = ticket.source === 'web_form' ? 'ticket' : 'bot';
        const convo = await Conversation.findOne(
          { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: convoType },
        ).lean();
        if (convo && Array.isArray(convo.messages) && convo.messages.length > 0) {
          const msgs = (convo.messages as any[])
            .map((m: any) => ({ body: m.body, created_at: m.created_at }))
            .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
          history = msgs.map((m: any) => ({ body: `${m.body}`, is_internal: false }));
        }
      } catch (e) {
        console.warn('suggestReplies: Mongo convo fallback failed:', (e as Error).message);
      }
    }

    let adapter: Awaited<ReturnType<typeof getActiveAdapter>>;
    try {
      adapter = await getActiveAdapter(ticket.product_id);
    } catch (adapterErr) {
      if (env.OPENAI_API_KEY) {
        adapter = new OpenAIAdapter(env.OPENAI_API_KEY, 'gpt-4o-mini');
      } else {
        throw adapterErr;
      }
    }

    try {
      // Build query text from ticket subject + last user message for KB search
      const queryText = [
        ticket.subject || '',
        ticket.description || '',
        ...history.slice(-3).map((h: any) => h.body || ''),
      ].filter(Boolean).join(' ').slice(0, 1000);

      let kbContext = '';
      try {
        const queryEmbedding = await embedQuery(queryText);
        const kbResults = await searchKb(queryEmbedding, {
          limit: 6,
          tenant_product_id: ticket.tenant_product_id || undefined,
        });
        if (kbResults.length > 0) {
          kbContext = kbResults
            .filter((r) => r.score > 0.35)
            .map((r) => {
              const title = String(r.payload.title || '');
              const content = String(r.payload.content || r.payload.text || '');
              return title ? `[${title}]\n${content}` : content;
            })
            .filter(Boolean)
            .slice(0, 4)
            .join('\n\n');
        }
      } catch (kbErr) {
        console.warn('suggestReplies: KB search failed (continuing without KB):', (kbErr as Error).message);
      }

      // Fallback: if vector search returned no context, use published kb_articles
      if (!kbContext && ticket.product_id) {
        try {
          const articles = await prisma.kbArticle.findMany({
            where: {
              product_id: ticket.product_id,
              is_published: true,
              ...(ticket.tenant_product_id ? { tenant_product_id: ticket.tenant_product_id } : {}),
            },
            orderBy: { updated_at: 'desc' },
            take: 5,
          });
          if (articles.length > 0) {
            kbContext = articles
              .map((a) => {
                const title = String(a.title || '').trim();
                const body = String(a.body || '').trim();
                const bodySlice = body.slice(0, 1800);
                return title ? `[${title}]\n${bodySlice}` : bodySlice;
              })
              .filter(Boolean)
              .join('\n\n---\n\n');
          }
        } catch (kbArticleErr) {
          console.warn('suggestReplies: kbArticle fallback failed (continuing):', (kbArticleErr as Error).message);
        }
      }

      const aiReplies = await adapter.suggestReply(ticket, history, kbContext || undefined);
      // Always return something — if AI produced nothing, fall back to context-aware drafts
      const replies = aiReplies && aiReplies.length > 0 ? aiReplies : buildFallbackSuggestions(ticket, history);
      res.json({ replies });
    } catch (aiErr) {
      console.warn('suggestReplies: AI failed, using fallback suggestions:', (aiErr as Error).message);
      res.status(200).json({ replies: buildFallbackSuggestions(ticket, history) });
    }
  } catch (e) {
    console.error('suggestReplies error:', e);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
}

// PATCH /api/tickets/:id/csat
export async function submitCSAT(_req: any, res: Response): Promise<void> {
  // TODO: Implement CSAT score submission
  res.status(501).json({ message: 'Not implemented' });
}
