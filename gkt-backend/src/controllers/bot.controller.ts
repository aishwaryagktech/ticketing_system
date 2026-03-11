import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { embedQuery, searchKb } from '../services/embedding.service';
import OpenAI from 'openai';
import { env } from '../config/env';
import { Conversation } from '../../mongo/models/conversation.model';
import { getActiveAdapter } from '../ai/provider';

type SessionMessage = { from: 'user' | 'bot'; text: string; at: number };
type BotSession = {
  id: string;
  tenant_id: string;
  tenant_product_id: string | null;
  user_id: string | null;
  user_email: string | null;
  exchanges: number;
  messages: SessionMessage[];
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
}): Promise<string> {
  const client = getOpenAI();
  if (!client) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const { question, contexts, model, productName } = args;
  const contextBlock = contexts
    .slice(0, 4)
    .map((c, i) => `KB CHUNK ${i + 1} (relevance ${c.score.toFixed(3)}):\n${c.text}`)
    .join('\n\n');

  const system =
    `You are L0 support agent for ${productName || 'the product'}.\n` +
    `Answer the user using ONLY the provided KB context. If the KB context is insufficient, ask 1-2 clarifying questions.\n` +
    `Be concise, actionable, and avoid copying long passages verbatim.\n` +
    `If you reference steps, format as numbered steps.\n`;

  const user =
    `User question:\n${question}\n\n` +
    `Knowledge base context:\n${contextBlock}\n\n` +
    `Write the best possible support answer now.`;

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
  });

  return resp.choices?.[0]?.message?.content?.trim() || 'I could not generate a response.';
}

function newSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

async function appendConversationMessage(args: {
  tenant_id: string;
  tenant_product_id: string;
  session_id: string;
  from: 'user' | 'bot';
  text: string;
  user_id?: string | null;
  user_email?: string | null;
  meta?: Partial<{ resolved_by_bot: boolean; turns_count: number; ended_at: Date; handoff_reason: string; handoff_ticket_id: string; model_used: string; kb_articles_used: string[] }>;
}): Promise<void> {
  const { tenant_id, tenant_product_id, session_id, from, text, user_id, user_email, meta } = args;
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

  return { ticket_id: ticket.id, ticket_number: ticket.ticket_number };
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
  }).catch((e) => console.error('bot conversation append(user) error:', e));

  // If user confirms resolved, end the session.
  if (isYes(message)) {
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

  // L0 → L1 trigger: explicit human request
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

  // KB-backed response via Qdrant (semantic search)
  let reply = '';
  try {
    const q = await embedQuery(message);
    const hits = await searchKb(q, { limit: 5, tenant_product_id });
    const top = hits[0];
    const ok = top && top.score >= 0.25;

    if (ok) {
      const tp = await prisma.tenantProduct.findUnique({
        where: { id: tenant_product_id },
        select: { id: true, name: true, l0_provider: true, l0_model: true },
      });

      const provider = (tp?.l0_provider || 'openai').toLowerCase();
      const model = tp?.l0_model || 'gpt-4o-mini';

      // For now we implement OpenAI chat; other providers can be added later.
      if (provider !== 'openai') {
        console.warn(`bot chat: l0_provider=${provider} not implemented yet; falling back to OpenAI`);
      }

      const contexts = hits
        .map((h) => ({
          text: String((h.payload as any)?.text || ''),
          score: Number(h.score || 0),
        }))
        .filter((c) => c.text.trim().length > 0);

      reply = await ragAnswerWithLlm({
        question: message,
        contexts,
        model,
        productName: tp?.name,
      });

      reply += `\n\nDid this solve it? Reply \"yes\" or tell me what didn’t work.`;
      appendConversationMessage({
        tenant_id,
        tenant_product_id,
        session_id: sessionId,
        from: 'bot',
        text: reply,
        meta: { model_used: model, turns_count: session.exchanges },
      }).catch((e) => console.error('bot conversation append(bot) error:', e));
    } else {
      reply =
        `I’m not fully sure based on the knowledge base.\n\n` +
        `Can you share one more detail (exact error text / where you see it / what you expected)?\n` +
        `If you prefer, reply \"human\" and I’ll raise a ticket.`;
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

  // L0 → L1 trigger: bot unable to resolve within 3 exchanges
  if (session.exchanges >= 3) {
    const t = await createHandoffTicket({
      tenant_id,
      user_email,
      subject: 'Support request (from chatbot)',
      description: message,
      priority: classifyPriority(message),
      session,
    });
    const handoffReply =
      `${reply}\n\n` +
      `I’m going to bring in a human agent to make sure this gets resolved.\n\nTicket: ${t.ticket_number}`;
    session.messages.push({ from: 'bot', text: handoffReply, at: Date.now() });
    appendConversationMessage({
      tenant_id,
      tenant_product_id,
      session_id: sessionId,
      from: 'bot',
      text: handoffReply,
      meta: { handoff_reason: 'three_turns_no_resolution', handoff_ticket_id: t.ticket_id, turns_count: session.exchanges },
    }).catch((e) => console.error('bot conversation append(bot auto handoff) error:', e));
    res.json({ reply: handoffReply, session_id: sessionId, handoff: t });
    return;
  }

  res.json({ reply, session_id: sessionId });
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
    ).catch(() => {});
    res.json({ message: 'handoff created', session_id: session.id, handoff: t });
  } catch (e) {
    console.error('handoff error:', e);
    res.status(500).json({ error: 'Failed to handoff' });
  }
}
