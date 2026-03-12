import { Response } from 'express';
import { prisma } from '../db/postgres';
import { AuthRequest } from '../middleware/auth';
import { getActiveAdapter } from '../ai/provider';
import { Conversation } from '../../mongo/models/conversation.model';
import { getIO } from '../config/socket';
import { sendEmail } from '../services/email.service';
import { sendGmailMessage } from '../services/gmail.service';
import { env } from '../config/env';
import { decryptPII } from '../utils/encrypt';

// GET /api/tickets/:id/comments
export async function listComments(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params; // ticket id
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
    const comments = await prisma.ticketComment.findMany({
      where: { ticket_id: id },
      orderBy: { created_at: 'asc' },
    });
    res.json({ items: comments });
  } catch (e) {
    console.error('listComments error:', e);
    res.status(500).json({ error: 'Failed to list comments' });
  }
}

// POST /api/tickets/:id/comments
export async function createComment(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const { id } = req.params; // ticket id
  const { body, is_internal } = (req.body as any) || {};
  if (!tenantId || !userId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }
  if (typeof body !== 'string' || !body.trim()) {
    res.status(400).json({ error: 'body required' });
    return;
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        product_id: true,
        sentiment: true,
        tenant_id: true,
        tenant_product_id: true,
        source: true,
        created_by: true,
        subject: true,
        description: true,
        created_at: true,
        ticket_number: true,
      },
    });
    if (!ticket) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const comment = await prisma.ticketComment.create({
      data: {
        ticket_id: ticket.id,
        product_id: ticket.product_id,
        author_id: userId,
        body: body.trim(),
        is_internal: is_internal === true,
        is_bot: false,
      },
    });
    // Run sentiment detection on this reply and update ticket sentiment/trend (best-effort).
    try {
      const adapter = await getActiveAdapter(ticket.product_id);
      const snt = await adapter.detectSentiment(body.trim());
      const newSentiment = (snt.sentiment || '').toLowerCase();
      const trend = snt.trend || 'stable';

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          sentiment: newSentiment as any,
          sentiment_trend: trend,
        },
      });
    } catch (aiErr) {
      console.warn('createComment: sentiment update failed (continuing):', (aiErr as Error).message);
    }

    // Mirror agent reply into Mongo Conversation.
    // web_form tickets: write to type:'ticket' (email thread, Gmail-synced).
    // All other sources (bot_handoff, widget, etc.): write to type:'bot'.
    try {
      if (ticket.tenant_product_id) {
        const messageDoc = {
          message_id: comment.id,
          author_type: 'agent',
          author_id: userId,
          author_name: 'Agent',
          body: body.trim(),
          is_internal: is_internal === true,
          created_at: comment.created_at,
        };

        if (ticket.source === 'web_form') {
          // For email tickets, mirror to type:'ticket' so the conversation
          // endpoint always reads from the same store that Gmail sync writes to.
          if (is_internal !== true) {
            const agentMsg = { ...messageDoc, message_id: comment.id };
            const originalMsg = {
              message_id: 'ticket-original',
              author_type: 'user',
              author_id: ticket.created_by || 'user',
              author_name: 'Requester',
              body: (ticket.description || ticket.subject || '').trim() || '—',
              is_internal: false,
              created_at: ticket.created_at,
            };
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
                  messages: [originalMsg],
                },
                $set: { updated_at: new Date() },
                $push: { messages: agentMsg },
              },
              { upsert: true, strict: false },
            );
          }
        } else {
          // For bot_handoff / widget / other sources, mirror to type:'bot'.
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
              $push: { messages: { ...messageDoc, message_id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}` } },
            },
            { upsert: true, strict: false },
          );
        }
      }
    } catch (mongoErr) {
      console.warn(
        'createComment: failed to mirror agent message to Conversation (continuing):',
        (mongoErr as Error).message,
      );
    }

    // Push agent reply in real time to any listeners on this ticket room (widget + agent UIs).
    try {
      const io = getIO();
      io.to(`ticket:${ticket.id}`).emit('ticket:message', {
        ticket_id: ticket.id,
        from: is_internal === true ? 'agent_internal' : 'agent',
        text: body.trim(),
        created_at: new Date().toISOString(),
      });
    } catch (socketErr) {
      console.warn(
        'createComment: failed to emit ticket:message over socket (continuing):',
        (socketErr as Error).message,
      );
    }

    // For web_form tickets, non-internal comments are sent as emails.
    // Prefer Gmail (when GMAIL_SYNC_ACCOUNT is set) so replies land in the
    // authorized inbox and can be fetched by the thread sync on Refresh.
    let emailSent = false;
    let sentGmailThreadId: string | null = null;
    if (ticket.source === 'web_form' && is_internal !== true && ticket.created_by) {
      const gmailSyncAccount = String(env.GMAIL_SYNC_ACCOUNT || '').toLowerCase();
      const useGmail = Boolean(gmailSyncAccount);

      try {
        let agentName: string | null = null;
        try {
          const agentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { first_name: true, last_name: true },
          });
          const fullName = [agentUser?.first_name, agentUser?.last_name].filter(Boolean).join(' ').trim();
          agentName = fullName || null;
        } catch {
          // ignore
        }

        const subject = `Re: ${ticket.ticket_number} - ${ticket.subject}`;

        if (useGmail && ticket.tenant_product_id) {
          // Look up stored Gmail thread ID (if any) from the Mongo Conversation doc.
          let knownThreadId: string | null = null;
          try {
            const conv = await Conversation.findOne(
              { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'ticket' },
              { gmail_thread_id: 1 },
            ).lean() as any;
            knownThreadId = conv?.gmail_thread_id || null;
          } catch {
            // ignore — we'll send without a threadId and get a new one
          }

          const sent = await sendGmailMessage({
            authedEmail: gmailSyncAccount,
            to: ticket.created_by,
            subject,
            body: body.trim(),
            fromName: agentName || 'Support',
            knownThreadId,
          });

          // Persist the thread ID so the next send and every Refresh can use it.
          if (sent.threadId && ticket.tenant_product_id) {
            try {
              await Conversation.updateOne(
                { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'ticket' },
                {
                  $setOnInsert: {
                    tenant_product_id: ticket.tenant_product_id,
                    tenant_id: ticket.tenant_id ?? null,
                    ticket_id: ticket.id,
                    type: 'ticket',
                    created_at: new Date(),
                    messages: [],
                  },
                  $set: { updated_at: new Date(), gmail_thread_id: sent.threadId },
                },
                { upsert: true, strict: false },
              );
              sentGmailThreadId = sent.threadId;
            } catch (mongoErr) {
              console.warn('createComment: failed to store gmail_thread_id:', (mongoErr as Error).message);
            }
          }
          emailSent = true;
        } else {
          // Fallback: SendGrid
          await sendEmail({
            to: ticket.created_by,
            subject,
            text: body.trim(),
            replyTo: env.SENDGRID_FROM_EMAIL || undefined,
            fromName: agentName || 'Support',
          });
          emailSent = true;
        }
      } catch (emailErr) {
        console.warn('createComment: failed to send email reply (continuing):', (emailErr as Error).message);
      }
    }

    res.status(201).json({ ...comment, email_sent: emailSent, gmail_thread_id: sentGmailThreadId });
  } catch (e) {
    console.error('createComment error:', e);
    res.status(500).json({ error: 'Failed to create comment' });
  }
}
