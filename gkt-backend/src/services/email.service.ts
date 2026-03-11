import sgMail from '@sendgrid/mail';
import { env } from '../config/env';

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

type BasicEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Reply-To header (e.g. agent email). Replies from the recipient go here. */
  replyTo?: string;
  /** Display name for From (e.g. agent name). */
  fromName?: string;
  /** From address. Must be verified in SendGrid; if omitted, uses SENDGRID_FROM_EMAIL. */
  fromEmail?: string;
};

/**
 * Send email via SendGrid. When "Send email" is clicked in the ticket UI, this sends
 * from the configured/agent address to the requester (To).
 * - From: SENDGRID_FROM_EMAIL (verified in SendGrid) or fromEmail if provided and verified.
 * - To: requester email (ticket.created_by).
 * - Reply-To: agent email so replies go back to the agent.
 */
export async function sendEmail({ to, subject, text, html, replyTo, fromName, fromEmail }: BasicEmail): Promise<void> {
  const apiKey = env.SENDGRID_API_KEY;
  const defaultFrom = env.SENDGRID_FROM_EMAIL;
  const from = fromEmail?.trim() || defaultFrom;

  if (!apiKey || !from) {
    console.warn('sendEmail: SENDGRID_API_KEY and SENDGRID_FROM_EMAIL must be set. Skipping send.');
    return;
  }

  if (!to?.trim()) {
    console.warn('sendEmail: missing "to" address. Skipping send.');
    return;
  }

  try {
    await sgMail.send({
      to: to.trim(),
      from: {
        email: from,
        name: fromName?.trim() || undefined,
      },
      replyTo: replyTo?.trim() || undefined,
      subject: subject?.trim() || '(No subject)',
      text: text?.trim() || '',
      html:
        html?.trim() ||
        `<pre style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; white-space: pre-wrap;">${String(text || '').trim()}</pre>`,
    });
  } catch (e) {
    console.error('sendEmail: SendGrid failed:', (e as Error).message);
    throw e;
  }
}

