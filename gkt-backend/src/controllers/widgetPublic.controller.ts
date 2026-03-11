import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { Conversation } from '../../mongo/models/conversation.model';
import { getIO } from '../config/socket';
import { getActiveAdapter } from '../ai/provider';
import { embedQuery, searchKb } from '../services/embedding.service';

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

    // Prefer Mongo Conversation as the single source of truth for the thread when available.
    let fromMongo: any[] | null = null;
    if (ticket.tenant_product_id) {
      try {
        const convo = await Conversation.findOne(
          { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'bot' },
        ).lean();
        if (convo && Array.isArray(convo.messages) && convo.messages.length > 0) {
          fromMongo = convo.messages.map((m: any) => ({
            id: m.message_id,
            from: m.author_type === 'bot' ? 'bot' : m.author_type === 'user' ? 'user' : 'agent',
            text: m.body,
            created_at: m.created_at ? new Date(m.created_at) : new Date(),
          }));
        }
      } catch (e) {
        console.warn('listTicketMessages: failed to load Conversation, falling back to comments:', (e as Error).message);
      }
    }

    if (fromMongo) {
      const sorted = fromMongo.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      res.json({ messages: sorted });
      return;
    }

    // Fallback: build a basic thread from ticket description + non-internal comments.
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

    let baseText = ticket.description || ticket.subject;
    if (baseText) {
      const marker = '\n---\nChat transcript\n---';
      const idx = baseText.indexOf(marker);
      if (idx >= 0) {
        baseText = baseText.slice(0, idx).trim();
      }
    }
    const ticketStart = {
      id: 'ticket-desc',
      from: 'user' as const,
      text: baseText || ticket.subject,
      created_at: ticket.created_at,
    };

    const commentMessages = comments
      .filter((c) => !c.is_internal)
      .map((c) => ({
        id: c.id,
        from: c.is_bot ? ('bot' as const) : ('agent' as const),
        text: c.body,
        created_at: c.created_at,
      }));

    const merged = [ticketStart, ...commentMessages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    res.json({ messages: merged });
  } catch (e) {
    console.error('listTicketMessages error:', e);
    res.status(500).json({ error: 'Failed to list messages' });
  }
}

// POST /api/widget/tickets/:id/messages
export async function createTicketMessage(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { tenant_id, user_email, body } = (req.body as any) || {};

  const tenantId = String(tenant_id || '').trim();
  const userEmail = String(user_email || '').trim();
  const text = typeof body === 'string' ? body.trim() : '';

  if (!tenantId || !userEmail) {
    res.status(400).json({ error: 'tenant_id and user_email are required' });
    return;
  }
  if (!text) {
    res.status(400).json({ error: 'body required' });
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
  const { tenant_id, tenant_product_id, product_id, user_email, subject, description } = (req.body as any) || {};

  const tenantId = String(tenant_id || '').trim();
  const tenantProductId = String(tenant_product_id || '').trim();
  const productIdFromBody = String(product_id || '').trim();
  const userEmail = String(user_email || '').trim();

  if (!subject || !description) {
    res.status(400).json({ error: 'subject and description are required' });
    return;
  }

  // We require at least a product context (product_id or tenant_product_id) to pick the right AI config.
  if (!productIdFromBody && !tenantProductId) {
    res.status(400).json({ error: 'product_id or tenant_product_id is required' });
    return;
  }

  let effectiveProductId: string | null = productIdFromBody || null;

  try {
    if (!effectiveProductId && tenantProductId) {
      const tp = await prisma.tenantProduct.findUnique({
        where: { id: tenantProductId },
        select: { product_id: true },
      });
      effectiveProductId = tp?.product_id || null;
    }

    if (!effectiveProductId) {
      res.status(400).json({ error: 'Unable to resolve product context for AI' });
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

