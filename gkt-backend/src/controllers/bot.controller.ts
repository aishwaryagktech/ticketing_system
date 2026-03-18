import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { embedQuery, searchKb } from '../services/embedding.service';
import OpenAI from 'openai';
import { env } from '../config/env';
import { Conversation } from '../../mongo/models/conversation.model';
import { getActiveAdapter } from '../ai/provider';
import { getResolutionTimeMins, computeSlaDeadline } from '../services/sla.service';

type SessionMessage = { from: 'user' | 'bot'; text: string; at: number };
type AppLogsCache = {
  raw_text: string;
  error_count: number;
  issue_types: string[];
  loaded: boolean; // true once fetched from Mongo (even if null result)
};
type BotSession = {
  id: string;
  tenant_id: string;
  tenant_product_id: string | null;
  user_id: string | null;
  user_email: string | null;
  exchanges: number;
  messages: SessionMessage[];
  /** Cached FlowPay app logs for this session — loaded once from Mongo */
  appLogs?: AppLogsCache | null;
  /** When true, next "yes" / "create ticket" creates a handoff ticket instead of ending as resolved */
  pendingHandoffOffer?: boolean;
};

const sessions = new Map<string, BotSession>();

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai;
}

async function ragAnswerWithLlm(args: {
  question: string;
  contexts: Array<{ text: string; score: number }>;
  model: string;
  productName?: string | null;
  images?: Array<{ mime_type: string; base64: string }>;
  appLogContext?: string | null;
  isFirstMessage?: boolean;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> {
  const client = getOpenAI();
  if (!client) throw new Error('OPENAI_API_KEY not set');

  const { question, contexts, model, productName, images, appLogContext, isFirstMessage, conversationHistory } = args;

  const kbBlock = contexts
    .slice(0, 4)
    .map((c, i) => `KB CHUNK ${i + 1} (relevance ${c.score.toFixed(3)}):\n${c.text}`)
    .join('\n\n');

  // ── System prompt: LOG-AWARE mode (when we have app diagnostic data) ──────
  let system: string;
  if (appLogContext) {
    // Work out which "act" of the conversation we're on, based on how many
    // assistant messages have been exchanged so far (from prior history).
    const assistantTurns = (conversationHistory || []).filter(m => m.role === 'assistant').length;

    let turnInstruction: string;

    if (isFirstMessage || assistantTurns === 0) {
      // ACT 1 — Acknowledge only. Ask ONE targeted clarifying question. NO resolution yet.
      turnInstruction = [
        'ACT 1 — ACKNOWLEDGE + FIRST CLARIFICATION:',
        '1. Start with "I can see..." and reference what you found in the logs (exact error code, timestamp, transaction ID, what failed, which page/component). Keep this to 2-3 sentences maximum — no resolution steps yet.',
        '2. Then ask EXACTLY ONE targeted clarifying question specific to what you saw in the logs (e.g. "Have you attempted the transaction again since [timestamp]?" or "Is this the only payment method you have on file?").',
        '3. DO NOT give any resolution steps, troubleshooting instructions, or suggestions yet. Just acknowledge + one question. Stop there.',
        '',
      ].join('\n');

    } else if (assistantTurns === 1) {
      // ACT 2 — Process their answer. Ask ONE more clarifying question. Still no resolution.
      turnInstruction = [
        'ACT 2 — SECOND CLARIFICATION:',
        '1. Briefly acknowledge what the user just told you (1 sentence).',
        '2. Ask EXACTLY ONE more clarifying question that digs deeper. Use the log context and their previous answer to ask something specific (e.g. "Did you receive any email confirmation or error notification at the time?" or "Has this happened before, or is this the first time for this transaction type?").',
        '3. Do NOT give any resolution steps or suggestions yet. End with just the question.',
        '',
      ].join('\n');

    } else {
      // ACT 3+ — Full resolution. Bot has enough context now.
      turnInstruction = [
        'ACT 3 — FULL RESOLUTION:',
        'You now have enough context. Provide a complete, specific resolution:',
        '1. Briefly recap what you now know about the issue (1-2 sentences, referencing logs + their answers).',
        '2. Give numbered resolution steps — tailored to their specific situation and error.',
        '3. Reference exact log details (error codes, timestamps, component names) in the steps where relevant.',
        '4. End by asking: "Has this resolved the issue, or would you like me to escalate to a support agent?"',
        '',
      ].join('\n');
    }



    system = [
      `You are a proactive, expert L0 support agent for ${productName || 'the product'}.`,
      '',
      'You have access to the user\'s real-time diagnostic logs captured from their app session immediately before they opened this chat. These logs contain exact error codes, timestamps, transaction IDs, component names, and what failed. USE THEM.',
      '',
      turnInstruction,
      'STRICT RULES FOR ALL TURNS:',
      '- Never dump everything at once. Follow the ACT structure precisely.',
      '- Be specific. Reference exact values from the logs (error codes, txn IDs, timestamps).',
      '- Tone: calm, expert, personal. Like a senior engineer who already read the full trace.',
      '- Never make the user re-explain something you can already see in the logs.',
      '',
      '══ APP DIAGNOSTIC LOGS (user\'s session) ══',
      appLogContext,
      '',
      ...(kbBlock ? ['══ KNOWLEDGE BASE CONTEXT (use in Act 3 resolution only) ══', kbBlock, ''] : []),
      'Now respond to the user\'s message. Follow the ACT instructions above exactly.',
    ].join('\n');



  } else {

    // ── System prompt: KB-only fallback (no logs available) ─────────────────
    system =
      `You are L0 support agent for ${productName || 'the product'}.\n` +
      `Answer the user using the provided KB context. If KB context is insufficient, ask 1-2 clarifying questions.\n` +
      `Be concise, actionable, and avoid copying long passages verbatim.\n` +
      `If you reference steps, format as numbered steps.\n` +
      `End every response with a follow-up question to keep the conversation going.\n`;
  }

  // ── Build the messages array (system + history + current question) ─────────
  const userText = appLogContext
    ? `User message:\n${question}`
    : `User question:\n${question}\n\nKnowledge base context:\n${kbBlock}\n\nWrite the best possible support answer now.`;

  const userContent: any =
    images && images.length > 0
      ? [
          { type: 'text', text: userText },
          ...images
            .filter((im) => im?.base64 && im?.mime_type)
            .slice(0, 3)
            .map((im) => ({
              type: 'image_url',
              image_url: { url: `data:${im.mime_type};base64,${im.base64}` },
            })),
        ]
      : userText;

  // Build the full messages list: system + prior turns (memory) + current
  const priorTurns: Array<{ role: 'user' | 'assistant'; content: string }> =
    Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : [];

  const allMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> = [
    { role: 'system', content: system },
    ...priorTurns,
    { role: 'user', content: userContent },
  ];

  const resp = await Promise.race([
    client.chat.completions.create({ model, messages: allMessages, temperature: 0.3 }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
  ]);

  if (!resp || !('choices' in resp)) throw new Error('LLM call timed out');
  return resp.choices?.[0]?.message?.content?.trim() || 'I could not generate a response.';
}


function newSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Load app_logs from MongoDB Conversation for this bot session ──
async function loadAppLogsForSession(
  tenant_product_id: string,
  session_id: string
): Promise<{ raw_text: string; error_count: number; issue_types: string[] } | null> {
  try {
    const doc = await Conversation.findOne(
      { tenant_product_id, session_id, type: 'bot' },
      { 'app_logs.raw_text': 1, 'app_logs.error_count': 1, 'app_logs.issue_types': 1 }
    ).lean();
    const al = (doc as any)?.app_logs;
    if (!al?.raw_text) return null;
    return {
      raw_text:    String(al.raw_text),
      error_count: Number(al.error_count || 0),
      issue_types: Array.isArray(al.issue_types) ? al.issue_types : [],
    };
  } catch (e) {
    console.warn('[AppLogs] loadAppLogsForSession error (non-fatal):', (e as Error).message);
    return null;
  }
}

// ── Format app_logs into a clean LLM-ready string ──
function buildLogContextString(appLogs: {
  raw_text: string;
  error_count: number;
  issue_types: string[];
}): string {
  const issues = appLogs.issue_types.length > 0 ? appLogs.issue_types.join(', ') : 'unknown';
  return [
    `Detected Issues: ${issues}`,
    `Total Errors in session: ${appLogs.error_count}`,
    '',
    'Full session log (chronological):',
    appLogs.raw_text.slice(0, 6000),
  ].join('\n');
}


function looksLikeHumanRequest(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('human') ||
    t.includes('agent') ||
    t.includes('representative') ||
    t.includes('talk to') ||
    t.includes('call me') ||
    t.includes('handoff')
  );
}

function classifyPriority(text: string): 'p1' | 'p2' | 'p3' | 'p4' {
  const t = text.toLowerCase();
  if (t.includes('urgent') || t.includes('asap') || t.includes('down') || t.includes('blocked') || t.includes('payment failed')) {
    return 'p1';
  }
  if (t.includes('error') || t.includes('cannot') || t.includes("can't") || t.includes('failed')) return 'p2';
  return 'p3';
}

function isYes(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'yes' || t === 'y' || t === 'yeah' || t === 'yep' || t === 'resolved' || t === 'solved';
}

/** User accepting the "create a ticket?" offer (yes/ok/please/create ticket) */
function acceptsHandoffOffer(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === 'yes' || t === 'y' || t === 'yeah' || t === 'yep' ||
    t === 'ok' || t === 'okay' || t === 'please' || t === 'sure' ||
    t === 'create ticket' || t === 'create a ticket' || t === 'raise a ticket' || t === 'raise ticket'
  );
}

/** User signals issue not resolved or wants to escalate (dissatisfaction / still need help) */
function looksLikeNotResolvedOrDissatisfied(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("didn't work") || t.includes('did not work') ||
    t.includes('not working') || t.includes("doesn't work") || t.includes('does not work') ||
    t.includes("won't work") || t.includes('still not') || t.includes('still having') ||
    t.includes('still have the') || t.includes("that didn't help") || t.includes('not helpful') ||
    t.includes('not resolved') || t.includes('no luck') || t.includes("didn't fix") ||
    t.includes('not happy') || t.includes('not satisfied') ||
    t.includes('need a ticket') || t.includes('raise a ticket') || t.includes('raise ticket') ||
    t.includes('create a ticket') || (t.includes('create ticket') && !t.includes("don't")) ||
    t.includes('connect me') || t.includes('transfer to agent') || t.includes('want to talk to agent')
    // NOTE: bare 'no'/'nope' removed — would fire during clarification questions
    // The dissatisfied guard in chat() already requires exchanges >= 2 before this runs
  );
}


async function appendConversationMessage(args: {
  tenant_id: string;
  tenant_product_id: string;
  session_id: string;
  from: 'user' | 'bot';
  text: string;
  user_id?: string | null;
  user_email?: string | null;
  attachments?: Array<{ filename: string; mime_type: string; size_bytes: number; base64: string }>;
  meta?: Partial<{ resolved_by_bot: boolean; turns_count: number; ended_at: Date; handoff_reason: string; handoff_ticket_id: string; model_used: string; kb_articles_used: string[] }>;
}): Promise<void> {
  const { tenant_id, tenant_product_id, session_id, from, text, user_id, user_email, meta, attachments } = args;
  const author_type = from === 'user' ? 'user' : 'bot';
  const author_id = from === 'user' ? (user_id || user_email || 'widget_user') : 'l0_bot';
  const author_name = from === 'user' ? (user_email || 'User') : 'L0 Bot';

  const messageDoc = {
    message_id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    author_type,
    author_id,
    author_name,
    body: text,
    is_internal: false,
    attachments: Array.isArray(attachments) ? attachments : [],
    created_at: new Date(),
  };

  const set: any = { updated_at: new Date() };
  if (meta) {
    set.bot_session = {
      ...(meta.resolved_by_bot !== undefined ? { resolved_by_bot: meta.resolved_by_bot } : {}),
      ...(meta.turns_count !== undefined ? { turns_count: meta.turns_count } : {}),
      ...(meta.handoff_reason ? { handoff_reason: meta.handoff_reason } : {}),
      ...(meta.handoff_ticket_id ? { handoff_ticket_id: meta.handoff_ticket_id } : {}),
      ...(meta.model_used ? { model_used: meta.model_used } : {}),
      ...(meta.kb_articles_used ? { kb_articles_used: meta.kb_articles_used } : {}),
      ...(meta.ended_at ? { ended_at: meta.ended_at } : {}),
    };
  }

  await Conversation.updateOne(
    {
      tenant_product_id,
      type: 'bot',
      ...(session_id ? { session_id } : {}),
    },
    {
      $setOnInsert: {
        tenant_product_id,
        tenant_id,
        session_id,
        type: 'bot',
        created_at: new Date(),
      },
      $set: set,
      $push: { messages: messageDoc },
    },
    {
      upsert: true,
      // Be tolerant to schema evolution; ignore unknown fields in filter when upserting.
      strict: false,
    }
  );
}

// ── Fetch FlowPay app logs for a user/session and attach to the Mongo Conversation ──
async function fetchAndAttachAppLogs(args: {
  tenant_product_id: string;
  session_id: string;
  user_id: string;
  app_session_id?: string | null;
}): Promise<void> {
  const { tenant_product_id, session_id, user_id, app_session_id } = args;
  const logServerUrl = process.env.APP_LOG_SERVER_URL || 'http://localhost:4000';
  const url = `${logServerUrl}/logs/${encodeURIComponent(user_id)}` +
    (app_session_id ? `?session_id=${encodeURIComponent(app_session_id)}` : '');

  let rawText = '';
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return;
    rawText = await resp.text();
  } catch {
    return; // logger server not running — skip silently
  }

  if (!rawText.trim() || rawText === 'No logs yet.' || rawText === 'No logs for this user.') return;

  // Parse key signals from the plain-text log
  const errorCount  = (rawText.match(/\[ERROR\s*\]/g) || []).length;
  const issueMatches = [...rawText.matchAll(/ISSUE\s*:\s*(\S+)/g)].map(m => m[1]);
  const uniqueIssues = [...new Set(issueMatches)].filter(i => i !== 'n/a');

  const capped = rawText.slice(0, 50_000); // cap at 50 KB

  // 1. Store structured app_logs metadata on the Conversation document
  await Conversation.updateOne(
    { tenant_product_id, session_id, type: 'bot' },
    {
      $set: {
        app_logs: {
          fetched_at:  new Date(),
          user_id,
          session_id:  app_session_id || null,
          raw_text:    capped,
          error_count: errorCount,
          issue_types: uniqueIssues,
        },
        updated_at: new Date(),
      },
    },
    { upsert: true, strict: false }
  );

  // 2. Inject the logs as a prepended internal system message so the AI sees them naturally
  const systemMsg = {
    message_id:  `syslog_${Date.now()}`,
    author_type: 'system',
    author_id:   'flowpay_logger',
    author_name: 'FlowPay Logger',
    body:
      `[SYSTEM CONTEXT — FlowPay App Logs]\n` +
      `User: ${user_id}${app_session_id ? ` | Session: ${app_session_id}` : ''}\n` +
      `Errors: ${errorCount} | Issues: ${uniqueIssues.join(', ') || 'none'}\n\n` +
      rawText.slice(0, 8_000),
    is_internal:  true,
    attachments:  [],
    created_at:   new Date(),
  };

  await Conversation.updateOne(
    { tenant_product_id, session_id, type: 'bot' },
    { $push: { messages: { $each: [systemMsg], $position: 0 } } }
  );

  console.log(`[FlowPayLogger] Attached ${errorCount} errors, issues=[${uniqueIssues}] to conversation ${session_id}`);
}

async function createHandoffTicket(args: {
  tenant_id: string;
  user_email: string | null;
  subject: string;
  description: string;
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  session: BotSession;
}): Promise<{ ticket_id: string; ticket_number: string }> {
  const { tenant_id, user_email, subject, description, priority, session } = args;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenant_id }, select: { id: true, product_id: true } });
  if (!tenant) throw new Error('Tenant not found');

  const ticketNumber =
    'TKT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

  const transcript = session.messages
    .map((m) => `${m.from === 'user' ? 'User' : 'Bot'}: ${m.text}`)
    .join('\n');
  const textForAi = `${subject}\n\n${description}\n\n${transcript}`;

  let category: string | null = null;
  let subCategory: string | null = null;
  let aiPriority: string | null = null;
  let department: string | null = null;
  let aiConfidence: number | null = null;
  let sentiment: string | null = null;
  let sentimentTrend: string | null = null;

  try {
    const adapter = await getActiveAdapter(tenant.product_id);
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
    console.warn('createHandoffTicket: AI enrichment failed (continuing):', (aiErr as Error).message);
  }

  const normalizedPriority = (function () {
    const fromAi = aiPriority;
    const val = fromAi || priority;
    if (val === 'p1' || val === 'p2' || val === 'p3' || val === 'p4') return val;
    return priority;
  })();

  let slaDeadline: Date | null = null;
  try {
    const resolutionMins = await getResolutionTimeMins(
      tenant.product_id,
      session.tenant_product_id,
      normalizedPriority
    );
    if (resolutionMins != null && resolutionMins > 0) {
      slaDeadline = computeSlaDeadline(new Date(), resolutionMins);
    }
  } catch (slaErr) {
    console.warn('createHandoffTicket: SLA policy lookup failed (continuing without SLA):', (slaErr as Error).message);
  }

  const ticket = await prisma.ticket.create({
    data: {
      ticket_number: ticketNumber,
      product_id: tenant.product_id,
      tenant_id: tenant.id,
      tenant_product_id: session.tenant_product_id,
      created_by: user_email ?? 'widget',
      subject,
      description: `${description}\n\n---\nChat transcript\n---\n${transcript}`.slice(0, 20000),
      status: 'new_ticket',
      priority: normalizedPriority,
      source: 'bot_handoff',
      user_type: 'tenant_user',
      escalation_level: 1,
      session_id: session.id,
      category: category,
      sub_category: subCategory,
      department: department,
      ai_confidence: aiConfidence,
      sentiment: sentiment as any,
      sentiment_trend: sentimentTrend,
      sla_deadline: slaDeadline,
    },
  });

  await prisma.ticketComment.create({
    data: {
      ticket_id: ticket.id,
      product_id: ticket.product_id,
      author_id: session.user_id ?? 'bot',
      body: `L0 bot handoff created ticket.\n\nReason: bot unable to resolve (or user requested human).`,
      is_internal: true,
      is_bot: true,
    },
  });

  // Link the existing bot Conversation (L0 messages) to this ticket so widget + agent load full thread from Mongo
  if (session.tenant_product_id && session.id) {
    await Conversation.updateOne(
      { tenant_product_id: session.tenant_product_id, session_id: session.id, type: 'bot' },
      {
        $set: {
          ticket_id: ticket.id,
          updated_at: new Date(),
          'bot_session.handoff_ticket_id': ticket.id,
          'bot_session.handoff_reason': 'handoff',
        },
      }
    ).catch((e) => console.warn('createHandoffTicket: link Conversation to ticket failed', (e as Error).message));
  }

  return { ticket_id: ticket.id, ticket_number: ticket.ticket_number };
}

const DEFAULT_WELCOME = 'Hi! How can I help you today?';

// GET /api/bot/welcome-message?tenant_id=...&tenant_product_id=...
export async function welcomeMessage(req: Request, res: Response): Promise<void> {
  const tenant_id = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : '';
  const tenant_product_id = typeof req.query.tenant_product_id === 'string' ? req.query.tenant_product_id.trim() : '';
  if (!tenant_product_id) {
    res.json({ message: DEFAULT_WELCOME });
    return;
  }
  try {
    const tp = await prisma.tenantProduct.findFirst({
      where: { id: tenant_product_id, ...(tenant_id ? { tenant_id } : {}) },
      select: { id: true, name: true, l0_provider: true, l0_model: true },
    });
    if (!tp) {
      res.json({ message: DEFAULT_WELCOME });
      return;
    }

    const client = getOpenAI();
    if (!client) {
      res.json({ message: DEFAULT_WELCOME });
      return;
    }

    // Try to load KB sources to enrich the welcome message
    const sources = await prisma.kbSource.findMany({
      where: { tenant_product_id, status: 'extracted' },
      select: { title: true, content_text: true },
      orderBy: { updated_at: 'desc' },
      take: 20,
    });
    const maxChars = 14_000;
    let combined = sources
      .map((s) => {
        const title = (s.title || 'Source').trim();
        const text = (s.content_text || '').trim();
        return title ? `${title}:\n${text}` : text;
      })
      .filter(Boolean)
      .join('\n\n---\n\n');
    if (combined.length > maxChars) combined = combined.slice(0, maxChars) + '\n\n[... truncated]';

    const model = tp.l0_model || 'gpt-4o-mini';

    const system =
      'You are writing ONLY the very first opening message for a support chat widget. Your reply will be shown as the bot\'s greeting. ' +
      'The product team will render this text directly in the UI, so you MUST follow the exact output format and avoid extra prose.';

    const userPrompt = combined.trim()
      ? `Product/context: ${tp.name || 'Support'}\n\n` +
      `Using the knowledge base content below, write a welcome message that is STRICTLY a list of issues a user might face.\n` +
      `OUTPUT FORMAT (must follow exactly):\n` +
      `- First line: a very short greeting sentence (max 15 words).\n` +
      `- Next lines: 5–8 bullet points, each starting with "• " and describing a type of issue or topic you can help with (e.g. "• Login or account access", "• Payments, billing & invoices").\n` +
      `- Do NOT add any questions like "Did this solve it?" or instructions like "reply yes" etc.\n` +
      `- Do NOT add any extra sentences before or after the bullet list.\n` +
      `- Do NOT use numbered lists, markdown code blocks, or section headings.\n\n` +
      `Knowledge base content (for inspiration only – do not copy verbatim):\n\n${combined}`
      : `Product/context: ${tp.name || 'Support'}\n\n` +
      `Write a welcome message for a support chat widget that is STRICTLY a list of issues a user might face.\n` +
      `OUTPUT FORMAT (must follow exactly):\n` +
      `- First line: a very short greeting sentence (max 15 words).\n` +
      `- Next lines: 5–8 bullet points, each starting with "• " and describing a type of issue or topic you can help with (e.g. "• Login or account access", "• Payments, billing & invoices").\n` +
      `- Do NOT add any questions like "Did this solve it?" or instructions like "reply yes" etc.\n` +
      `- Do NOT add any extra sentences before or after the bullet list.\n` +
      `- Do NOT use numbered lists, markdown code blocks, or section headings.`;

    const timeoutMs = 12000;
    const resp = await Promise.race([
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 400,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    const message =
      resp && 'choices' in resp
        ? resp.choices?.[0]?.message?.content?.trim() || DEFAULT_WELCOME
        : DEFAULT_WELCOME;
    res.json({ message });
  } catch (e) {
    console.error('welcomeMessage error:', e);
    res.json({ message: DEFAULT_WELCOME });
  }
}

// POST /api/bot/chat
export async function chat(req: Request, res: Response): Promise<void> {
  const body = (req.body as any) || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const tenant_id = typeof body.tenant_id === 'string' ? body.tenant_id : '';
  const tenant_product_id = typeof body.tenant_product_id === 'string' ? body.tenant_product_id : null;
  const session_id_in = typeof body.session_id === 'string' && body.session_id ? body.session_id : null;
  const user_id = typeof body.user_id === 'string' ? body.user_id : null;
  const user_email = typeof body.user_email === 'string' ? body.user_email : null;
  // app_session_id = the FlowPay session ID (e.g. sess_a3f9) sent by the widget
  const app_session_id = typeof body.app_session_id === 'string' && body.app_session_id ? body.app_session_id : null;
  const attachmentsRaw = Array.isArray(body.attachments) ? body.attachments : [];
  const attachments = attachmentsRaw
    .map((a: any) => ({
      filename: String(a?.filename || 'image'),
      mime_type: String(a?.mime_type || ''),
      size_bytes: Number(a?.size_bytes || 0),
      base64: String(a?.base64 || ''),
    }))
    .filter((a: any) => a.mime_type.startsWith('image/') && a.base64 && a.base64.length > 20)
    .slice(0, 3);

  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }
  if (!tenant_product_id) {
    res.status(400).json({ error: 'tenant_product_id required' });
    return;
  }
  if (!message) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  const sessionId = session_id_in ?? newSessionId();
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      tenant_id,
      tenant_product_id,
      user_id,
      user_email,
      exchanges: 0,
      messages: [],
    };
    sessions.set(sessionId, session);

    // Brand-new session: fire-and-forget log fetch from FlowPay logger server
    if (tenant_product_id && (user_id || app_session_id)) {
      fetchAndAttachAppLogs({
        tenant_product_id,
        session_id: sessionId,
        user_id: user_id || app_session_id || 'unknown',
        app_session_id,
      }).catch(e => console.warn('[FlowPayLogger] fetchAndAttachAppLogs failed (non-fatal):', (e as Error).message));
    }
  }

  // ── Load app_logs from Mongo into session cache (once, then reused) ────────
  // We load AFTER the session is created/retrieved since fetchAndAttachAppLogs
  // runs async — on first message it may not be ready yet, but on subsequent
  // messages it will be. Use a small grace window for the first message.
  if (tenant_product_id && !session.appLogs) {
    // Give fetchAndAttachAppLogs a moment to write on first message
    if (session.exchanges === 0) await new Promise(r => setTimeout(r, 800));
    const loaded = await loadAppLogsForSession(tenant_product_id, sessionId);
    session.appLogs = loaded
      ? { ...loaded, loaded: true }
      : { raw_text: '', error_count: 0, issue_types: [], loaded: true };
    if (loaded) {
      console.log(`[AppLogs] Loaded for session ${sessionId}: ${loaded.issue_types} (${loaded.error_count} errors)`);
    }
  }

  session.messages.push({ from: 'user', text: message, at: Date.now() });
  appendConversationMessage({
    tenant_id,
    tenant_product_id,
    session_id: sessionId,
    from: 'user',
    text: message,
    user_id,
    user_email,
    attachments,
  }).catch((e) => console.error('bot conversation append(user) error:', e));

  // User previously got "Would you like me to create a ticket?" and now accepts → create handoff
  if (session.pendingHandoffOffer && acceptsHandoffOffer(message)) {
    session.pendingHandoffOffer = false;
    const lastUser = [...session.messages].reverse().find((m) => m.from === 'user')?.text || message;
    const t = await createHandoffTicket({
      tenant_id,
      user_email,
      subject: 'Support request (from chatbot)',
      description: lastUser,
      priority: classifyPriority(lastUser),
      session,
    });
    const reply = `I've created a ticket for you. A support agent will follow up.\n\nTicket: ${t.ticket_number}`;
    session.messages.push({ from: 'bot', text: reply, at: Date.now() });
    appendConversationMessage({
      tenant_id,
      tenant_product_id,
      session_id: sessionId,
      from: 'bot',
      text: reply,
      meta: { handoff_reason: 'user_accepted_offer', handoff_ticket_id: t.ticket_id, turns_count: session.exchanges },
    }).catch((e) => console.error('bot conversation append(bot handoff) error:', e));
    sessions.delete(sessionId);
    res.json({ reply, session_id: sessionId, handoff: t });
    return;
  }
  session.pendingHandoffOffer = false; // clear on any other message

  // If user confirms resolved (and we didn't just offer handoff), end the session.
  // Guard: only treat "yes" as "resolved" after ACT 3 has been delivered (exchanges >= 2).
  if (session.exchanges >= 2 && isYes(message)) {
    const replyYes = `Great — happy to help. If you need anything else, just message here anytime.`;
    session.messages.push({ from: 'bot', text: replyYes, at: Date.now() });
    appendConversationMessage({
      tenant_id,
      tenant_product_id,
      session_id: sessionId,
      from: 'bot',
      text: replyYes,
      meta: { resolved_by_bot: true, turns_count: session.exchanges, ended_at: new Date() },
    }).catch((e) => console.error('bot conversation append(bot yes) error:', e));
    sessions.delete(sessionId);
    res.json({ reply: replyYes, session_id: sessionId, ended: true });
    return;
  }

  // User says issue not resolved / not happy → offer to create a ticket.
  // Guard: only trigger after ACT 3 (exchanges >= 2) — before that, the user is
  // answering a clarification question, not reacting to a resolution.
  if (session.exchanges >= 2 && looksLikeNotResolvedOrDissatisfied(message)) {
    const offerReply =
      `I'm sorry that didn't resolve your issue.\n\n` +
      `Would you like me to create a ticket so a support agent can help? Reply **yes** to create a ticket, or ask me something else.`;
    session.messages.push({ from: 'bot', text: offerReply, at: Date.now() });
    appendConversationMessage({
      tenant_id,
      tenant_product_id,
      session_id: sessionId,
      from: 'bot',
      text: offerReply,
      meta: { turns_count: session.exchanges },
    }).catch((e) => console.error('bot conversation append(bot offer) error:', e));
    session.exchanges += 1;
    session.pendingHandoffOffer = true;
    res.json({ reply: offerReply, session_id: sessionId });
    return;
  }

  // L0 → L1 trigger: explicit human request (create ticket immediately)
  if (looksLikeHumanRequest(message)) {
    const t = await createHandoffTicket({
      tenant_id,
      user_email,
      subject: 'Support request (from chatbot)',
      description: message,
      priority: classifyPriority(message),
      session,
    });
    const reply = `No problem — I’m creating a ticket for a support agent now.\n\nTicket: ${t.ticket_number}`;
    session.messages.push({ from: 'bot', text: reply, at: Date.now() });
    appendConversationMessage({
      tenant_id,
      tenant_product_id,
      session_id: sessionId,
      from: 'bot',
      text: reply,
      meta: { handoff_reason: 'user_requested_human', handoff_ticket_id: t.ticket_id, turns_count: session.exchanges },
    }).catch((e) => console.error('bot conversation append(bot handoff) error:', e));
    res.json({ reply, session_id: sessionId, handoff: t });
    return;
  }

  // ── Build shared context for LLM calls ────────────────────────────────────
  const appLogContext = session.appLogs?.raw_text
    ? buildLogContextString(session.appLogs)
    : null;

  const conversationHistory = session.messages
    .slice(-8)  // last 8 messages = 4 turns of memory
    .map(m => ({ role: (m.from === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text }));

  const isFirstMessage = session.exchanges === 0;

  // ── KB-backed + log-aware response via Qdrant ──────────────────────────────
  let reply = '';
  try {
    const q = await embedQuery(message);
    const hits = await searchKb(q, { limit: 5, tenant_product_id });
    const top = hits[0];
    const kbOk = top && top.score >= 0.25;

    // We call the LLM if KB matched OR we have log context (log-only answer)
    const hasLlmContext = kbOk || !!appLogContext;

    if (hasLlmContext) {
      const tp = await prisma.tenantProduct.findUnique({
        where: { id: tenant_product_id },
        select: { id: true, name: true, l0_provider: true, l0_model: true },
      });

      const provider = (tp?.l0_provider || 'openai').toLowerCase();
      const model = tp?.l0_model || 'gpt-4o-mini';

      if (provider !== 'openai') {
        console.warn(`bot chat: l0_provider=${provider} not implemented yet; falling back to OpenAI`);
      }

      const contexts = kbOk
        ? hits
            .map((h) => ({ text: String((h.payload as any)?.text || ''), score: Number(h.score || 0) }))
            .filter((c) => c.text.trim().length > 0)
        : []; // empty KB contexts — log-only answer

      reply = await ragAnswerWithLlm({
        question: message,
        contexts,
        model,
        productName: tp?.name,
        images: attachments.map((a: { mime_type: string; base64: string }) => ({ mime_type: a.mime_type, base64: a.base64 })),
        appLogContext,
        isFirstMessage,
        conversationHistory,
      });
      appendConversationMessage({
        tenant_id,
        tenant_product_id,
        session_id: sessionId,
        from: 'bot',
        text: reply,
        meta: { model_used: model, turns_count: session.exchanges },
      }).catch((e) => console.error('bot conversation append(bot) error:', e));

    } else {
      // No KB match AND no logs — last resort: ask for more info or offer ticket
      reply =
        `I couldn't find a specific answer in the knowledge base for that.\n\n` +
        `Could you share a bit more detail — for example, the exact error message or where you're seeing this? ` +
        `Or if you'd prefer, I can create a ticket and a support agent will follow up. Reply **yes** to create a ticket.`;
      session.pendingHandoffOffer = true;
      appendConversationMessage({
        tenant_id,
        tenant_product_id,
        session_id: sessionId,
        from: 'bot',
        text: reply,
        meta: { turns_count: session.exchanges },
      }).catch((e) => console.error('bot conversation append(bot) error:', e));
    }
  } catch (e: any) {
    console.error('bot chat error:', e);
    const code = String(e?.code || e?.error?.code || '');
    const status = Number(e?.status || e?.response?.status || 0);
    const messageText = String(e?.message || '');
    const invalidKey =
      status === 401 ||
      code === 'invalid_api_key' ||
      messageText.toLowerCase().includes('incorrect api key') ||
      messageText.toLowerCase().includes('invalid api key');

    reply = invalidKey
      ? `I’m online, but my AI key is not configured correctly, so I can’t search the knowledge base right now.\n\n` +
      `An admin needs to set a valid OPENAI_API_KEY for the backend.\n\n` +
      `Reply "human" and I’ll create a ticket instead.`
      : `I hit an issue looking up the knowledge base right now.\n\n` +
      `Reply "human" and I’ll create a ticket, or try again in a moment.`;
    appendConversationMessage({
      tenant_id,
      tenant_product_id,
      session_id: sessionId,
      from: 'bot',
      text: reply,
      meta: { turns_count: session.exchanges },
    }).catch((e2) => console.error('bot conversation append(bot err) error:', e2));
  }

  session.exchanges += 1;
  session.messages.push({ from: 'bot', text: reply, at: Date.now() });

  res.json({ reply, session_id: sessionId });
}

// POST /api/bot/voice-token
// Creates an OpenAI Realtime ephemeral token with KB context as system instructions.
export async function getVoiceToken(req: Request, res: Response): Promise<void> {
  const { tenant_id, tenant_product_id, user_email } = (req.body as any) || {};

  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }
  if (!env.OPENAI_API_KEY) {
    res.status(503).json({ error: 'OpenAI not configured' });
    return;
  }

  let kbContext = '';
  let productName = 'Support';

  try {
    if (tenant_product_id) {
      const tp = await prisma.tenantProduct.findUnique({
        where: { id: tenant_product_id },
        select: { name: true },
      });
      productName = tp?.name || 'Support';

      const q = await embedQuery('support help account access issues troubleshoot');
      const hits = await searchKb(q, { limit: 6, tenant_product_id });
      kbContext = hits
        .filter((h) => h.score >= 0.1)
        .map((h) => String(h.payload?.text || ''))
        .filter(Boolean)
        .join('\n\n---\n\n')
        .slice(0, 4000);
    }
  } catch (e) {
    console.warn('getVoiceToken: KB fetch failed', e);
  }

  let displayName = '';
  if (user_email) {
    const local = String(user_email).split('@')[0] || '';
    const first = local.split('.')[0] || local.split('_')[0] || local;
    displayName = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  const welcomeText = displayName
    ? `Hi ${displayName}! How can I help you today?`
    : 'Hi! How can I help you today?';

  const instructions =
    `You are a voice support agent for ${productName}. ` +
    `Speak naturally and concisely — this is a voice conversation, keep answers brief. ` +
    `Answer ONLY from the knowledge base below. ` +
    `Do not use markdown formatting, bullet points or numbered lists in speech — speak in natural sentences.\n\n` +
    `TICKET ESCALATION RULES (important):\n` +
    `- If the user explicitly asks to raise a ticket, create a ticket, or talk to a human agent, immediately call raise_support_ticket.\n` +
    `- If you have tried to help but cannot find a satisfactory answer in the knowledge base after 1-2 exchanges, say "I'm not able to fully resolve this from my knowledge base. Would you like me to raise a support ticket for you?" — if the user agrees, call raise_support_ticket.\n` +
    `- If the user expresses frustration or says the answer didn't help, offer to raise a ticket and call raise_support_ticket if they agree.\n` +
    `- When calling raise_support_ticket, provide a clear, concise summary of the user's issue as the issue_summary.\n\n` +
    (kbContext
      ? `Knowledge base:\n${kbContext}`
      : 'Answer questions about the product and direct users to contact support if needed.');

  const raiseTicketTool = {
    type: 'function',
    name: 'raise_support_ticket',
    description:
      'Create a support ticket when the user asks to talk to a human, raise a ticket, or when you cannot resolve their issue from the knowledge base. Call this as soon as the user agrees or requests escalation.',
    parameters: {
      type: 'object',
      properties: {
        issue_summary: {
          type: 'string',
          description: "A short, clear summary of the user's issue (used as the ticket subject)",
        },
      },
      required: ['issue_summary'],
    },
  };

  try {
    const sessionRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        instructions,
        turn_detection: { type: 'server_vad', silence_duration_ms: 700 },
        input_audio_transcription: { model: 'whisper-1' },
        tools: [raiseTicketTool],
        tool_choice: 'auto',
      }),
    });

    if (!sessionRes.ok) {
      const errData = await sessionRes.json().catch(() => ({}));
      res
        .status(sessionRes.status)
        .json({ error: (errData as any)?.error?.message || 'Failed to create voice session' });
      return;
    }

    const sessionData = (await sessionRes.json()) as { client_secret: unknown };
    res.json({ client_secret: sessionData.client_secret, welcome_text: welcomeText });
  } catch (e: any) {
    console.error('getVoiceToken error:', e);
    res.status(500).json({ error: 'Failed to create voice session' });
  }
}

// POST /api/bot/voice-handoff
// Called by the frontend when the Realtime LLM invokes raise_support_ticket tool.
export async function voiceHandoff(req: Request, res: Response): Promise<void> {
  const body = (req.body as any) || {};
  const tenant_id = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : '';
  const tenant_product_id = typeof body.tenant_product_id === 'string' ? body.tenant_product_id.trim() : null;
  const user_email = typeof body.user_email === 'string' ? body.user_email.trim() : null;
  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : null;
  const issue_summary = typeof body.issue_summary === 'string' ? body.issue_summary.trim() : 'Support request from voice agent';
  const conversation_text = typeof body.conversation_text === 'string' ? body.conversation_text.trim() : '';

  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenant_id }, select: { id: true, product_id: true } });
    if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }

    // Resolve user
    let resolvedUserId: string | null = user_id;
    if (!resolvedUserId && user_email) {
      const u = await prisma.user.findFirst({ where: { email: user_email }, select: { id: true } });
      resolvedUserId = u?.id ?? null;
    }

    const ticketNumber =
      'TKT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

    const subject = issue_summary.slice(0, 200);
    const description = conversation_text
      ? `Voice conversation transcript:\n\n${conversation_text}\n\n---\nIssue summary: ${subject}`
      : `Issue raised via voice agent: ${subject}`;

    // AI enrichment (best-effort)
    let category: string | null = null;
    let subCategory: string | null = null;
    let aiPriority: 'p1' | 'p2' | 'p3' | 'p4' = 'p3';
    let department: string | null = null;
    let aiConfidence: number | null = null;
    let sentiment: string | null = null;
    let sentimentTrend: string | null = null;

    try {
      const adapter = await getActiveAdapter(tenant.product_id);
      const [cls, snt] = await Promise.all([adapter.classify(subject), adapter.detectSentiment(subject)]);
      category = cls.category || null;
      subCategory = cls.sub_category || null;
      const rawPriority = (cls.priority || '').toLowerCase();
      if (rawPriority === 'p1' || rawPriority === 'p2' || rawPriority === 'p3' || rawPriority === 'p4') aiPriority = rawPriority;
      aiConfidence = typeof cls.confidence === 'number' ? cls.confidence : null;
      const catLower = (category || '').toLowerCase();
      if (catLower === 'technical') department = 'Engineering';
      else if (catLower === 'billing') department = 'Finance';
      sentiment = (snt.sentiment || '').toLowerCase() || null;
      sentimentTrend = snt.trend || null;
    } catch { /* enrichment optional */ }

    let slaDeadline: Date | null = null;
    try {
      const resolutionMins = await getResolutionTimeMins(tenant.product_id, tenant_product_id || null, aiPriority);
      if (resolutionMins != null && resolutionMins > 0) slaDeadline = computeSlaDeadline(new Date(), resolutionMins);
    } catch { /* optional */ }

    const ticket = await prisma.ticket.create({
      data: {
        ticket_number: ticketNumber,
        subject,
        description: description.slice(0, 20000),
        status: 'new_ticket',
        priority: aiPriority,
        source: 'bot_handoff',
        user_type: 'tenant_user',
        escalation_level: 1,
        product_id: tenant.product_id,
        tenant_id,
        tenant_product_id: tenant_product_id || null,
        created_by: user_email ?? resolvedUserId ?? 'widget',
        category,
        sub_category: subCategory,
        department,
        ai_confidence: aiConfidence,
        sentiment: sentiment as any,
        sentiment_trend: sentimentTrend,
        sla_deadline: slaDeadline,
      },
    });

    res.json({ ticket_id: ticket.id, ticket_number: ticket.ticket_number });
  } catch (e: any) {
    console.error('voiceHandoff error:', e);
    res.status(500).json({ error: 'Failed to create voice ticket' });
  }
}

// POST /api/bot/handoff
export async function handoff(req: Request, res: Response): Promise<void> {
  const body = (req.body as any) || {};
  const session_id = typeof body.session_id === 'string' ? body.session_id : '';
  const session = session_id ? sessions.get(session_id) : null;
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  try {
    const lastUser = [...session.messages].reverse().find((m) => m.from === 'user')?.text || 'Support request';
    const t = await createHandoffTicket({
      tenant_id: session.tenant_id,
      user_email: session.user_email,
      subject: 'Support request (from chatbot)',
      description: lastUser,
      priority: classifyPriority(lastUser),
      session,
    });
    Conversation.updateOne(
      { tenant_product_id: session.tenant_product_id || '', session_id: session.id, type: 'bot' },
      { $set: { ticket_id: t.ticket_id, updated_at: new Date(), 'bot_session.handoff_ticket_id': t.ticket_id, 'bot_session.handoff_reason': 'manual_button' } }
    ).catch(() => { });
    res.json({ message: 'handoff created', session_id: session.id, handoff: t });
  } catch (e) {
    console.error('handoff error:', e);
    res.status(500).json({ error: 'Failed to handoff' });
  }
}

// GET /api/bot/conversation?tenant_id=&tenant_product_id=&session_id=
export async function getBotConversation(req: Request, res: Response): Promise<void> {
  const tenant_id = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : '';
  const tenant_product_id = typeof req.query.tenant_product_id === 'string' ? req.query.tenant_product_id.trim() : '';
  const session_id = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : '';

  if (!tenant_id || !session_id) {
    res.status(400).json({ error: 'tenant_id and session_id required' });
    return;
  }

  try {
    const filter: Record<string, string> = { type: 'bot', session_id };
    if (tenant_product_id) filter.tenant_product_id = tenant_product_id;

    const convo = await Conversation.findOne(filter, { messages: 1 }).lean();

    if (!convo || !Array.isArray((convo as any).messages) || (convo as any).messages.length === 0) {
      res.json({ messages: [] });
      return;
    }

    const messages = ((convo as any).messages as any[]).map((m) => ({
      id: String(m.message_id ?? m.id ?? `msg-${Math.random()}`),
      from:
        m.author_type === 'system'
          ? 'system'
          : m.author_type === 'bot'
            ? 'bot'
            : m.author_type === 'user'
              ? 'user'
              : 'agent',
      text: String(m.body ?? ''),
      author_name: m.author_name ?? undefined,
      attachments: Array.isArray(m.attachments)
        ? m.attachments.map((a: any) => ({
            filename: String(a.filename || 'image'),
            mime_type: String(a.mime_type || ''),
            size_bytes: Number(a.size_bytes || 0),
            base64: String(a.base64 || ''),
          }))
        : [],
      created_at: m.created_at ?? new Date(),
    }));

    res.json({ messages });
  } catch (e) {
    console.error('getBotConversation error:', e);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
}

/**
 * POST /api/bot/describe-image
 * Converts an attached image to a text description using GPT-4o vision.
 * Used by the voice agent so the Realtime API (which only accepts text/audio input)
 * can still "see" images the user shares during a voice session.
 */
export async function describeImage(req: Request, res: Response): Promise<void> {
  const { base64, mime_type, context } = (req.body || {}) as {
    base64?: string;
    mime_type?: string;
    context?: string;
  };

  if (!base64 || !mime_type) {
    res.status(400).json({ error: 'base64 and mime_type are required' });
    return;
  }

  const client = getOpenAI();
  if (!client) {
    res.status(503).json({ error: 'OpenAI not configured' });
    return;
  }

  try {
    const prompt =
      context
        ? `${context}\n\nDescribe this image in detail, focusing on anything relevant to a technical support context.`
        : 'Describe this image in detail. Focus on error messages, UI elements, screenshots, or any technical content visible.';

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime_type};base64,${base64}` } },
          ],
        },
      ],
      max_tokens: 400,
    });

    const description =
      completion.choices[0]?.message?.content?.trim() || 'Unable to analyse image.';
    res.json({ description });
  } catch (e: any) {
    console.error('describeImage error:', e);
    res.status(500).json({ error: 'Failed to analyse image' });
  }
}
