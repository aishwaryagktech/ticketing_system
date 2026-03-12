import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { getIO } from '../config/socket';
import { Conversation } from '../../mongo/models/conversation.model';
import { EmailPayload } from '../../mongo/models/email-payload.model';

// POST /api/webhooks/email
// Expected payload: SendGrid Inbound Parse (or similar) with at least:
// - subject: string (must contain ticket number, e.g. "Re: TKT-XXXX-XXXX - Subject")
// - from: string (e.g. "User Name <user@example.com>" or "user@example.com")
// - text: string (plain text body) or html: string
export async function handleEmailWebhook(req: Request, res: Response): Promise<void> {
  const body = (req.body as any) || {};

  const subject: string = body.subject || '';
  const fromRaw: string = body.from || '';
  const toRaw: string = body.to || body.envelope?.to || '';
  const textBody: string = body.text || '';
  const htmlBody: string = body.html || '';

  // Helpful debug signal: if this never appears, the webhook isn't being hit.
  console.info('handleEmailWebhook: inbound received', {
    hasSubject: !!subject,
    hasFrom: !!fromRaw,
    hasTo: !!toRaw,
    bodyKeys: Object.keys(body || {}).slice(0, 25),
  });

  // Extract ticket number from subject, e.g. "Re: TKT-ABC123-XYZ - issue"
  const ticketMatch = subject.match(/TKT-[A-Z0-9]+-[A-Z0-9]+/i);
  if (!ticketMatch) {
    // Not a ticket-related email; acknowledge to avoid retries.
    res.status(200).json({ ignored: true, reason: 'no_ticket_number_in_subject' });
    return;
  }
  const ticketNumber = ticketMatch[0].toUpperCase();

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { ticket_number: ticketNumber },
      select: { id: true, product_id: true, tenant_id: true, tenant_product_id: true, created_by: true },
    });

    if (!ticket) {
      res.status(200).json({ ignored: true, reason: 'ticket_not_found' });
      return;
    }

    // Parse sender email from "From" header
    let senderEmail = '';
    let senderName = '';
    if (fromRaw.includes('<') && fromRaw.includes('>')) {
      const m = fromRaw.match(/<([^>]+)>/);
      senderEmail = (m?.[1] || '').trim().toLowerCase();
      senderName = fromRaw.replace(m?.[0] || '', '').replace(/["<>]/g, '').trim();
    } else {
      senderEmail = String(fromRaw || '').split(' ').pop()!.trim().toLowerCase();
      senderName = String(fromRaw || '').replace(senderEmail, '').replace(/["<>]/g, '').trim();
    }

    const bodyText = (textBody || htmlBody || '').trim();
    if (!bodyText) {
      res.status(200).json({ ignored: true, reason: 'empty_body' });
      return;
    }

    // Store raw inbound payload for debugging/forensics (best-effort)
    try {
      await EmailPayload.create({
        product_id: ticket.product_id,
        from_email: senderEmail || 'unknown',
        from_name: senderName || undefined,
        to_email: String(toRaw || '').trim() || (ticket.created_by || 'unknown'),
        subject: subject || undefined,
        body_text: textBody || undefined,
        body_html: htmlBody || undefined,
        headers: { headers: req.headers, bodyKeys: Object.keys(body || {}) },
        parsed_ticket_id: ticket.id,
        is_reply: true,
        processing_status: 'processed',
      });
    } catch (e) {
      console.warn('handleEmailWebhook: failed to persist EmailPayload (continuing):', (e as Error).message);
    }

    // Append as a user-side ticket comment
    const comment = await prisma.ticketComment.create({
      data: {
        ticket_id: ticket.id,
        product_id: ticket.product_id,
        author_id: senderEmail || ticket.created_by || 'email_user',
        body: bodyText,
        is_internal: false,
        is_bot: false,
      },
    });

    if (ticket.tenant_product_id) {
      try {
        const messageDoc = {
          message_id: comment.id,
          author_type: 'user',
          author_id: senderEmail || ticket.created_by || 'email_user',
          author_name: 'Requester',
          body: bodyText,
          is_internal: false,
          created_at: comment.created_at,
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
            },
            $set: { updated_at: new Date() },
            $push: { messages: messageDoc },
          },
          { upsert: true, strict: false },
        );
      } catch (e) {
        console.warn('handleEmailWebhook: failed to append to Mongo Conversation:', (e as Error).message);
      }
    }

    console.info('handleEmailWebhook: inbound reply added to ticket', ticket.id, 'from', senderEmail);

    // Push real-time update to agent UIs
    try {
      const io = getIO();
      io.to(`ticket:${ticket.id}`).emit('ticket:message', {
        ticket_id: ticket.id,
        from: 'user',
        text: bodyText,
        created_at: comment.created_at.toISOString(),
      });
    } catch (e) {
      console.warn('handleEmailWebhook: failed to emit ticket:message over socket (continuing):', (e as Error).message);
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('handleEmailWebhook error:', e);
    res.status(500).json({ error: 'Failed to handle email webhook' });
  }
}

export async function handleStripeWebhook(_req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Stripe webhook not implemented' });
}

export async function handleRazorpayWebhook(_req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Razorpay webhook not implemented' });
}
