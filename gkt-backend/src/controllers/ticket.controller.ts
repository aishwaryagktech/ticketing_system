import { Response } from 'express';
import { prisma } from '../db/postgres';
import { ApiKeyRequest } from '../middleware/apiKey';
import { AuthRequest } from '../middleware/auth';
import { getActiveAdapter } from '../ai/provider';
import { Conversation } from '../../mongo/models/conversation.model';
import {
  getResolutionTimeMins,
  computeSlaDeadline,
  shouldBeBreached,
  markBreachedTickets,
} from '../services/sla.service';
import { decryptPII } from '../utils/encrypt';

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
    const where: any = {
      tenant_id: tenantId,
      ...(tenant_product_id ? { tenant_product_id } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(Number.isFinite(escalation_level) ? { escalation_level } : {}),
      ...(sla_breached !== undefined ? { sla_breached } : {}),
    };

    if (assigned === 'me') where.assigned_to = userId;
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
        tenant_product_id: true,
        sla_deadline: true,
        sla_breached: true,
        created_at: true,
        updated_at: true,
      },
    });

    res.json({ items: tickets, take, skip });
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
    // Enrich with resolved agent email for web_form flows (From: in composer)
    let agentEmailResolved: string | null = null;
    if (ticket.assigned_to) {
      try {
        const agent = await prisma.user.findUnique({
          where: { id: ticket.assigned_to },
          select: { email: true },
        });
        if (agent?.email) {
          try {
            agentEmailResolved = decryptPII(agent.email);
          } catch {
            agentEmailResolved = agent.email;
          }
        }
      } catch {
        // ignore lookup failures
      }
    }
    res.json({
      ...ticket,
      agent_email: agentEmailResolved,
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
export async function assignTicket(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const { id } = req.params;
  if (!tenantId || !userId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }

  try {
    // Try to atomically claim the ticket only if it is currently unassigned
    const result = await prisma.ticket.updateMany({
      where: { id, tenant_id: tenantId, assigned_to: null },
      data: { assigned_to: userId },
    });

    if (result.count === 0) {
      // Either ticket does not exist for this tenant or it was already assigned
      const existing = await prisma.ticket.findFirst({ where: { id, tenant_id: tenantId } });
      if (!existing) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      if (existing.assigned_to && existing.assigned_to !== userId) {
        res.status(409).json({ error: 'already_assigned' });
        return;
      }

      // Ticket is already assigned to this user; return current state
      res.json(existing);
      return;
    }

    const updated = await prisma.ticket.findFirst({ where: { id, tenant_id: tenantId } });
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

    // Prefer Mongo Conversation thread when available
    if (ticket.tenant_product_id) {
      try {
        const convo = await Conversation.findOne(
          { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'bot' },
        ).lean();
        if (convo && Array.isArray(convo.messages) && convo.messages.length > 0) {
          const msgs = convo.messages
            .map((m: any) => ({
              id: m.message_id,
              from: m.author_type === 'bot' ? 'bot' : m.author_type === 'user' ? 'user' : 'agent',
              text: m.body,
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

    // Fallback for non-bot tickets.
    if (ticket.source === 'web_form') {
      // For web_form tickets, build the thread from non-internal TicketComments (email thread).
      const comments = await prisma.ticketComment.findMany({
        where: { ticket_id: ticket.id, is_internal: false },
        orderBy: { created_at: 'asc' },
      });

      const createdByLower = (ticket.created_by || '').toLowerCase();
      const msgs = comments.map((c) => ({
        id: c.id,
        from: (c.author_id || '').toLowerCase() === createdByLower ? ('user' as const) : ('agent' as const),
        text: c.body,
        created_at: c.created_at,
      }));

      res.json({ messages: msgs });
      return;
    }

    // For other sources, basic conversation from description only
    let baseText = ticket.description || ticket.subject;
    if (baseText) {
      const marker = '\n---\nChat transcript\n---';
      const idx = baseText.indexOf(marker);
      if (idx >= 0) {
        baseText = baseText.slice(0, idx).trim();
      }
    }
    const first = {
      id: 'ticket-desc',
      from: 'user' as const,
      text: baseText || ticket.subject,
      created_at: ticket.created_at,
    };
    res.json({ messages: [first] });
  } catch (e) {
    console.error('getTicketConversation error:', e);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
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

    try {
      const adapter = await getActiveAdapter(ticket.product_id);
      const replies = await adapter.suggestReply(ticket, ticket.comments || []);
      res.json({ replies });
    } catch (aiErr) {
      console.warn('suggestReplies: AI failed:', (aiErr as Error).message);
      res.status(200).json({ replies: [] });
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
