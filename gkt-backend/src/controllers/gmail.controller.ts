import { Response } from 'express';
import { prisma } from '../db/postgres';
import { AuthRequest } from '../middleware/auth';
import { env } from '../config/env';
import { Conversation } from '../../mongo/models/conversation.model';
import {
  getGmailAuthUrl,
  getGmailOAuthClient,
  saveGmailTokens,
  syncTicketThreadFromGmail,
} from '../services/gmail.service';

// GET /api/gmail/oauth/connect  (public – browser navigates here directly)
export async function oauthConnect(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const url = getGmailAuthUrl();
    res.redirect(url);
  } catch (e) {
    res.status(500).send(`Failed to build OAuth URL: ${(e as Error).message}`);
  }
}

// GET /api/gmail/oauth/start
export async function oauthStart(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const url = getGmailAuthUrl();
    res.json({ url, redirect_uri: env.GMAIL_REDIRECT_URI });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message || 'Failed to create auth URL' });
  }
}

// GET /api/gmail/oauth/callback?code=...
export async function oauthCallback(req: AuthRequest, res: Response): Promise<void> {
  const code = String((req.query as any)?.code || '');
  if (!code) {
    res.status(400).json({ error: 'code required' });
    return;
  }
  try {
    const oauth2 = getGmailOAuthClient();
    const { tokens } = await oauth2.getToken({ code, redirect_uri: env.GMAIL_REDIRECT_URI || undefined });
    oauth2.setCredentials(tokens);
    const profile = await (await import('googleapis')).google.gmail({ version: 'v1', auth: oauth2 }).users.getProfile({ userId: 'me' });
    const email = String(profile.data.emailAddress || '').toLowerCase();
    if (!email) {
      res.status(500).json({ error: 'Failed to resolve Gmail profile email' });
      return;
    }
    await saveGmailTokens(email, tokens);
    const accept = String(req.headers.accept || '');
    const wantsHtml = accept.includes('text/html');
    if (wantsHtml) {
      res.redirect(`${env.FRONTEND_URL}/agent/gmail?gmail_connected=1&email=${encodeURIComponent(email)}`);
      return;
    }
    res.json({ ok: true, email });
  } catch (e) {
    const anyErr: any = e as any;
    const respData = anyErr?.response?.data;
    const googleError =
      respData?.error_description ||
      respData?.error ||
      anyErr?.message ||
      'OAuth callback failed';
    console.error('oauthCallback: token exchange failed', {
      redirect_uri: env.GMAIL_REDIRECT_URI,
      google_response: respData,
    });
    const isInvalidGrant =
      String(respData?.error || '').toLowerCase() === 'invalid_grant' ||
      String(googleError || '').toLowerCase().includes('invalid_grant');
    res.status(500).json({
      error: googleError,
      redirect_uri: env.GMAIL_REDIRECT_URI,
      google_response: respData ?? null,
      hint: isInvalidGrant
        ? 'invalid_grant usually means: (1) Authorized redirect URI mismatch in Google Cloud, (2) code already used/expired, (3) wrong client secret, or (4) system clock skew.'
        : undefined,
    });
  }
}

// POST /api/gmail/sync/tickets/:id
export async function syncTicketThread(req: AuthRequest, res: Response): Promise<void> {
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
        ticket_number: true,
        description: true,
        subject: true,
        created_at: true,
      },
    });
    if (!ticket || !ticket.tenant_product_id) {
      res.status(404).json({ error: 'Ticket not found or missing tenant_product_id' });
      return;
    }

    const authedEmail = String(env.GMAIL_SYNC_ACCOUNT || '').toLowerCase();
    if (!authedEmail) {
      res.status(400).json({ error: 'GMAIL_SYNC_ACCOUNT is required (the Gmail inbox you authorized)' });
      return;
    }

    // Look up stored thread ID from Mongo so we use gmail.users.threads.get() directly.
    let knownThreadId: string | null = null;
    try {
      const conv = await Conversation.findOne(
        { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'ticket' },
        { gmail_thread_id: 1 },
      ).lean() as any;
      knownThreadId = conv?.gmail_thread_id || null;
    } catch {
      // ignore — fall back to subject search
    }

    const sync = await syncTicketThreadFromGmail({
      authedEmail,
      ticketNumber: ticket.ticket_number,
      tenantProductId: ticket.tenant_product_id,
      tenantId: ticket.tenant_id ?? null,
      ticketId: ticket.id,
      knownThreadId,
    });

    // If we just discovered a thread ID via subject search, store it for next time.
    if (sync.threadId && sync.threadId !== knownThreadId) {
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
            $set: { updated_at: new Date(), gmail_thread_id: sync.threadId },
          },
          { upsert: true, strict: false },
        );
      } catch {
        // non-fatal
      }
    }

    const originalMsg = {
      message_id: 'ticket-original',
      author_type: 'user',
      author_id: 'requester',
      author_name: 'Requester',
      body: (ticket.description || ticket.subject || '').trim() || '—',
      is_internal: false,
      created_at: ticket.created_at,
    };

    const messageDocs = [
      originalMsg,
      ...sync.items.map((m) => ({
        message_id: m.id,
        author_type: m.from,
        author_id: m.from === 'agent' ? authedEmail : 'requester',
        author_name: m.from === 'agent' ? 'Support' : 'Requester',
        body: m.text,
        is_internal: false,
        created_at: m.created_at,
      })),
    ];

    await Conversation.updateOne(
      { tenant_product_id: ticket.tenant_product_id, ticket_id: ticket.id, type: 'ticket' },
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

    res.json({ ok: true, count: sync.items.length });
  } catch (e) {
    const msg = (e as Error)?.message || '';
    console.error('syncTicketThread error:', e);
    if (msg.includes('No Gmail tokens stored')) {
      res.status(400).json({
        error: 'Gmail not connected. Go to /agent/gmail and click "Open Gmail OAuth →", then retry.',
      });
      return;
    }
    res.status(500).json({ error: 'Failed to sync Gmail thread' });
  }
}
