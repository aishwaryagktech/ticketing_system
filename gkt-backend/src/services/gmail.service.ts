import { google } from 'googleapis';
import { env } from '../config/env';
import { GmailAuth } from '../../mongo/models/gmail-auth.model';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

export function getGmailOAuthClient() {
  const clientId = env.GMAIL_CLIENT_ID;
  const clientSecret = env.GMAIL_CLIENT_SECRET;
  const redirectUri = env.GMAIL_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Gmail OAuth env missing: GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REDIRECT_URI');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGmailAuthUrl(): string {
  const oauth2 = getGmailOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    redirect_uri: env.GMAIL_REDIRECT_URI,
  });
}

export async function saveGmailTokens(email: string, tokens: any): Promise<void> {
  await GmailAuth.updateOne(
    { email: email.toLowerCase() },
    { $set: { tokens, updated_at: new Date() }, $setOnInsert: { email: email.toLowerCase(), created_at: new Date() } },
    { upsert: true, strict: false },
  );
}

export async function loadGmailTokens(email: string): Promise<any | null> {
  const doc = await GmailAuth.findOne({ email: email.toLowerCase() }).lean();
  return doc?.tokens ?? null;
}

export async function getGmailClientFor(email: string) {
  const oauth2 = getGmailOAuthClient();
  const tokens = await loadGmailTokens(email);
  if (!tokens) throw new Error(`No Gmail tokens stored for ${email}`);
  oauth2.setCredentials(tokens);
  oauth2.on('tokens', async (newTokens) => {
    try {
      const merged = { ...(tokens || {}), ...(newTokens || {}) };
      await saveGmailTokens(email, merged);
    } catch {
      // ignore
    }
  });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });
  return { gmail, oauth2 };
}

/**
 * Send an email via Gmail API.
 * Pass knownThreadId to keep the message inside an existing Gmail thread (for replies).
 * Returns { messageId, threadId } — store threadId in the Conversation doc for future fetches.
 */
export async function sendGmailMessage(params: {
  authedEmail: string;
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  knownThreadId?: string | null;
}): Promise<{ messageId: string; threadId: string }> {
  const { gmail } = await getGmailClientFor(params.authedEmail);

  const fromHeader = params.fromName
    ? `"${params.fromName}" <${params.authedEmail}>`
    : params.authedEmail;

  // RFC 2822 raw message
  const raw = [
    `From: ${fromHeader}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    params.body,
  ].join('\r\n');

  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const requestBody: any = { raw: encoded };
  if (params.knownThreadId) requestBody.threadId = params.knownThreadId;

  const sent = await gmail.users.messages.send({ userId: 'me', requestBody });
  return {
    messageId: sent.data.id || '',
    threadId: sent.data.threadId || '',
  };
}

/**
 * Sync a ticket's email thread from Gmail.
 *
 * If knownThreadId is provided (stored in Mongo Conversation), we use
 * gmail.users.threads.get() — reliable, single API call, gets every message.
 *
 * Otherwise we fall back to a subject search (less reliable but works for the
 * first sync before a thread ID has been stored).
 */
export async function syncTicketThreadFromGmail(params: {
  authedEmail: string;
  ticketNumber: string;
  tenantProductId: string;
  tenantId: string | null;
  ticketId: string;
  knownThreadId?: string | null;
}): Promise<{ items: Array<{ id: string; from: 'user' | 'agent'; text: string; created_at: Date }>; threadId: string | null }> {
  const { gmail } = await getGmailClientFor(params.authedEmail);

  type MsgItem = { id: string; from: 'user' | 'agent'; text: string; created_at: Date };

  if (params.knownThreadId) {
    // ── Preferred path: fetch thread by ID ──────────────────────────────────
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: params.knownThreadId,
      format: 'full',
    });

    const items: MsgItem[] = [];
    for (const m of thread.data.messages || []) {
      const headers = m.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => (h.name || '').toLowerCase() === name.toLowerCase())?.value || '';
      const from = getHeader('From');
      const date = getHeader('Date');
      const internalDate = m.internalDate ? Number(m.internalDate) : null;
      const created_at = internalDate ? new Date(internalDate) : date ? new Date(date) : new Date();

      const isAgent = from.toLowerCase().includes(params.authedEmail.toLowerCase());
      const bodyText = extractText(m.payload);
      items.push({
        id: m.id || `${created_at.getTime()}`,
        from: isAgent ? 'agent' : 'user',
        text: (bodyText || m.snippet || '').trim(),
        created_at,
      });
    }

    items.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    return { items, threadId: thread.data.id || params.knownThreadId };
  }

  // ── Fallback: search by ticket number in subject ─────────────────────────
  const q = `subject:(${params.ticketNumber})`;
  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 });

  const msgs = list.data.messages || [];
  if (msgs.length === 0) return { items: [], threadId: null };

  const discoveredThreadId = msgs[0]?.threadId ?? null;

  // If all messages share the same thread, fetch the whole thread at once
  const allSameThread = msgs.every((m) => m.threadId === discoveredThreadId);
  if (allSameThread && discoveredThreadId) {
    return syncTicketThreadFromGmail({ ...params, knownThreadId: discoveredThreadId });
  }

  // Mixed threads — fall back to per-message fetch
  const items: MsgItem[] = [];
  for (const m of msgs) {
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' });
    const headers = full.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => (h.name || '').toLowerCase() === name.toLowerCase())?.value || '';
    const from = getHeader('From');
    const date = getHeader('Date');
    const internalDate = full.data.internalDate ? Number(full.data.internalDate) : null;
    const created_at = internalDate ? new Date(internalDate) : date ? new Date(date) : new Date();

    const isAgent = from.toLowerCase().includes(params.authedEmail.toLowerCase());
    const bodyText = extractText(full.data.payload);
    items.push({
      id: full.data.id || m.id || `${created_at.getTime()}`,
      from: isAgent ? 'agent' : 'user',
      text: (bodyText || full.data.snippet || '').trim(),
      created_at,
    });
  }

  items.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  return { items, threadId: discoveredThreadId };
}

function extractText(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    const raw = Buffer.from(payload.body.data, 'base64').toString('utf8');
    return stripQuotedContent(raw);
  }
  // Prefer text/plain part; fall back to other parts
  const parts: any[] = payload.parts || [];
  const plainPart = parts.find((p: any) => p.mimeType === 'text/plain');
  if (plainPart) {
    const t = extractText(plainPart);
    if (t) return t;
  }
  for (const p of parts) {
    const t = extractText(p);
    if (t) return t;
  }
  return '';
}

/**
 * Strip quoted reply content from a plain-text email body so only the new
 * message text is shown in the conversation UI.
 *
 * Handles the most common quoting styles:
 *  - Outlook/Windows-Mail horizontal rule  (_ _ _ _ …)
 *  - "-----Original Message-----" (classic Outlook)
 *  - Gmail "On <date>, <name> wrote:" header
 *  - Line-by-line quote markers ("> text")
 */
function stripQuotedContent(text: string): string {
  const lines = text.split('\n');
  const cutPatterns = [
    // Outlook underscore separator (8+ underscores, possibly with spaces)
    /^_{8,}\s*$/,
    // Classic Outlook separator
    /^-{5,}\s*original message\s*-{5,}/i,
    // Gmail / Apple Mail "On ... wrote:" — must be its own line or span two lines
    /^on .{10,} wrote:\s*$/i,
    // Forwarded message block
    /^-{3,}\s*forwarded message\s*-{3,}/i,
    // Outlook "From:" at the very start of a quote block (preceded by blank line)
    /^from:\s+.+/i,
  ];

  // Find the first line that matches a quote-start pattern
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // "On <date> <name> wrote:" sometimes wraps across two lines; check combined
    if (i + 1 < lines.length) {
      const combined = (lines[i].trim() + ' ' + lines[i + 1].trim());
      if (/^on .{10,} wrote:\s*$/i.test(combined)) {
        return lines.slice(0, i).join('\n').trim();
      }
    }

    for (const pattern of cutPatterns) {
      if (pattern.test(line)) {
        return lines.slice(0, i).join('\n').trim();
      }
    }

    // Strip leading ">" quote markers (stop at first quoted block)
    if (/^>/.test(line) && i > 0) {
      return lines.slice(0, i).join('\n').trim();
    }
  }

  return text.trim();
}
