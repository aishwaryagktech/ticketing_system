import { Response } from 'express';
import { prisma } from '../db/postgres';
import { AuthRequest } from '../middleware/auth';
import { getActiveAdapter } from '../ai/provider';
import { Conversation } from '../../mongo/models/conversation.model';

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
      select: { id: true, product_id: true, sentiment: true, tenant_id: true, tenant_product_id: true },
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

    // Mirror agent reply into Mongo Conversation so bot + human chat share one thread.
    try {
      if (ticket.tenant_product_id) {
        const messageDoc = {
          message_id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          author_type: 'agent',
          author_id: userId,
          author_name: 'Agent',
          body: body.trim(),
          is_internal: is_internal === true,
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
      console.warn('createComment: failed to mirror agent message to Conversation (continuing):', (mongoErr as Error).message);
    }

    res.status(201).json(comment);
  } catch (e) {
    console.error('createComment error:', e);
    res.status(500).json({ error: 'Failed to create comment' });
  }
}
