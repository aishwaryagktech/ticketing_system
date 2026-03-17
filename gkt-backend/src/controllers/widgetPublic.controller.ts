import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { Conversation } from '../../mongo/models/conversation.model';
import { getIO } from '../config/socket';
import { decryptForDisplayWithBold } from '../utils/encrypt';
import { parseTranscriptFromDescription } from '../utils/transcript';
import { getActiveAdapter } from '../ai/provider';
import { embedQuery, searchKb } from '../services/embedding.service';
import { getResolutionTimeMins, computeSlaDeadline } from '../services/sla.service';
import { sendEmail } from '../services/email.service';

// GET /api/widget/tickets?tenant_id=&user_email=
export async function listUserTickets(req: Request, res: Response): Promise<void> {
  const tenant_id = String(req.query.tenant_id || '').trim();
  const user_email = String(req.query.user_email || '').trim();
  const tenant_product_id = String(req.query.tenant_product_id || '').trim();

  if (!tenant_id || !user_email) {
    res.status(400).json({ error: 'tenant_id and user_email are required' });
    return;
  }

  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        tenant_id,
        created_by: user_email,
        ...(tenant_product_id ? { tenant_product_id } : {}),
      },
      orderBy: { updated_at: 'desc' },
      take: 20,
      select: {
        id: true,
        ticket_number: true,
        assigned_to: true,
        subject: true,
        status: true,
        priority: true,
        escalation_level: true,
        sla_breached: true,
        updated_at: true,
      },
    });

    res.json({ items: tickets });
  } catch (e) {
    console.error('listUserTickets error:', e);
    res.status(500).json({ error: 'Failed to list tickets' });
  }
}

// GET /api/widget/tickets/:id/messages?tenant_id=&user_email=
export async function listTicketMessages(req: Request, res: Response): Promise<void> {
  const tenant_id = String(req.query.tenant_id || '').trim();
  const user_email = String(req.query.user_email || '').trim();
  const tenant_product_id = String(req.query.tenant_product_id || '').trim();
  const { id } = req.params;

  if (!tenant_id || !user_email) {
    res.status(400).json({ error: 'tenant_id and user_email are required' });
    return;
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id,
        tenant_id,
        created_by: user_email,
        ...(tenant_product_id ? { tenant_product_id } : {}),
      },
      select: {
        id: true,
        subject: true,
        description: true,
        created_at: true,
        tenant_product_id: true,
        product_id: true,
      },
    });

    if (!ticket) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // Single source of truth: one Conversation doc holds full thread (L0 bot + user + agent messages after handoff).
    let fromMongo: any[] | null = null;
    if (ticket.tenant_product_id) {
      try {
        const convo = await Conversation.findOne(
          { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'bot' },
        ).lean();
        if (convo && Array.isArray(convo.messages) && convo.messages.length > 0) {
          fromMongo = convo.messages.map((m: any) => {
            const { text, boldPrefix } = decryptForDisplayWithBold(m.body);
            return {
              id: m.message_id,
              from: m.author_type === 'system' ? 'system' : m.author_type === 'bot' ? 'bot' : m.author_type === 'user' ? 'user' : 'agent',
              author_name: m.author_name && m.author_type === 'agent' ? m.author_name : undefined,
              text,
              ...(boldPrefix ? { bold_prefix: boldPrefix } : {}),
              attachments: Array.isArray(m.attachments)
                ? m.attachments.map((a: any) => ({
                    filename: String(a.filename || 'image'),
                    mime_type: String(a.mime_type || ''),
                    size_bytes: Number(a.size_bytes || 0),
                    base64: String(a.base64 || ''),
                  }))
                : [],
              created_at: m.created_at ? new Date(m.created_at) : new Date(),
            };
          });
        }
      } catch (e) {
        console.warn('listTicketMessages: failed to load Conversation, falling back to comments:', (e as Error).message);
      }
    }

    if (fromMongo) {
      const sorted = fromMongo.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      res.json({ messages: sorted }); // Full conversation: L0 + all agent/user messages
      return;
    }

    // Fallback: build thread from ticket description + non-internal comments.
    const comments = await prisma.ticketComment.findMany({
      where: { ticket_id: ticket.id },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        body: true,
        is_internal: true,
        is_bot: true,
        created_at: true,
      },
    });

    const description = ticket.description || ticket.subject || '';
    const parsedTranscript = parseTranscriptFromDescription(description);

    let thread: Array<{ id: string; from: 'user' | 'bot' | 'agent'; text: string; created_at: Date }>;
    if (parsedTranscript.length > 0) {
      const transcriptMessages = parsedTranscript.map((m, i) => ({
        id: `transcript-${i}`,
        from: m.from as 'user' | 'bot',
        text: m.text,
        created_at: new Date(ticket.created_at.getTime() + i),
      }));
      const commentMessages = comments
        .filter((c) => !c.is_internal)
        .map((c) => ({
          id: String(c.id),
          from: (c.is_bot ? 'bot' : 'agent') as 'user' | 'bot' | 'agent',
          text: c.body,
          created_at: c.created_at,
        }));
      thread = [...transcriptMessages, ...commentMessages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } else {
      const ticketStart = {
        id: 'ticket-desc',
        from: 'user' as const,
        text: description || ticket.subject,
        created_at: ticket.created_at,
      };
      const commentMessages = comments
        .filter((c) => !c.is_internal)
        .map((c) => ({
          id: String(c.id),
          from: (c.is_bot ? 'bot' : 'agent') as 'user' | 'bot' | 'agent',
          text: c.body,
          created_at: c.created_at,
        }));
      thread = [ticketStart, ...commentMessages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }

    const withDecrypt = thread.map((m: any) => {
      const { text, boldPrefix } = decryptForDisplayWithBold(m.text);
      return { ...m, text, ...(boldPrefix ? { bold_prefix: boldPrefix } : {}) };
    });

    res.json({ messages: withDecrypt });
  } catch (e) {
    console.error('listTicketMessages error:', e);
    res.status(500).json({ error: 'Failed to list messages' });
  }
}

// POST /api/widget/tickets/:id/messages
export async function createTicketMessage(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { tenant_id, user_email, body, attachments } = (req.body as any) || {};

  const tenantId = String(tenant_id || '').trim();
  const userEmail = String(user_email || '').trim();
  const text = typeof body === 'string' ? body.trim() : '';
  const parsedAttachments = (Array.isArray(attachments) ? attachments : [])
    .map((a: any) => ({
      filename: String(a?.filename || 'image'),
      mime_type: String(a?.mime_type || ''),
      size_bytes: Number(a?.size_bytes || 0),
      base64: String(a?.base64 || ''),
    }))
    .filter((a: any) => a.mime_type.startsWith('image/') && a.base64 && a.base64.length > 20)
    .slice(0, 3);

  if (!tenantId || !userEmail) {
    res.status(400).json({ error: 'tenant_id and user_email are required' });
    return;
  }
  if (!text && parsedAttachments.length === 0) {
    res.status(400).json({ error: 'body or attachments required' });
    return;
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id,
        tenant_id: tenantId,
        created_by: userEmail,
      },
      select: { id: true, product_id: true, tenant_id: true, tenant_product_id: true },
    });
    if (!ticket) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticket_id: ticket.id,
        product_id: ticket.product_id,
        author_id: userEmail,
        body: text,
        is_internal: false,
        is_bot: false,
      },
    });

    // Push user reply in real time to any listeners on this ticket room (widget + agent UIs).
    try {
      const io = getIO();
      io.to(`ticket:${ticket.id}`).emit('ticket:message', {
        ticket_id: ticket.id,
        from: 'user',
        text,
        attachments: parsedAttachments,
        created_at: new Date().toISOString(),
      });
    } catch (socketErr) {
      console.warn(
        'createTicketMessage: failed to emit ticket:message over socket (continuing):',
        (socketErr as Error).message,
      );
    }

    // Mirror user reply into Mongo Conversation thread
    try {
      if (ticket.tenant_product_id) {
        const messageDoc = {
          message_id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          author_type: 'user',
          author_id: userEmail,
          author_name: userEmail,
          body: text,
          is_internal: false,
          attachments: parsedAttachments,
          created_at: new Date(),
        };

        await Conversation.updateOne(
          {
            tenant_product_id: ticket.tenant_product_id,
            ticket_id: ticket.id,
            type: 'bot',
          },
          {
            $setOnInsert: {
              tenant_product_id: ticket.tenant_product_id,
              tenant_id: ticket.tenant_id ?? null,
              ticket_id: ticket.id,
              type: 'bot',
              created_at: new Date(),
            },
            $set: { updated_at: new Date() },
            $push: { messages: messageDoc },
          },
          { upsert: true, strict: false },
        );
      }
    } catch (mongoErr) {
      console.warn('createTicketMessage: failed to mirror user message to Conversation (continuing):', (mongoErr as Error).message);
    }

    res.status(201).json({
      id: comment.id,
      from: 'user',
      text: comment.body,
      attachments: parsedAttachments,
      created_at: comment.created_at,
    });
  } catch (e) {
    console.error('createTicketMessage error:', e);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

// POST /api/widget/support-suggest
// Public endpoint for webform/widget to get an AI fix suggestion and priority without API key.
export async function supportSuggest(req: Request, res: Response): Promise<void> {
  const { tenant_id, tenant_product_id, product_id, user_email, subject, description } =
    (req.body as any) || {};

  const tenantId = String(tenant_id || '').trim();
  const tenantProductId = String(tenant_product_id || '').trim();
  const productIdFromBody = String(product_id || '').trim();
  const userEmail = String(user_email || '').trim();

  if (!subject || !description) {
    res.status(400).json({ error: 'subject and description are required' });
    return;
  }

  // We need the product_id so we can pick the correct AI config.
  if (!productIdFromBody) {
    res.status(400).json({ error: 'product_id is required' });
    return;
  }

  try {
    // Validate or derive a safe product_id that exists in the DB.
    let effectiveProductId: string | null = null;

    if (productIdFromBody) {
      const product = await prisma.product.findUnique({
        where: { id: productIdFromBody },
        select: { id: true },
      });
      if (product) {
        effectiveProductId = product.id;
      }
    }

    // Fallback: try to infer product_id from SLA policies for this tenant_product_id
    if (!effectiveProductId && tenantProductId) {
      const sla = await prisma.slaPolicy.findFirst({
        where: { tenant_product_id: tenantProductId },
        select: { product_id: true },
      });
      if (sla) {
        effectiveProductId = sla.product_id;
      }
    }

    if (!effectiveProductId) {
      res.status(400).json({ error: 'Unable to resolve product context for AI (invalid product_id)' });
      return;
    }

    const textForAi =
      `${subject}\n\n${description}` +
      (tenantId || userEmail ? `\n\n[Context] tenant_id=${tenantId || 'n/a'}, user_email=${userEmail || 'n/a'}` : '');

    const adapter = await getActiveAdapter(effectiveProductId);

    // Run classification, sentiment, and RAG-backed suggestion in parallel.
    const [cls, snt, reply] = await Promise.all([
      adapter.classify(textForAi),
      adapter.detectSentiment(textForAi),
      (async () => {
        try {
          const q = await embedQuery(textForAi);
          const hits = await searchKb(q, { limit: 5, tenant_product_id: tenantProductId || undefined });
          const top = hits[0];
          const ok = top && top.score >= 0.25;

          let kbContext = '';
          if (ok) {
            const contexts = hits
              .map((h) => ({
                text: String((h.payload as any)?.text || ''),
                score: Number(h.score || 0),
              }))
              .filter((c) => c.text.trim().length > 0);

            kbContext = contexts
              .slice(0, 4)
              .map((c, i) => `KB CHUNK ${i + 1} (relevance ${c.score.toFixed(3)}):\n${c.text}`)
              .join('\n\n');
          }

          const replyText = await adapter.chat(
            [
              {
                role: 'user',
                content:
                  'You are a first-line support assistant. The user submitted the following issue from a web form.\n' +
                  'Use the knowledge base context (when provided) plus the issue text to give a concise, step-by-step suggestion to fix or unblock them.\n' +
                  'Use simple language, and keep it under 250 words.\n\n' +
                  `Issue:\n${textForAi}`,
              },
            ],
            kbContext
          );

          return replyText;
        } catch (e) {
          console.warn('supportSuggest: RAG lookup failed, falling back to plain suggestion:', (e as Error).message);
          // Fallback: simple non-RAG suggestion using adapter.chat with empty KB context
          return adapter.chat(
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
          );
        }
      })(),
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
        tenant_id: tenantId || null,
        tenant_product_id: tenantProductId || null,
        user_email: userEmail || null,
      },
    });
  } catch (e) {
    console.error('widget supportSuggest error:', e);
    res.status(500).json({ error: 'Failed to generate AI suggestion' });
  }
}

// POST /api/widget/tickets
// Create a ticket from a web form / widget, with AI classification + SLA,
// and send an email confirmation to the user. No API key required.
export async function createTicketFromWidget(req: Request, res: Response): Promise<void> {
  const {
    name,
    email,
    subject,
    description,
    priority,
    tenant_id,
    tenant_product_id,
    product_id,
  } = (req.body as any) || {};

  const tenantId = String(tenant_id || '').trim() || null;
  const tenantProductId = String(tenant_product_id || '').trim() || null;
  const productIdFromBody = String(product_id || '').trim() || null;

  if (!subject || !description) {
    res.status(400).json({ error: 'subject and description are required' });
    return;
  }
  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  if (!productIdFromBody) {
    res.status(400).json({ error: 'product_id is required' });
    return;
  }

  try {
    // Validate or derive a safe product_id that exists in the DB.
    let effectiveProductId: string | null = null;

    if (productIdFromBody) {
      const product = await prisma.product.findUnique({
        where: { id: productIdFromBody },
        select: { id: true },
      });
      if (product) {
        effectiveProductId = product.id;
      }
    }

    // Fallback: try to infer product_id from SLA policies for this tenant_product_id
    if (!effectiveProductId && tenantProductId) {
      const sla = await prisma.slaPolicy.findFirst({
        where: { tenant_product_id: tenantProductId },
        select: { product_id: true },
      });
      if (sla) {
        effectiveProductId = sla.product_id;
      }
    }

    if (!effectiveProductId) {
      res.status(400).json({ error: 'Unable to resolve product context for ticket (invalid product_id)' });
      return;
    }

    const ticketNumber =
      'TKT-' +
      Date.now().toString(36).toUpperCase() +
      '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    const textForAi = `${subject}\n\n${description}`;

    let category: string | null = null;
    let subCategory: string | null = null;
    let aiPriority: string | null = null;
    let department: string | null = null;
    let aiConfidence: number | null = null;
    let sentiment: string | null = null;
    let sentimentTrend: string | null = null;

    try {
      const adapter = await getActiveAdapter(effectiveProductId);
      const [cls, snt] = await Promise.all([
        adapter.classify(textForAi),
        adapter.detectSentiment(textForAi),
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
    } catch (aiErr) {
      console.warn('createTicketFromWidget: AI enrichment failed (continuing without AI):', (aiErr as Error).message);
    }

    const normalizedPriority = (function () {
      const explicit = typeof priority === 'string' ? priority.toLowerCase() : null;
      const fromAi = aiPriority;
      const val = explicit || fromAi;
      if (val === 'p1' || val === 'p2' || val === 'p3' || val === 'p4') return val;
      return 'p3';
    })();

    // Resolve tenant_product_id for routing/queues. If the hosted webform didn't pass it,
    // fall back to tenant channel settings default product, then any active tenant product.
    let effectiveTenantProductId = tenantProductId || null;
    if (!effectiveTenantProductId && tenantId) {
      try {
        const settings = await prisma.tenantChannelSettings.findUnique({
          where: { tenant_id: tenantId },
          select: { default_product_id: true },
        });
        if (settings?.default_product_id) effectiveTenantProductId = settings.default_product_id;
      } catch {
        // ignore
      }
      if (!effectiveTenantProductId) {
        try {
          const firstTp = await prisma.tenantProduct.findFirst({
            where: { tenant_id: tenantId, status: 'active' },
            select: { id: true },
            orderBy: { created_at: 'asc' },
          });
          if (firstTp?.id) effectiveTenantProductId = firstTp.id;
        } catch {
          // ignore
        }
      }
    }
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
      console.warn('createTicketFromWidget: SLA policy lookup failed (continuing without SLA):', (slaErr as Error).message);
    }

    const ticket = await prisma.ticket.create({
      data: {
        ticket_number: ticketNumber,
        product_id: effectiveProductId,
        tenant_product_id: effectiveTenantProductId,
        tenant_id: tenantId,
        subject: String(subject),
        description: String(description),
        created_by: String(email),
        priority: normalizedPriority as any,
        source: 'web_form',
        user_type: 'individual',
        category: category,
        sub_category: subCategory,
        department: department,
        ai_confidence: aiConfidence,
        sentiment: sentiment as any,
        sentiment_trend: sentimentTrend,
        sla_deadline: slaDeadline,
      },
    });

    // Fire-and-forget email confirmation to the user
    sendEmail({
      to: email,
      subject: `We received your support request (${ticket.ticket_number})`,
      text:
        `Hi${name ? ' ' + name : ''},\n\n` +
        `Thanks for reaching out. We've created a ticket for your request.\n\n` +
        `Ticket: ${ticket.ticket_number}\n` +
        `Subject: ${subject}\n` +
        `Priority: ${normalizedPriority.toUpperCase()}\n\n` +
        `A human support agent will get in touch with you via email on this thread.\n\n` +
        `Best,\nSupport team`,
    }).catch(() => {
      // Logged inside sendEmail
    });

    res.status(201).json({
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
    });
  } catch (e) {
    console.error('createTicketFromWidget error:', e);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
}

