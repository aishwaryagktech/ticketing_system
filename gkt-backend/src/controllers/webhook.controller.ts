import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { getIO } from '../config/socket';

// POST /api/webhooks/email
// Expected payload: SendGrid Inbound Parse (or similar) with at least:
// - subject: string (must contain ticket number, e.g. "Re: TKT-XXXX-XXXX - Subject")
// - from: string (e.g. "User Name <user@example.com>" or "user@example.com")
// - text: string (plain text body) or html: string
export async function handleEmailWebhook(req: Request, res: Response): Promise<void> {
  const body = (req.body as any) || {};

  const subject: string = body.subject || '';
  const fromRaw: string = body.from || '';
  const textBody: string = body.text || '';
  const htmlBody: string = body.html || '';

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
      select: { id: true, product_id: true, tenant_id: true, created_by: true },
    });

    if (!ticket) {
      res.status(200).json({ ignored: true, reason: 'ticket_not_found' });
      return;
    }

    // Parse sender email from "From" header
    let senderEmail = '';
    if (fromRaw.includes('<') && fromRaw.includes('>')) {
      const m = fromRaw.match(/<([^>]+)>/);
      senderEmail = (m?.[1] || '').trim().toLowerCase();
    } else {
      senderEmail = String(fromRaw || '').split(' ').pop()!.trim().toLowerCase();
    }

    const bodyText = (textBody || htmlBody || '').trim();
    if (!bodyText) {
      res.status(200).json({ ignored: true, reason: 'empty_body' });
      return;
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
