/**
 * bot.controller.ts  — Agentic Flow (Final)
 *
 * Architecture:
 *  - L0 agent: clarifying (2 rounds) → resolution (step by step) → pending_handoff
 *  - L1 agent: picks up from L0 context, clarifying (3 rounds) → resolution → L2 handoff
 *  - L2: human agents via ticket queue
 *
 * Key features:
 *  1. classifyIntent()     — LLM-based intent classifier, replaces all regex guards
 *  2. buildSystemPrompt()  — phase-aware prompt, changes every turn
 *  3. Phase state machine  — clarifying → resolution → pending_handoff
 *  4. L0→L1 context chain — L1 inherits ticket + history, user never repeats
 *  5. channel-aware handoff — email vs chat mode via getHumanSupportChannel()
 *  6. No auto-escalation from resolution — always asks user first
 */

import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { embedQuery, searchKb } from '../services/embedding.service';
import OpenAI from 'openai';
import { env } from '../config/env';
import { Conversation } from '../../mongo/models/conversation.model';
import { getActiveAdapter } from '../ai/provider';
import { getResolutionTimeMins, computeSlaDeadline } from '../services/sla.service';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

type SessionMessage = { from: 'user' | 'bot'; text: string; at: number };

type AppLogsCache = {
  raw_text: string;
  error_count: number;
  issue_types: string[];
  loaded: boolean;
};

type ConversationPhase = 'clarifying' | 'resolution' | 'pending_handoff';

type BotSession = {
  id: string;
  tenant_id: string;
  tenant_product_id: string | null;
  user_id: string | null;
  user_email: string | null;
  exchanges: number;
  messages: SessionMessage[];
  appLogs?: AppLogsCache | null;
  ticket_id?: string;
  ticket_number?: string;
  phase: ConversationPhase;
  clarifyingRound: number;
  resolutionDelivered: boolean;
  pendingHandoffOffer: boolean;
  l0Summary?: string | null;
  resolutionStep: number;
  resolutionSubState: 'guiding' | 'final_check';
  confirmedSteps: string[];
  // ── Agent level — session upgrades from l0 → l1 in-place ──
  agentLevel: 'l0' | 'l1';
  l1Started: boolean;   // true once L1 has sent its first message
};

type IntentResult = {
  intent:
  | 'confirmed_step'
  | 'confirmed_resolved'
  | 'denied_resolved'
  | 'wants_escalation'
  | 'wants_human'
  | 'answering_question'
  | 'new_question'
  | 'unclear';
  confidence: number;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Session store
// ─────────────────────────────────────────────────────────────────────────────

const sessions = new Map<string, BotSession>();

function newSession(
  id: string,
  tenant_id: string,
  tenant_product_id: string | null,
  user_id: string | null,
  user_email: string | null,
): BotSession {
  return {
    id,
    tenant_id,
    tenant_product_id,
    user_id,
    user_email,
    exchanges: 0,
    messages: [],
    phase: 'clarifying',
    clarifyingRound: 0,
    resolutionDelivered: false,
    pendingHandoffOffer: false,
    l0Summary: null,
    resolutionStep: 0,
    resolutionSubState: 'guiding',
    confirmedSteps: [],
    agentLevel: 'l0',
    l1Started: false,
  };
}

function newSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  OpenAI client
// ─────────────────────────────────────────────────────────────────────────────

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Intent classifier
// ─────────────────────────────────────────────────────────────────────────────

async function classifyIntent(args: {
  botLastMessage: string;
  userMessage: string;
  phase: ConversationPhase;
}): Promise<IntentResult> {
  const client = getOpenAI();
  if (!client) return { intent: 'unclear', confidence: 0 };

  const { botLastMessage, userMessage, phase } = args;

  const systemPrompt =
    'You are a conversation intent classifier for a support chat system. ' +
    'Reply ONLY with valid JSON. No markdown, no explanation, no prose.';

  const userPrompt = `
Bot's last message (what the bot said):
"""
${botLastMessage.slice(0, 800)}
"""

User's reply (what the user just said):
"""
${userMessage.slice(0, 400)}
"""

Current conversation phase: ${phase}

Classify the user's intent. Definitions:
- confirmed_step: User said yes/ok/done/tried-it to a DIAGNOSTIC or CLARIFYING question.
  The bot's last message was a question gathering info, NOT a resolution check.
- confirmed_resolved: User confirmed their issue is NOW FIXED. The bot's last message
  offered a resolution step and the user confirmed it worked.
- denied_resolved: User says the steps did NOT work, still broken, not happy.
- wants_escalation: User asks for a ticket, agent, escalation, support team.
- wants_human: User specifically wants a human ("talk to a person", "human", "real agent").
- answering_question: User gave a detailed answer to a clarifying question (not just yes/no).
- new_question: User asked a completely different/new question unrelated to the bot's last message.
- unclear: Cannot determine intent with reasonable confidence.

Reply ONLY with:
{"intent":"<one of the above>","confidence":<0.0 to 1.0>}
`.trim();

  try {
    const resp = await Promise.race([
      client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 60,
      }),
      new Promise<null>((r) => setTimeout(() => r(null), 3000)),
    ]);

    if (!resp || !('choices' in resp)) return { intent: 'unclear', confidence: 0 };
    const raw = resp.choices[0]?.message?.content?.trim() ?? '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      intent: (parsed.intent as IntentResult['intent']) ?? 'unclear',
      confidence: Number(parsed.confidence ?? 0),
    };
  } catch (e) {
    console.warn('[classifyIntent] failed:', (e as Error).message);
    return { intent: 'unclear', confidence: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Phase-aware system prompt builder
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(args: {
  phase: ConversationPhase;
  clarifyingRound: number;
  resolutionDelivered: boolean;
  productName: string | null;
  appLogContext: string | null;
  kbBlock: string;
  agentLevel: 'l0' | 'l1';
  l0Summary?: string | null;
  resolutionStep: number;
  resolutionSubState: 'guiding' | 'final_check';
  confirmedSteps: string[];
}): string {
  const { phase, clarifyingRound, appLogContext, kbBlock, agentLevel, l0Summary } = args;
  const product = args.productName || 'the product';
  const maxRounds = agentLevel === 'l1' ? 3 : 2;

  let phaseBlock: string;

  if (phase === 'clarifying') {
    if (clarifyingRound === 0) {
      phaseBlock = appLogContext
        ? [
          '━━ PHASE: CLARIFYING — Round 0 (You have diagnostic logs) ━━',
          '',
          'STEP 1 — Open with what you ALREADY KNOW from the logs (2–3 sentences max):',
          '  • Start with "I can see..." and cite something SPECIFIC:',
          '    exact error code, timestamp, transaction ID, which component failed.',
          '  • This immediately shows you\'ve done your homework.',
          '  • Do NOT give any resolution steps here.',
          '',
          'STEP 2 — Ask EXACTLY ONE targeted question based on the log detail.',
          '  Good: "Have you tried the transaction again since [timestamp]?"',
          '  Bad:  "Can you describe your issue?" (too vague — you already have logs)',
          '',
          'Stop. One question only. No suggestions, no troubleshooting steps.',
        ].join('\n')
        : [
          '━━ PHASE: CLARIFYING — Round 0 (First response, no logs) ━━',
          '',
          'STEP 1 — Acknowledge the issue warmly (1 sentence).',
          'STEP 2 — Ask EXACTLY ONE diagnostic question to understand:',
          '  a) What they have already tried, OR',
          '  b) What exactly they are seeing (error message, which step fails).',
          '  Make it specific to their issue type.',
          '',
          'No resolution steps yet. You need their answer first.',
          'Do NOT offer multiple questions or a bulleted list of possibilities.',
        ].join('\n');
    } else {
      const isLast = clarifyingRound >= maxRounds - 1;
      phaseBlock = [
        `━━ PHASE: CLARIFYING — Round ${clarifyingRound} of ${maxRounds - 1} ━━`,
        '',
        'STEP 1 — Acknowledge what they just told you in ONE sentence.',
        `STEP 2 — Ask EXACTLY ONE ${isLast ? 'FINAL' : 'follow-up'} clarifying question.`,
        '  Use their previous answer + log data to make it specific.',
        '  Don\'t ask something you can already infer from what they said.',
        isLast ? '\nThis is your LAST question before resolution. Make it count.' : '',
        '',
        'Still no resolution steps.',
      ].join('\n');
    }
  } else if (phase === 'resolution') {
    phaseBlock = [
      '━━ PHASE: RESOLUTION — Conversational step-by-step guidance ━━',
      '',
      'Guide the user through the fix one action at a time.',
      'This is a live conversation — not a FAQ. Never dump all steps at once.',
      '',
      'HOW TO DELIVER:',
      '  • Give ONE action for the user to take.',
      '  • Follow it with ONE short check-in question.',
      '  • When they confirm it worked → give the next action.',
      '  • When they say it did NOT work → diagnose THAT specific problem.',
      '    Do not escalate. Do not skip ahead. Fix what broke at this step.',
      '  • When the final step is confirmed working, close naturally:',
      '    e.g. "Great, you should be all set!" — no formal closing question needed.',
      '',
      `Current step index: ${args.resolutionStep}`,
      '  Step 0 = first action. Step 1+ = continue from here.',
      '',
      ...(args.confirmedSteps.length > 0
        ? [
          'ALREADY CONFIRMED — do NOT repeat or re-suggest these:',
          ...args.confirmedSteps.map((s, i) => `  ✓ Step ${i + 1}: "${s}"`),
          '',
        ]
        : []),
      'STRICT PROHIBITIONS:',
      '  ✗ Do not list all steps upfront.',
      '  ✗ Do NOT say "I will escalate" or "I am escalating" — you cannot take that action.',
      '  ✗ Do NOT say "our team will look into it" or "I\'ve raised this" — you haven\'t.',
      '  ✗ If you cannot resolve it, say "I\'ve exhausted what I can do from here." then ask:',
      '    "Would you like me to put you through to our advanced support team?" — nothing more.',
      '  ✗ Do not repeat a step the user already confirmed worked.',
      '  ✗ Do not ask "Has this fully resolved it?" — close naturally when done.',
      '  ✗ Do not move to the next step until the current one is confirmed.',
    ].join('\n');
  } else {
    phaseBlock = [
      '━━ PHASE: ESCALATION OFFER ━━',
      '',
      'The user\'s issue was not resolved or they requested escalation.',
      'Be empathetic, not apologetic.',
      '',
      agentLevel === 'l0'
        ? 'Tell them: "Our L1 team has deeper access to your account and session logs."'
        : 'Tell them: "Our advanced support team can investigate this directly."',
      '',
      'Ask: "Would you like me to escalate this? Reply yes and I\'ll raise it right now."',
    ].join('\n');
  }

  const l0Block = l0Summary
    ? [
      '━━ L0 CONVERSATION CONTEXT — YOU ARE PICKING UP FROM HERE ━━',
      '',
      'The L0 bot already tried the following before handing over to you (L1):',
      '',
      l0Summary.slice(0, 1500),
      '',
      '━━ YOUR FIRST RESPONSE RULES (L1 HANDOFF) ━━',
      '• Do NOT ask "what is your issue?" — the user already explained this to L0.',
      '• Do NOT repeat any steps from the L0 summary above.',
      '• Acknowledge the handoff in 1 sentence, then ask ONE deeper diagnostic question.',
      '• Use the Knowledge Base to offer steps L0 did NOT try.',
      '',
    ].join('\n')
    : '';

  return [
    `You are an intelligent ${agentLevel.toUpperCase()} support agent for ${product}.`,
    '',
    phaseBlock,
    '',
    '━━ UNIVERSAL RULES ━━',
    '',
    '• NEVER treat "yes" as "resolved" unless the user explicitly confirms a fix worked.',
    '  If you asked a diagnostic question and user said "yes" — that means they confirmed',
    '  the step. Advance to next round or resolution. Do NOT close the session.',
    '',
    '• NEVER ask the user for information you can already see in the logs.',
    '• Be specific. Cite exact values from logs (error codes, txn IDs, timestamps).',
    '• Tone: calm, expert, personal. Like a senior engineer who read the full trace.',
    '• ONE targeted question per response during clarification.',
    '• Do NOT offer multiple options during clarification.',
    '',
    '━━ STRICT CAPABILITY LIMITS ━━',
    '',
    '• You are a CHAT-ONLY support bot. You CANNOT perform ANY actions on accounts.',
    '• You CANNOT: unlock accounts, reset passwords, process refunds, modify settings.',
    '• NEVER say: "I will unlock your account", "Let me reset that", "I\'m processing..."',
    '• You CAN ONLY: guide users through self-service steps, provide KB-based advice,',
    '  or escalate to a human agent who CAN take action.',
    '• If the issue requires backend intervention, say clearly:',
    '  "This requires action from our support team — would you like me to escalate?"',
    '',
    ...(appLogContext ? ['━━ APP DIAGNOSTIC LOGS ━━', appLogContext, ''] : []),
    ...(l0Block ? [l0Block] : []),
    ...(kbBlock ? ['━━ KNOWLEDGE BASE ━━', kbBlock, ''] : []),
    'Now respond following the phase instruction EXACTLY.',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
//  LLM call
// ─────────────────────────────────────────────────────────────────────────────

async function callLLM(args: {
  system: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  model: string;
  images?: Array<{ mime_type: string; base64: string }>;
}): Promise<string> {
  const client = getOpenAI();
  if (!client) throw new Error('OPENAI_API_KEY not set');

  const { system, conversationHistory, userMessage, model, images } = args;

  const userContent: any =
    images && images.length > 0
      ? [
        { type: 'text', text: userMessage },
        ...images
          .filter((im) => im?.base64 && im?.mime_type)
          .slice(0, 3)
          .map((im) => ({
            type: 'image_url',
            image_url: { url: `data:${im.mime_type};base64,${im.base64}` },
          })),
      ]
      : userMessage;

  const allMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> = [
    { role: 'system', content: system },
    ...conversationHistory.slice(-30),
    { role: 'user', content: userContent },
  ];

  const resp = await Promise.race([
    client.chat.completions.create({ model, messages: allMessages, temperature: 0.3 }),
    new Promise<null>((r) => setTimeout(() => r(null), 15000)),
  ]);

  if (!resp || !('choices' in resp)) throw new Error('LLM call timed out');
  return resp.choices?.[0]?.message?.content?.trim() || 'I could not generate a response.';
}

// ─────────────────────────────────────────────────────────────────────────────
//  App log helpers
// ─────────────────────────────────────────────────────────────────────────────

async function loadAppLogsForSession(
  tenant_product_id: string,
  session_id: string,
): Promise<{ raw_text: string; error_count: number; issue_types: string[] } | null> {
  try {
    const doc = await Conversation.findOne(
      { tenant_product_id, session_id, type: 'bot' },
      { 'app_logs.raw_text': 1, 'app_logs.error_count': 1, 'app_logs.issue_types': 1 },
    ).lean();
    const al = (doc as any)?.app_logs;
    if (!al?.raw_text) return null;
    return {
      raw_text: String(al.raw_text),
      error_count: Number(al.error_count || 0),
      issue_types: Array.isArray(al.issue_types) ? al.issue_types : [],
    };
  } catch (e) {
    console.warn('[AppLogs] load error (non-fatal):', (e as Error).message);
    return null;
  }
}

function buildLogContextString(appLogs: {
  raw_text: string;
  error_count: number;
  issue_types: string[];
}): string {
  const issues = appLogs.issue_types.length > 0 ? appLogs.issue_types.join(', ') : 'none detected';
  return [
    `Detected Issues: ${issues}`,
    `Total Errors: ${appLogs.error_count}`,
    '',
    'Full session log (chronological):',
    appLogs.raw_text.slice(0, 6000),
  ].join('\n');
}

async function fetchAndAttachAppLogs(args: {
  tenant_product_id: string;
  session_id: string;
  user_id: string;
  app_session_id?: string | null;
}): Promise<void> {
  const { tenant_product_id, session_id, user_id, app_session_id } = args;
  const logServerUrl = process.env.APP_LOG_SERVER_URL || 'http://localhost:4000';
  const url =
    `${logServerUrl}/logs/${encodeURIComponent(user_id)}` +
    (app_session_id ? `?session_id=${encodeURIComponent(app_session_id)}` : '');

  let rawText = '';
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return;
    rawText = await resp.text();
  } catch {
    return;
  }

  if (!rawText.trim() || rawText === 'No logs yet.' || rawText === 'No logs for this user.') return;

  const errorCount = (rawText.match(/\[ERROR\s*\]/g) || []).length;
  const issueMatches = [...rawText.matchAll(/ISSUE\s*:\s*(\S+)/g)].map((m) => m[1]);
  const uniqueIssues = [...new Set(issueMatches)].filter((i) => i !== 'n/a');
  const capped = rawText.slice(0, 50_000);

  await Conversation.updateOne(
    { tenant_product_id, session_id, type: 'bot' },
    {
      $set: {
        app_logs: {
          fetched_at: new Date(),
          user_id,
          session_id: app_session_id || null,
          raw_text: capped,
          error_count: errorCount,
          issue_types: uniqueIssues,
        },
        updated_at: new Date(),
      },
    },
    { upsert: true, strict: false },
  );

  const systemMsg = {
    message_id: `syslog_${Date.now()}`,
    author_type: 'system',
    author_id: 'app_logger',
    author_name: 'App Logger',
    body:
      `[SYSTEM CONTEXT — App Logs]\n` +
      `User: ${user_id}${app_session_id ? ` | Session: ${app_session_id}` : ''}\n` +
      `Errors: ${errorCount} | Issues: ${uniqueIssues.join(', ') || 'none'}\n\n` +
      rawText.slice(0, 8_000),
    is_internal: true,
    attachments: [],
    created_at: new Date(),
  };

  await Conversation.updateOne(
    { tenant_product_id, session_id, type: 'bot' },
    { $push: { messages: { $each: [systemMsg], $position: 0 } } },
  );

  console.log(`[AppLogs] Attached ${errorCount} errors, issues=[${uniqueIssues}] to session ${session_id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Conversation persistence
// ─────────────────────────────────────────────────────────────────────────────

async function appendConversationMessage(args: {
  tenant_id: string;
  tenant_product_id: string;
  session_id: string;
  from: 'user' | 'bot';
  text: string;
  user_id?: string | null;
  user_email?: string | null;
  attachments?: Array<{ filename: string; mime_type: string; size_bytes: number; base64: string }>;
  meta?: Partial<{
    resolved_by_bot: boolean;
    turns_count: number;
    ended_at: Date;
    handoff_reason: string;
    handoff_ticket_id: string;
    model_used: string;
    kb_articles_used: string[];
    ticket_id: string;
    phase: string;
    channel_mode: string;
  }>;
}): Promise<void> {
  const { tenant_id, tenant_product_id, session_id, from, text, user_id, user_email, meta, attachments } = args;

  const messageDoc = {
    message_id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    author_type: from === 'user' ? 'user' : 'bot',
    author_id: from === 'user' ? (user_id || user_email || 'widget_user') : 'bot',
    author_name: from === 'user' ? (user_email || 'User') : 'Support Bot',
    body: text,
    is_internal: false,
    attachments: Array.isArray(attachments) ? attachments : [],
    created_at: new Date(),
  };

  const set: any = { updated_at: new Date(), tenant_id };
  if (meta) {
    if (meta.ticket_id) set.ticket_id = meta.ticket_id;
    set.bot_session = {
      ...(meta.resolved_by_bot !== undefined ? { resolved_by_bot: meta.resolved_by_bot } : {}),
      ...(meta.turns_count !== undefined ? { turns_count: meta.turns_count } : {}),
      ...(meta.handoff_reason ? { handoff_reason: meta.handoff_reason } : {}),
      ...(meta.handoff_ticket_id ? { handoff_ticket_id: meta.handoff_ticket_id } : {}),
      ...(meta.model_used ? { model_used: meta.model_used } : {}),
      ...(meta.kb_articles_used ? { kb_articles_used: meta.kb_articles_used } : {}),
      ...(meta.ended_at ? { ended_at: meta.ended_at } : {}),
      ...(meta.phase ? { phase: meta.phase } : {}),
      ...(meta.channel_mode ? { channel_mode: meta.channel_mode } : {}),
    };
  }

  await Conversation.updateOne(
    { tenant_product_id, type: 'bot', ...(session_id ? { session_id } : {}) },
    {
      $setOnInsert: { tenant_product_id, session_id, type: 'bot', created_at: new Date() },
      $set: set,
      $push: { messages: messageDoc },
    },
    { upsert: true, strict: false },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Priority + ticket helpers
// ─────────────────────────────────────────────────────────────────────────────

function classifyPriority(text: string): 'p1' | 'p2' | 'p3' | 'p4' {
  const t = text.toLowerCase();
  if (t.includes('urgent') || t.includes('asap') || t.includes('down') || t.includes('blocked') || t.includes('payment failed')) return 'p1';
  if (t.includes('error') || t.includes('cannot') || t.includes("can't") || t.includes('failed')) return 'p2';
  return 'p3';
}

async function createHandoffTicket(args: {
  tenant_id: string;
  user_email: string | null;
  subject: string;
  description: string;
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  session: BotSession;
  escalation_level?: number;
  source?: 'bot_handoff' | 'web_form';
}): Promise<{ ticket_id: string; ticket_number: string }> {
  const { tenant_id, user_email, subject, description, priority, session, escalation_level = 1, source = 'bot_handoff' } = args;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenant_id }, select: { id: true, product_id: true } });
  if (!tenant) throw new Error('Tenant not found');

  const ticketNumber =
    'TKT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

  const transcript = session.messages.map((m) => `${m.from === 'user' ? 'User' : 'Bot'}: ${m.text}`).join('\n');
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
    const [cls, snt] = await Promise.all([adapter.classify(textForAi), adapter.detectSentiment(textForAi)]);
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
  } catch (e) {
    console.warn('createHandoffTicket: AI enrichment failed:', (e as Error).message);
  }

  const normalizedPriority = (() => {
    const val = aiPriority || priority;
    if (val === 'p1' || val === 'p2' || val === 'p3' || val === 'p4') return val;
    return priority;
  })();

  let slaDeadline: Date | null = null;
  try {
    const resolutionMins = await getResolutionTimeMins(tenant.product_id, session.tenant_product_id, normalizedPriority);
    if (resolutionMins != null && resolutionMins > 0) slaDeadline = computeSlaDeadline(new Date(), resolutionMins);
  } catch { /* optional */ }

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
      source: source as any,
      user_type: 'tenant_user',
      escalation_level,
      session_id: session.id,
      category,
      sub_category: subCategory,
      department,
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
      body: `L${escalation_level} bot handoff. Reason: bot unable to resolve or user requested escalation.`,
      is_internal: true,
      is_bot: true,
    },
  });

  if (session.tenant_product_id && session.id) {
    await Conversation.updateOne(
      { tenant_product_id: session.tenant_product_id, session_id: session.id, type: 'bot' },
      {
        $setOnInsert: {
          tenant_product_id: session.tenant_product_id,
          tenant_id: tenant.id,
          session_id: session.id,
          type: 'bot',
          created_at: new Date(),
        },
        $set: {
          ticket_id: ticket.id,
          updated_at: new Date(),
          'bot_session.handoff_ticket_id': ticket.id,
          'bot_session.handoff_reason': 'handoff',
        },
      },
      { upsert: true, strict: false },
    ).catch((e) => console.warn('createHandoffTicket: link Conversation failed', (e as Error).message));
  }

  return { ticket_id: ticket.id, ticket_number: ticket.ticket_number };
}

async function getHumanSupportChannel(tenant_id: string): Promise<'chat' | 'email'> {
  try {
    const settings = await prisma.tenantChannelSettings.findUnique({
      where: { tenant_id },
      select: { human_support_channel: true } as any,
    });
    const val = (settings as any)?.human_support_channel;
    return val === 'chat' ? 'chat' : 'email';
  } catch {
    return 'email';
  }
}

async function handleL2Escalation(
  session: BotSession,
  sessionId: string,
  message: string,
  tenant_id: string,
  tenant_product_id: string | null,
  res: Response,
): Promise<void> {

  const channelMode = await getHumanSupportChannel(tenant_id);
  //here23
  // Generate a clean summary of what the bot already tried to help the human agent
  let contextSummary = `User explicitly requested a human agent (${channelMode}).`;
  if (session.agentLevel === 'l1' && session.confirmedSteps && session.confirmedSteps.length > 0) {
    contextSummary = `L1 Bot attempted resolution.

The user confirms these steps were taken:
${session.confirmedSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

However, the final issue is still unresolved. Escalating to L2 Human.`
  } else if (session.agentLevel === 'l1') {
    contextSummary = `L1 Bot attempted resolution but could not resolve the issue.

Steps attempted:
${session.messages.filter(m => m.from === 'bot').slice(-3).map(m => `- ${m.text.slice(0, 100)}...`).join('\n')}

Escalating to L2 Human.`
  }

  // Update ticket to L2
  if (session.ticket_id) {
    try {
      await prisma.ticket.update({
        where: { id: session.ticket_id },
        data: {
          status: 'open',
          escalation_level: 3,
          source: channelMode === 'email' ? 'web_form' : ('bot_handoff' as any),
        },
      });
      await prisma.ticketComment.create({
        data: {
          ticket_id: session.ticket_id,
          product_id: tenant_product_id || '',
          author_id: session.user_id ?? 'bot',
          body: `**L2 Escalation Context:**\n\n${contextSummary}\n\n*Full conversation transcript is available in the chat logs.*`,
          is_internal: true,
          is_bot: true,
        },
      });
    } catch (e) { console.error('L2 ticket update failed:', e); }
  }

  let reply: string;

  if (channelMode === 'email') {
    // Close the conversation — agent will reach out via email
    reply =
      `I've escalated this to our advanced support team.\n\n` +
      `🎫 Ticket: **${session.ticket_number ?? 'Unknown'}**\n\n` +
      `An agent will review your full conversation and reach out to you via email shortly. ` +
      `You don't need to do anything else.`;

    session.messages.push({ from: 'bot', text: reply, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id: tenant_product_id!, session_id: sessionId, from: 'bot', text: reply,
      meta: { handoff_reason: 'l1_to_l2_email', handoff_ticket_id: session.ticket_id, turns_count: session.exchanges },
    }).catch(() => { });

    sessions.delete(sessionId);
    res.json({
      reply,
      session_id: sessionId,
      ended: true,
      handoff: { ticket_id: session.ticket_id, ticket_number: session.ticket_number, channel: 'email' },
    });

  } else {
    // Chat-based — bot stays open, human agent joins
    reply =
      `I've escalated this to our advanced support team.\n\n` +
      `🎫 Ticket: **${session.ticket_number ?? 'Unknown'}**\n\n` +
      `A live agent will join this conversation shortly. Please stay here — ` +
      `they have full context of everything we've discussed.`;

    session.messages.push({ from: 'bot', text: reply, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id: tenant_product_id!, session_id: sessionId, from: 'bot', text: reply,
      meta: { handoff_reason: 'l1_to_l2_chat', handoff_ticket_id: session.ticket_id, turns_count: session.exchanges },
    }).catch(() => { });

    sessions.delete(sessionId);
    res.json({
      reply,
      session_id: sessionId,
      handoff: { ticket_id: session.ticket_id, ticket_number: session.ticket_number, channel: 'chat' },
    });
  }
}


async function runL1InSession(
  req: Request,
  res: Response,
  session: BotSession,
  sessionId: string,
  message: string,
  tenant_id: string,
  tenant_product_id: string,
  user_id: string | null,
  user_email: string | null,
  attachments: any[],
  intent: IntentResult,
): Promise<void> {

  // ── GATE 1: Explicit L2 escalation request ───────────────────────────────
  // Don't escalate immediately — offer first, then confirm.
  if (intent.intent === 'wants_human' || intent.intent === 'wants_escalation') {
    if (!session.pendingHandoffOffer) {
      // First request — offer escalation and wait for confirmation
      session.pendingHandoffOffer = true;
      session.phase = 'pending_handoff';
      const reply =
        `I understand — I'd like to escalate this to our advanced support team on your behalf.\n\n` +
        `They have deeper access and can take direct action on your account. ` +
        `Would you like me to raise this for you right now?\n\n` +
        `Reply **yes** to confirm escalation.`;
      session.messages.push({ from: 'bot', text: reply, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { turns_count: session.exchanges, phase: 'pending_handoff' },
      }).catch((e) => console.error('append(l1 offer) error:', e));
      session.exchanges += 1;
      res.json({ reply, session_id: sessionId, agent_level: 'l1' });
      return;
    }
    // Already offered — treat repeated escalation request as confirmation
    session.pendingHandoffOffer = false;
    return handleL2Escalation(session, sessionId, message, tenant_id, tenant_product_id, res);
  }

  // ── GATE 2: Pending L2 offer ──────────────────────────────────────────────
  if (session.pendingHandoffOffer) {
    const accepted =
      intent.intent === 'confirmed_step' ||
      intent.intent === 'confirmed_resolved' ||
      ['yes', 'y', 'yeah', 'yep', 'ok', 'okay', 'please', 'sure'].includes(message.trim().toLowerCase());

    if (accepted) {
      session.pendingHandoffOffer = false;
      return handleL2Escalation(session, sessionId, message, tenant_id, tenant_product_id, res);
    } else {
      session.pendingHandoffOffer = false;
      session.phase = 'resolution';
    }
  }

  // ── GATE 3: Resolution phase ──────────────────────────────────────────────
  if (session.phase === 'resolution') {

    if (intent.intent === 'confirmed_step') {
      const lastBotMsg = [...session.messages].reverse().find(m => m.from === 'bot')?.text ?? '';
      session.confirmedSteps.push(lastBotMsg.slice(0, 200));
      session.resolutionStep += 1;
    }

    if (intent.intent === 'confirmed_resolved') {
      const reply = `Great, glad that sorted it! If anything else comes up, I'm here.`;
      session.messages.push({ from: 'bot', text: reply, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { resolved_by_bot: true, turns_count: session.exchanges, ended_at: new Date() },
      }).catch((e) => console.error('append(resolved) error:', e));
      sessions.delete(sessionId);
      res.json({ reply, session_id: sessionId, ended: true });
      return;
    }

    if (intent.intent === 'denied_resolved') {
      session.phase = 'pending_handoff';
      session.pendingHandoffOffer = true;
      const reply =
        `I'm sorry that didn't sort it.\n\n` +
        `I've gone through everything I can from my end. ` +
        `Would you like me to escalate this to our advanced support team?\n\n` +
        `Reply **yes** to escalate.`;
      session.messages.push({ from: 'bot', text: reply, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { turns_count: session.exchanges, phase: 'pending_handoff' },
      }).catch((e) => console.error('append(l1 offer) error:', e));
      session.exchanges += 1;
      res.json({ reply, session_id: sessionId });
      return;
    }
  }

  // ── LLM call (L1 continuing resolution) ───────────────────────────────────
  let reply = '';
  try {
    const originalIssue = session.messages.find(m => m.from === 'user')?.text || message;
    const searchQuery = `${originalIssue} ${message}`.trim();
    const q = await embedQuery(searchQuery);
    const hits = await searchKb(q, { limit: 5, tenant_product_id, agent_level: 'l1' });
    const kbOk = hits[0]?.score >= 0.25;
    const appLogContext = session.appLogs?.raw_text ? buildLogContextString(session.appLogs) : null;

    const tp = await prisma.tenantProduct.findUnique({
      where: { id: tenant_product_id },
      select: { id: true, name: true, l1_model: true } as any,
    });
    const model: string = (tp as any)?.l1_model || 'gpt-4o-mini';

    const kbBlock = kbOk
      ? hits
        .map((h) => ({ text: String((h.payload as any)?.text || ''), score: h.score }))
        .filter((c) => c.text.trim())
        .slice(0, 4)
        .map((c, i) => `KB CHUNK ${i + 1} (score ${c.score.toFixed(3)}):\n${c.text}`)
        .join('\n\n')
      : '';

    const system = buildSystemPrompt({
      phase: session.phase,
      clarifyingRound: session.clarifyingRound,
      resolutionDelivered: session.resolutionDelivered,
      productName: (tp as any)?.name ?? null,
      appLogContext,
      kbBlock,
      agentLevel: 'l1',
      l0Summary: session.l0Summary,
      resolutionStep: session.resolutionStep,
      resolutionSubState: session.resolutionSubState,
      confirmedSteps: session.confirmedSteps,
    });

    const conversationHistory = session.messages
      .slice(-30)
      .map((m) => ({ role: (m.from === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text }));

    reply = await callLLM({
      system, conversationHistory, userMessage: message, model,
      images: attachments.map((a: any) => ({ mime_type: a.mime_type, base64: a.base64 })),
    });

    if (session.phase === 'resolution') {
      const gaveFinalClose =
        reply.toLowerCase().includes('you should be all set') ||
        reply.toLowerCase().includes('that should do it') ||
        reply.toLowerCase().includes("you're all set") ||
        reply.toLowerCase().includes('good to go');
      if (gaveFinalClose) {
        session.resolutionSubState = 'final_check';
      } else {
        session.resolutionStep += 1;
      }
    }

    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
      meta: { model_used: model, turns_count: session.exchanges, phase: 'l1_resolution' },
    }).catch((e) => console.error('append(l1 llm) error:', e));

  } catch (e: any) {
    console.error('[L1 in session] error:', e);
    reply = `Something went wrong on my end. Reply **human** and I'll escalate, or try again.`;
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
      meta: { turns_count: session.exchanges },
    }).catch(() => { });
  }

  session.exchanges += 1;
  session.messages.push({ from: 'bot', text: reply, at: Date.now() });
  res.json({ reply, session_id: sessionId, agent_level: 'l1', phase: session.phase });
}


// ─────────────────────────────────────────────────────────────────────────────
//  L0 chat
// ─────────────────────────────────────────────────────────────────────────────

async function runL0Chat(req: Request, res: Response): Promise<void> {
  const agentLevel = 'l0';
  const body = (req.body as any) || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const tenant_id = typeof body.tenant_id === 'string' ? body.tenant_id : '';
  const tenant_product_id = typeof body.tenant_product_id === 'string' ? body.tenant_product_id : null;
  const session_id_in = typeof body.session_id === 'string' && body.session_id ? body.session_id : null;
  const user_id = typeof body.user_id === 'string' ? body.user_id : null;
  const user_email = typeof body.user_email === 'string' ? body.user_email : null;
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

  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  if (!tenant_product_id) { res.status(400).json({ error: 'tenant_product_id required' }); return; }
  if (!message) { res.status(400).json({ error: 'message required' }); return; }

  const sessionId = session_id_in ?? newSessionId();
  let session = sessions.get(sessionId);

  if (!session) {
    session = newSession(sessionId, tenant_id, tenant_product_id, user_id, user_email);
    sessions.set(sessionId, session);

    try {
      const initialTicket = await createHandoffTicket({
        tenant_id, user_email,
        subject: 'Support request (from chatbot)',
        description: message,
        priority: classifyPriority(message),
        session,
        escalation_level: 1,
      });
      session.ticket_id = initialTicket.ticket_id;
      session.ticket_number = initialTicket.ticket_number;
    } catch (e) {
      console.error('Failed to create initial ticket:', e);
    }

    if (tenant_product_id && (user_id || app_session_id)) {
      fetchAndAttachAppLogs({
        tenant_product_id, session_id: sessionId,
        user_id: user_id || app_session_id || 'unknown',
        app_session_id,
      }).catch((e) => console.warn('[AppLogs] fetch failed:', (e as Error).message));
    }
  }

  if (tenant_product_id && !session.appLogs) {
    if (session.exchanges === 0) await new Promise((r) => setTimeout(r, 800));
    const loaded = await loadAppLogsForSession(tenant_product_id, sessionId);
    session.appLogs = loaded
      ? { ...loaded, loaded: true }
      : { raw_text: '', error_count: 0, issue_types: [], loaded: true };
  }

  session.messages.push({ from: 'user', text: message, at: Date.now() });
  appendConversationMessage({
    tenant_id, tenant_product_id, session_id: sessionId,
    from: 'user', text: message, user_id, user_email, attachments,
    meta: session.ticket_id ? { ticket_id: session.ticket_id } : undefined,
  }).catch((e) => console.error('append(user) error:', e));

  // ── Intent classification ──────────────────────────────────────────────────
  let intent: IntentResult = { intent: 'new_question', confidence: 1.0 };

  if (session.exchanges > 0) {
    const lastBotMessage = [...session.messages].reverse().find((m) => m.from === 'bot')?.text ?? '';
    intent = await classifyIntent({ botLastMessage: lastBotMessage, userMessage: message, phase: session.phase });
    console.log(`[L0 Intent] phase=${session.phase} round=${session.clarifyingRound} intent=${intent.intent} conf=${intent.confidence}`);
    if (intent.confidence < 0.6) {
      intent = { intent: 'answering_question', confidence: 0.5 };
    }
  }

  // ── GATE 1: Explicit escalation request → escalate to L1 first ───────────
  if (intent.intent === 'wants_human' || intent.intent === 'wants_escalation') {
    if (session.ticket_id) {
      try {
        await prisma.ticket.update({
          where: { id: session.ticket_id },
          data: { status: 'open', escalation_level: 2 },
        });
        await prisma.ticketComment.create({
          data: {
            ticket_id: session.ticket_id,
            product_id: tenant_product_id || '',
            author_id: session.user_id ?? 'bot',
            body: `User explicitly requested escalation. Routing to L1. Message: "${message}"`,
            is_internal: true,
            is_bot: true,
          },
        });
      } catch (e) { console.error('GATE1 ticket update failed:', e); }
    }

    // ── Upgrade session to L1 in-place ─────────────────────────────────
    session.agentLevel = 'l1';
    session.phase = 'resolution';
    session.clarifyingRound = 0;
    session.resolutionStep = 0;
    session.confirmedSteps = [];
    session.resolutionSubState = 'guiding';

    const l0BotMessages = session.messages
      .filter(m => m.from === 'bot')
      .map(m => m.text)
      .join('\n---\n')
      .slice(0, 1500);
    session.l0Summary = l0BotMessages;

    const transitionMsg = `— L0 support ended. L1 specialist has joined —`;
    session.messages.push({ from: 'bot', text: transitionMsg, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: transitionMsg,
      meta: { phase: 'l1_joined', turns_count: session.exchanges },
    }).catch((e) => console.error('append(transition gate1) error:', e));

    try {
      const tp = await prisma.tenantProduct.findUnique({
        where: { id: tenant_product_id },
        select: { id: true, name: true, l1_model: true } as any,
      });
      const model: string = (tp as any)?.l1_model || 'gpt-4o-mini';

      const originalIssue = session.messages.find(m => m.from === 'user')?.text || message;
      const q = await embedQuery(originalIssue);
      const hits = await searchKb(q, { limit: 5, tenant_product_id, agent_level: 'l1' });
      const kbOk = hits[0]?.score >= 0.25;
      const appLogContext = session.appLogs?.raw_text ? buildLogContextString(session.appLogs) : null;

      const kbBlock = kbOk
        ? hits
          .map((h) => ({ text: String((h.payload as any)?.text || ''), score: h.score }))
          .filter((c) => c.text.trim())
          .slice(0, 4)
          .map((c, i) => `KB CHUNK ${i + 1} (score ${c.score.toFixed(3)}):\n${c.text}`)
          .join('\n\n')
        : '';

      const l1OpeningPrompt = buildSystemPrompt({
        phase: 'resolution',
        clarifyingRound: 0,
        resolutionDelivered: false,
        productName: (tp as any)?.name ?? null,
        appLogContext,
        kbBlock,
        agentLevel: 'l1',
        l0Summary: session.l0Summary,
        resolutionStep: 0,
        resolutionSubState: 'guiding',
        confirmedSteps: [],
      });

      const conversationHistory = session.messages
        .slice(-20)
        .map((m) => ({ role: (m.from === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text }));

      const l1Reply = await callLLM({
        system: l1OpeningPrompt,
        conversationHistory,
        userMessage: `[L1 AGENT FIRST MESSAGE] The user's issue: "${originalIssue}". L0 already tried: ${session.l0Summary}. Start your first resolution step now.`,
        model,
      });

      session.l1Started = true;
      session.resolutionStep += 1;
      session.messages.push({ from: 'bot', text: l1Reply, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: l1Reply,
        meta: { model_used: model, turns_count: session.exchanges, phase: 'l1_resolution' },
      }).catch((e) => console.error('append(l1 gate1 opening) error:', e));

      session.exchanges += 1;
      res.json({
        reply: l1Reply,
        session_id: sessionId,
        agent_level: 'l1',
        transition_message: transitionMsg,
      });
      return;

    } catch (e) {
      console.error('L1 opening via Gate1 failed:', e);
      session.exchanges += 1;
      res.json({
        reply: transitionMsg,
        session_id: sessionId,
        agent_level: 'l1',
        transition_message: transitionMsg,
      });
      return;
    }
  }

  // ── GATE 2: Pending handoff offer ─────────────────────────────────────────
  if (session.pendingHandoffOffer) {
    const accepted =
      intent.intent === 'confirmed_step' ||
      intent.intent === 'confirmed_resolved' ||
      ['yes', 'y', 'yeah', 'yep', 'ok', 'okay', 'please', 'sure', 'create ticket', 'raise ticket'].includes(
        message.trim().toLowerCase(),
      );

    if (accepted) {
      session.pendingHandoffOffer = false;

      // Update ticket to escalated state
      if (session.ticket_id) {
        try {
          await prisma.ticket.update({
            where: { id: session.ticket_id },
            data: { status: 'open', escalation_level: 2 },
          });
        } catch { /* non-fatal */ }
      }

      // ── Upgrade session to L1 in-place ─────────────────────────────────
      session.agentLevel = 'l1';
      session.phase = 'resolution';   // L1 skips clarifying — goes straight to resolution
      session.clarifyingRound = 0;
      session.resolutionStep = 0;
      session.confirmedSteps = [];
      session.resolutionSubState = 'guiding';

      // Build L0 summary from messages so far
      const l0BotMessages = session.messages
        .filter(m => m.from === 'bot')
        .map(m => m.text)
        .join('\n---\n')
        .slice(0, 1500);
      session.l0Summary = l0BotMessages;

      // Show transition message
      const transitionMsg = `— L0 support ended. L1 specialist has joined —`;
      session.messages.push({ from: 'bot', text: transitionMsg, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: transitionMsg,
        meta: { phase: 'l1_joined', turns_count: session.exchanges },
      }).catch((e) => console.error('append(transition) error:', e));

      // ── Immediately generate L1 opening message via LLM ────────────────
      try {
        const tp = await prisma.tenantProduct.findUnique({
          where: { id: tenant_product_id },
          select: { id: true, name: true, l1_model: true } as any,
        });
        const model: string = (tp as any)?.l1_model || 'gpt-4o-mini';

        // Get the original user issue for KB search
        const originalIssue = session.messages.find(m => m.from === 'user')?.text || message;
        const q = await embedQuery(originalIssue);
        const hits = await searchKb(q, { limit: 5, tenant_product_id, agent_level: 'l1' });
        const kbOk = hits[0]?.score >= 0.25;
        const appLogContext = session.appLogs?.raw_text ? buildLogContextString(session.appLogs) : null;

        const kbBlock = kbOk
          ? hits
            .map((h) => ({ text: String((h.payload as any)?.text || ''), score: h.score }))
            .filter((c) => c.text.trim())
            .slice(0, 4)
            .map((c, i) => `KB CHUNK ${i + 1} (score ${c.score.toFixed(3)}):\n${c.text}`)
            .join('\n\n')
          : '';

        const l1OpeningPrompt = buildSystemPrompt({
          phase: 'resolution',
          clarifyingRound: 0,
          resolutionDelivered: false,
          productName: (tp as any)?.name ?? null,
          appLogContext,
          kbBlock,
          agentLevel: 'l1',
          l0Summary: session.l0Summary,
          resolutionStep: 0,
          resolutionSubState: 'guiding',
          confirmedSteps: [],
        });

        const conversationHistory = session.messages
          .slice(-20)
          .map((m) => ({ role: (m.from === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text }));

        const l1Reply = await callLLM({
          system: l1OpeningPrompt,
          conversationHistory,
          userMessage: `[L1 AGENT FIRST MESSAGE] The user's issue: "${originalIssue}". L0 already tried: ${session.l0Summary}. Start your first resolution step now.`,
          model,
        });

        session.l1Started = true;
        session.resolutionStep += 1;
        session.messages.push({ from: 'bot', text: l1Reply, at: Date.now() });
        appendConversationMessage({
          tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: l1Reply,
          meta: { model_used: model, turns_count: session.exchanges, phase: 'l1_resolution' },
        }).catch((e) => console.error('append(l1 opening) error:', e));

        session.exchanges += 1;
        res.json({
          reply: l1Reply,
          session_id: sessionId,
          agent_level: 'l1',
          transition_message: transitionMsg,
        });
        return;

      } catch (e) {
        console.error('L1 opening message failed:', e);
        // Fallback — just show transition, user can send next message
        session.exchanges += 1;
        res.json({
          reply: transitionMsg,
          session_id: sessionId,
          agent_level: 'l1',
        });
        return;
      }

    } else {
      // User declined — clear the offer, continue L0 conversation
      session.pendingHandoffOffer = false;
      session.phase = 'clarifying';
      session.clarifyingRound = 0;
    }
  }

  // ── GATE 3: Resolution phase ───────────────────────────────────────────────
  if (session.phase === 'resolution') {

    if (intent.intent === 'confirmed_step') {
      const lastBotMsg = [...session.messages].reverse().find(m => m.from === 'bot')?.text ?? '';
      session.confirmedSteps.push(lastBotMsg.slice(0, 200));
      session.resolutionStep += 1;
    }

    if (intent.intent === 'confirmed_resolved') {
      const reply = `Great, glad that sorted it! If anything else comes up, I'm here.`;
      session.messages.push({ from: 'bot', text: reply, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { resolved_by_bot: true, turns_count: session.exchanges, ended_at: new Date() },
      }).catch((e) => console.error('append(bot resolved) error:', e));
      sessions.delete(sessionId);
      res.json({ reply, session_id: sessionId, ended: true });
      return;
    }

    if (intent.intent === 'denied_resolved') {
      session.phase = 'pending_handoff';
      session.pendingHandoffOffer = true;
      const reply =
        `I'm sorry that didn't sort it.\n\n` +
        `Would you like me to escalate this to our support team? ` +
        `They'll have full context of our conversation and your session logs.\n\n` +
        `Reply **yes** to escalate.`;
      session.messages.push({ from: 'bot', text: reply, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { turns_count: session.exchanges, phase: 'pending_handoff' },
      }).catch((e) => console.error('append(bot offer) error:', e));
      session.exchanges += 1;
      res.json({ reply, session_id: sessionId });
      return;
    }

    if (intent.intent === 'new_question') {
      session.phase = 'clarifying';
      session.clarifyingRound = 0;
      session.resolutionDelivered = false;
      session.resolutionSubState = 'guiding';
    }
  }

  // ── Phase advance: clarifying → resolution ────────────────────────────────
  if (session.phase === 'clarifying') {
    if (intent.intent === 'confirmed_step' || intent.intent === 'answering_question') {
      session.clarifyingRound += 1;
      if (session.clarifyingRound >= 2) {
        session.phase = 'resolution';
      }
    }
  }

  // ── LLM call ──────────────────────────────────────────────────────────────
  let reply = '';

  try {
    const q = await embedQuery(message);
    const hits = await searchKb(q, { limit: 5, tenant_product_id, agent_level: agentLevel });
    const kbOk = hits[0]?.score >= 0.25;
    const appLogContext = session.appLogs?.raw_text ? buildLogContextString(session.appLogs) : null;
    const hasContext = kbOk || !!appLogContext;

    if (hasContext) {
      const tp = await prisma.tenantProduct.findUnique({
        where: { id: tenant_product_id },
        select: { id: true, name: true, l0_model: true, l0_provider: true } as any,
      });
      const model: string = (tp as any)?.l0_model || 'gpt-4o-mini';

      const kbBlock = kbOk
        ? hits
          .map((h) => ({ text: String((h.payload as any)?.text || ''), score: h.score }))
          .filter((c) => c.text.trim())
          .slice(0, 4)
          .map((c, i) => `KB CHUNK ${i + 1} (score ${c.score.toFixed(3)}):\n${c.text}`)
          .join('\n\n')
        : '';

      const system = buildSystemPrompt({
        phase: session.phase,
        clarifyingRound: session.clarifyingRound,
        resolutionDelivered: session.resolutionDelivered,
        productName: (tp as any)?.name ?? null,
        appLogContext,
        kbBlock,
        agentLevel,
        l0Summary: null,
        resolutionStep: session.resolutionStep,
        resolutionSubState: session.resolutionSubState,
        confirmedSteps: session.confirmedSteps,
      });

      const conversationHistory = session.messages
        .slice(-30)
        .map((m) => ({ role: (m.from === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text }));

      reply = await callLLM({
        system, conversationHistory, userMessage: message, model,
        images: attachments.map((a: any) => ({ mime_type: a.mime_type, base64: a.base64 })),
      });

      if (session.phase === 'resolution') {
        const gaveFinalClose =
          reply.toLowerCase().includes('you should be all set') ||
          reply.toLowerCase().includes('that should do it') ||
          reply.toLowerCase().includes("you're all set") ||
          reply.toLowerCase().includes('glad that sorted') ||
          reply.toLowerCase().includes('good to go');

        if (gaveFinalClose) {
          session.resolutionSubState = 'final_check';
        } else {
          session.resolutionStep += 1;
        }
      }

      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { model_used: model, turns_count: session.exchanges, phase: session.phase },
      }).catch((e) => console.error('append(bot) error:', e));

    } else {
      reply =
        `I wasn't able to find a specific match in my knowledge base for that.\n\n` +
        `Could you share a bit more detail — for example, the exact error message you're seeing, ` +
        `or which step you got stuck on?\n\n` +
        `Or if you'd prefer, I can raise a ticket and a support agent will follow up. Reply **yes** to do that.`;
      session.pendingHandoffOffer = true;
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { turns_count: session.exchanges },
      }).catch((e) => console.error('append(bot noKB) error:', e));
    }
  } catch (e: any) {
    console.error('[L0] chat error:', e);
    const isKeyError = e?.status === 401 || String(e?.message || '').toLowerCase().includes('api key');
    reply = isKeyError
      ? `I'm running but my AI configuration has an issue. An admin needs to check the API key.\n\nReply **human** and I'll raise a ticket.`
      : `Something went wrong on my end. Reply **human** and I'll raise a ticket, or try again in a moment.`;
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
      meta: { turns_count: session.exchanges },
    }).catch((e2) => console.error('append(bot err) error:', e2));
  }

  session.exchanges += 1;
  session.messages.push({ from: 'bot', text: reply, at: Date.now() });
  res.json({ reply, session_id: sessionId, phase: session.phase });
}

// ─────────────────────────────────────────────────────────────────────────────
//  L1 chat
// ─────────────────────────────────────────────────────────────────────────────

async function runL1Chat(req: Request, res: Response): Promise<void> {
  const agentLevel = 'l1';
  const body = (req.body as any) || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const tenant_id = typeof body.tenant_id === 'string' ? body.tenant_id : '';
  const tenant_product_id = typeof body.tenant_product_id === 'string' ? body.tenant_product_id : null;
  const session_id_in = typeof body.session_id === 'string' && body.session_id ? body.session_id : null;
  const user_id = typeof body.user_id === 'string' ? body.user_id : null;
  const user_email = typeof body.user_email === 'string' ? body.user_email : null;
  const app_session_id = typeof body.app_session_id === 'string' && body.app_session_id ? body.app_session_id : null;
  const l0_session_id = typeof body.l0_session_id === 'string' ? body.l0_session_id : null;

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

  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  if (!tenant_product_id) { res.status(400).json({ error: 'tenant_product_id required' }); return; }
  if (!message) { res.status(400).json({ error: 'message required' }); return; }

  const sessionId = session_id_in ?? newSessionId();
  let session = sessions.get(sessionId);

  if (!session) {
    session = newSession(sessionId, tenant_id, tenant_product_id, user_id, user_email);
    sessions.set(sessionId, session);

    if (l0_session_id) {
      try {
        const l0Conv = await Conversation.findOne(
          { session_id: l0_session_id, type: 'bot' },
          { messages: 1, ticket_id: 1 },
        ).lean();

        const l0TicketId = (l0Conv as any)?.ticket_id;
        if (l0TicketId) {
          session.ticket_id = l0TicketId;
          try {
            const t = await prisma.ticket.findUnique({ where: { id: l0TicketId }, select: { ticket_number: true } });
            if (t) session.ticket_number = t.ticket_number;
          } catch { /* non-fatal */ }
        }

        if (l0Conv && Array.isArray((l0Conv as any).messages)) {
          const rawL0 = (l0Conv as any).messages;

          const l0Messages = rawL0
            .filter((m: any) => !m.is_internal && (m.author_type === 'user' || m.author_type === 'bot'))
            .map((m: any) => ({
              from: m.author_type === 'user' ? 'user' : 'bot' as 'user' | 'bot',
              text: String(m.body || ''),
              at: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
            }));
          session.messages.push(...l0Messages);

          const botMessages = rawL0
            .filter((m: any) => m.author_type === 'bot' && !m.is_internal)
            .map((m: any) => String(m.body || ''))
            .join('\n---\n');
          session.l0Summary = botMessages.slice(0, 1500);

          const firstUserMessage = rawL0.find((m: any) => m.author_type === 'user' && !m.is_internal);
          if (firstUserMessage) {
            (session as any).l0UserIssue = String(firstUserMessage.body || '');
          }
        }
      } catch (e) {
        console.warn('[L1] Could not load L0 context:', (e as Error).message);
      }
    }

    // L1 starts in clarifying — has context but asks one deeper question first
    session.phase = 'clarifying';
    session.clarifyingRound = 0;

    if (tenant_product_id && (user_id || app_session_id)) {
      fetchAndAttachAppLogs({
        tenant_product_id, session_id: sessionId,
        user_id: user_id || app_session_id || 'unknown',
        app_session_id,
      }).catch((e) => console.warn('[AppLogs] fetch failed:', (e as Error).message));
    }
  }

  if (tenant_product_id && !session.appLogs) {
    if (session.exchanges === 0) await new Promise((r) => setTimeout(r, 800));
    const loaded = await loadAppLogsForSession(tenant_product_id, sessionId);
    session.appLogs = loaded
      ? { ...loaded, loaded: true }
      : { raw_text: '', error_count: 0, issue_types: [], loaded: true };
  }

  session.messages.push({ from: 'user', text: message, at: Date.now() });
  appendConversationMessage({
    tenant_id, tenant_product_id, session_id: sessionId,
    from: 'user', text: message, user_id, user_email, attachments,
    meta: session.ticket_id ? { ticket_id: session.ticket_id } : undefined,
  }).catch((e) => console.error('append(user) error:', e));

  // ── Intent classification ──────────────────────────────────────────────────
  let intent: IntentResult = { intent: 'new_question', confidence: 1.0 };

  if (session.exchanges > 0) {
    const lastBotMessage = [...session.messages].reverse().find((m) => m.from === 'bot')?.text ?? '';
    intent = await classifyIntent({ botLastMessage: lastBotMessage, userMessage: message, phase: session.phase });
    console.log(`[L1 Intent] phase=${session.phase} round=${session.clarifyingRound} intent=${intent.intent} conf=${intent.confidence}`);
    if (intent.confidence < 0.6) {
      intent = { intent: 'answering_question', confidence: 0.5 };
    }
  }

  // ── L1 ROUTING: session has been upgraded, route to L1 logic ─────────────
  if (session.agentLevel === 'l1' && session.l1Started) {
    return runL1InSession(req, res, session, sessionId, message, tenant_id, tenant_product_id, user_id, user_email, attachments, intent);
  }

  // ── GATE 1: Explicit escalation to L2 ─────────────────────────────────────
  if (intent.intent === 'wants_human' || intent.intent === 'wants_escalation') {
    let ticketId = session.ticket_id;
    let ticketNumber = session.ticket_number;

    if (ticketId) {
      try {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { status: 'open', escalation_level: 3, source: 'web_form' as any },
        });
        await prisma.ticketComment.create({
          data: {
            ticket_id: ticketId,
            product_id: tenant_product_id || '',
            author_id: session.user_id ?? 'bot',
            body: `User explicitly requested L2 escalation. Message: "${message}"`,
            is_internal: true,
            is_bot: true,
          },
        });
      } catch (e) { console.error('L1 GATE1 ticket update failed:', e); }
    } else {
      try {
        const t = await createHandoffTicket({
          tenant_id, user_email,
          subject: 'Support request — escalated to L2',
          description: message,
          priority: classifyPriority(message),
          session, escalation_level: 3, source: 'web_form',
        });
        ticketId = t.ticket_id;
        ticketNumber = t.ticket_number;
        session.ticket_id = ticketId;
        session.ticket_number = ticketNumber;
      } catch (e) { console.error('L1 ticket creation failed:', e); }
    }

    const reply =
      `Understood — I'm escalating this to our advanced support team.\n\n` +
      `🎫 Ticket: **${ticketNumber ?? 'Unknown'}**\n\n` +
      `They have full access to your session logs and everything we discussed. Expect a response within our SLA window.`;

    session.messages.push({ from: 'bot', text: reply, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
      meta: { handoff_reason: 'user_requested_escalation', handoff_ticket_id: ticketId, turns_count: session.exchanges },
    }).catch((e) => console.error('append(bot L1 gate1) error:', e));

    sessions.delete(sessionId);
    res.json({ reply, session_id: sessionId, handoff: { ticket_id: ticketId, ticket_number: ticketNumber } });
    return;
  }

  // ── GATE 2: Pending handoff offer (L1 → L2) ───────────────────────────────
  if (session.pendingHandoffOffer) {
    const accepted =
      intent.intent === 'confirmed_step' ||
      intent.intent === 'confirmed_resolved' ||
      ['yes', 'y', 'yeah', 'yep', 'ok', 'okay', 'please', 'sure', 'create ticket', 'raise ticket'].includes(message.trim().toLowerCase());

    if (accepted) {
      session.pendingHandoffOffer = false;

      let ticketId = session.ticket_id;
      let ticketNumber = session.ticket_number;

      if (ticketId) {
        try {
          await prisma.ticket.update({
            where: { id: ticketId },
            data: { status: 'open', escalation_level: 3, source: 'web_form' as any },
          });
        } catch { /* non-fatal */ }
      } else {
        try {
          const lastUser = [...session.messages].reverse().find((m) => m.from === 'user')?.text || message;
          const t = await createHandoffTicket({
            tenant_id, user_email,
            subject: 'Support request — escalated to L2 (human)',
            description: lastUser,
            priority: classifyPriority(lastUser),
            session, escalation_level: 3, source: 'web_form',
          });
          ticketId = t.ticket_id;
          ticketNumber = t.ticket_number;
        } catch (e) { console.error('L1→L2 ticket creation failed:', e); }
      }

      const reply =
        `I've escalated this to our advanced support team.\n\n` +
        `🎫 Ticket: **${ticketNumber ?? 'Unknown'}**\n\n` +
        `They'll review your session logs and full conversation, and reach out directly. Expect a response within our SLA window.`;

      session.messages.push({ from: 'bot', text: reply, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { handoff_reason: 'l1_escalated_to_l2', handoff_ticket_id: ticketId, turns_count: session.exchanges },
      }).catch((e) => console.error('append(bot L2) error:', e));

      sessions.delete(sessionId);
      res.json({ reply, session_id: sessionId, handoff: { ticket_id: ticketId, ticket_number: ticketNumber } });
      return;
    } else {
      session.pendingHandoffOffer = false;
      session.phase = 'clarifying';
      session.clarifyingRound = 0;
    }
  }

  // ── GATE 3: Resolution phase ───────────────────────────────────────────────
  if (session.phase === 'resolution') {

    if (intent.intent === 'confirmed_step') {
      const lastBotMsg = [...session.messages].reverse().find(m => m.from === 'bot')?.text ?? '';
      session.confirmedSteps.push(lastBotMsg.slice(0, 200));
      session.resolutionStep += 1;
    }

    if (intent.intent === 'confirmed_resolved') {
      const reply = `Great, glad that sorted it! If anything else comes up, I'm here.`;
      session.messages.push({ from: 'bot', text: reply, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { resolved_by_bot: true, turns_count: session.exchanges, ended_at: new Date() },
      }).catch((e) => console.error('append(bot resolved) error:', e));
      sessions.delete(sessionId);
      res.json({ reply, session_id: sessionId, ended: true });
      return;
    }

    if (intent.intent === 'denied_resolved') {
      session.phase = 'pending_handoff';
      session.pendingHandoffOffer = true;
      const reply =
        `I'm sorry that didn't sort it.\n\n` +
        `Would you like me to escalate this to our advanced support team? ` +
        `They can investigate directly and have full context of our conversation.\n\n` +
        `Reply **yes** to escalate.`;
      session.messages.push({ from: 'bot', text: reply, at: Date.now() });
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { turns_count: session.exchanges, phase: 'pending_handoff' },
      }).catch((e) => console.error('append(bot offer) error:', e));
      session.exchanges += 1;
      res.json({ reply, session_id: sessionId });
      return;
    }

    if (intent.intent === 'new_question') {
      session.phase = 'clarifying';
      session.clarifyingRound = 0;
      session.resolutionDelivered = false;
      session.resolutionSubState = 'guiding';
    }
  }

  // ── Phase advance: clarifying → resolution ────────────────────────────────
  if (session.phase === 'clarifying') {
    if (intent.intent === 'confirmed_step' || intent.intent === 'answering_question') {
      session.clarifyingRound += 1;
      if (session.clarifyingRound >= 3) {
        session.phase = 'resolution';
      }
    }
  }

  // ── LLM call ──────────────────────────────────────────────────────────────
  let reply = '';

  try {
    const l0UserIssue = (session as any).l0UserIssue as string | undefined;
    const searchQuery = (l0UserIssue && session.exchanges <= 2)
      ? `${l0UserIssue} ${message}`.trim()
      : message;

    const q = await embedQuery(searchQuery);
    const hits = await searchKb(q, { limit: 5, tenant_product_id, agent_level: agentLevel });
    const kbOk = hits[0]?.score >= 0.25;
    const appLogContext = session.appLogs?.raw_text ? buildLogContextString(session.appLogs) : null;
    const hasContext = kbOk || !!appLogContext;

    if (hasContext) {
      const tp = await prisma.tenantProduct.findUnique({
        where: { id: tenant_product_id },
        select: { id: true, name: true, l1_model: true, l1_provider: true } as any,
      });
      const model: string = (tp as any)?.l1_model || 'gpt-4o-mini';

      const kbBlock = kbOk
        ? hits
          .map((h) => ({ text: String((h.payload as any)?.text || ''), score: h.score }))
          .filter((c) => c.text.trim())
          .slice(0, 4)
          .map((c, i) => `KB CHUNK ${i + 1} (score ${c.score.toFixed(3)}):\n${c.text}`)
          .join('\n\n')
        : '';

      const system = buildSystemPrompt({
        phase: session.phase,
        clarifyingRound: session.clarifyingRound,
        resolutionDelivered: session.resolutionDelivered,
        productName: (tp as any)?.name ?? null,
        appLogContext,
        kbBlock,
        agentLevel,
        l0Summary: session.l0Summary ?? null,
        resolutionStep: session.resolutionStep,
        resolutionSubState: session.resolutionSubState,
        confirmedSteps: session.confirmedSteps,
      });

      const conversationHistory = session.messages
        .slice(-30)
        .map((m) => ({ role: (m.from === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text }));

      reply = await callLLM({
        system, conversationHistory, userMessage: message, model,
        images: attachments.map((a: any) => ({ mime_type: a.mime_type, base64: a.base64 })),
      });

      if (session.phase === 'resolution') {
        const gaveFinalClose =
          reply.toLowerCase().includes('you should be all set') ||
          reply.toLowerCase().includes('that should do it') ||
          reply.toLowerCase().includes("you're all set") ||
          reply.toLowerCase().includes('glad that sorted') ||
          reply.toLowerCase().includes('good to go');

        if (gaveFinalClose) {
          session.resolutionSubState = 'final_check';
        } else {
          session.resolutionStep += 1;
        }
      }

      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { model_used: model, turns_count: session.exchanges, phase: session.phase },
      }).catch((e) => console.error('append(bot) error:', e));

    } else {
      reply =
        `I wasn't able to find a specific match in my knowledge base for that.\n\n` +
        `Could you share a bit more detail — for example, the exact error message, ` +
        `or which step you got stuck on?\n\n` +
        `Or if you'd prefer, I can raise a ticket for our advanced support team. Reply **yes** to do that.`;
      session.pendingHandoffOffer = true;
      appendConversationMessage({
        tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
        meta: { turns_count: session.exchanges },
      }).catch((e) => console.error('append(bot noKB) error:', e));
    }
  } catch (e: any) {
    console.error('[L1] chat error:', e);
    const isKeyError = e?.status === 401 || String(e?.message || '').toLowerCase().includes('api key');
    reply = isKeyError
      ? `I'm running but my AI configuration has an issue. An admin needs to check the API key.\n\nReply **human** and I'll raise a ticket.`
      : `Something went wrong on my end. Reply **human** and I'll raise a ticket, or try again in a moment.`;
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply,
      meta: { turns_count: session.exchanges },
    }).catch((e2) => console.error('append(bot err) error:', e2));
  }

  session.exchanges += 1;
  session.messages.push({ from: 'bot', text: reply, at: Date.now() });
  res.json({ reply, session_id: sessionId, phase: session.phase });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public route handlers
// ─────────────────────────────────────────────────────────────────────────────

export async function chat(req: Request, res: Response): Promise<void> {
  return runL0Chat(req, res);
}

export async function chatL1(req: Request, res: Response): Promise<void> {
  return runL1Chat(req, res);
}

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

const DEFAULT_WELCOME = 'Hi! How can I help you today?';

export async function welcomeMessage(req: Request, res: Response): Promise<void> {
  const tenant_id = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : '';
  const tenant_product_id = typeof req.query.tenant_product_id === 'string' ? req.query.tenant_product_id.trim() : '';
  if (!tenant_product_id) { res.json({ message: DEFAULT_WELCOME }); return; }

  try {
    const tp = await prisma.tenantProduct.findFirst({
      where: { id: tenant_product_id, ...(tenant_id ? { tenant_id } : {}) },
      select: { id: true, name: true, l0_provider: true, l0_model: true },
    });
    if (!tp) { res.json({ message: DEFAULT_WELCOME }); return; }

    const client = getOpenAI();
    if (!client) { res.json({ message: DEFAULT_WELCOME }); return; }

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
      'You are writing ONLY the very first opening message for a support chat widget. ' +
      'The product team will render this text directly in the UI, so you MUST follow the exact output format.';

    const userPrompt = combined.trim()
      ? `Product/context: ${tp.name || 'Support'}\n\n` +
      `Write a welcome message that is STRICTLY a list of issues a user might face.\n` +
      `OUTPUT FORMAT:\n` +
      `- First line: a very short greeting sentence (max 15 words).\n` +
      `- Next lines: 5–8 bullet points, each starting with "• ".\n` +
      `- Do NOT add questions, instructions, numbered lists, or section headings.\n\n` +
      `Knowledge base content (for inspiration only):\n\n${combined}`
      : `Product/context: ${tp.name || 'Support'}\n\n` +
      `Write a welcome message for a support chat widget.\n` +
      `OUTPUT FORMAT:\n` +
      `- First line: a very short greeting sentence (max 15 words).\n` +
      `- Next lines: 5–8 bullet points, each starting with "• ".\n` +
      `- Do NOT add questions, instructions, numbered lists, or section headings.`;

    const resp = await Promise.race([
      client.chat.completions.create({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userPrompt }],
        temperature: 0.4,
        max_tokens: 400,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
    ]);

    const message = resp && 'choices' in resp
      ? resp.choices?.[0]?.message?.content?.trim() || DEFAULT_WELCOME
      : DEFAULT_WELCOME;
    res.json({ message });
  } catch (e) {
    console.error('welcomeMessage error:', e);
    res.json({ message: DEFAULT_WELCOME });
  }
}

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
        m.author_type === 'system' ? 'system'
          : m.author_type === 'bot' ? 'bot'
            : m.author_type === 'user' ? 'user'
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

export async function getVoiceToken(req: Request, res: Response): Promise<void> {
  const { tenant_id, tenant_product_id, user_email } = (req.body as any) || {};

  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  if (!env.OPENAI_API_KEY) { res.status(503).json({ error: 'OpenAI not configured' }); return; }

  let kbContext = '';
  let productName = 'Support';

  try {
    if (tenant_product_id) {
      const tp = await prisma.tenantProduct.findUnique({ where: { id: tenant_product_id }, select: { name: true } });
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
  const welcomeText = displayName ? `Hi ${displayName}! How can I help you today?` : 'Hi! How can I help you today?';

  const instructions =
    `You are a voice support agent for ${productName}. ` +
    `Speak naturally and concisely. Answer ONLY from the knowledge base below. ` +
    `Do not use markdown, bullet points, or numbered lists in speech.\n\n` +
    `ESCALATION RULES:\n` +
    `- If user asks to raise a ticket or talk to a human, immediately call raise_support_ticket.\n` +
    `- If you cannot resolve after 1-2 exchanges, offer to raise a ticket.\n` +
    `- If user is frustrated, offer to raise a ticket.\n\n` +
    (kbContext ? `Knowledge base:\n${kbContext}` : 'Answer questions and direct users to support if needed.');

  const raiseTicketTool = {
    type: 'function',
    name: 'raise_support_ticket',
    description: 'Create a support ticket when the user asks to talk to a human or you cannot resolve their issue.',
    parameters: {
      type: 'object',
      properties: {
        issue_summary: { type: 'string', description: "Short summary of the user's issue" },
      },
      required: ['issue_summary'],
    },
  };

  try {
    const sessionRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
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
      res.status(sessionRes.status).json({ error: (errData as any)?.error?.message || 'Failed to create voice session' });
      return;
    }

    const sessionData = (await sessionRes.json()) as { client_secret: unknown };
    res.json({ client_secret: sessionData.client_secret, welcome_text: welcomeText });
  } catch (e: any) {
    console.error('getVoiceToken error:', e);
    res.status(500).json({ error: 'Failed to create voice session' });
  }
}

export async function voiceHandoff(req: Request, res: Response): Promise<void> {
  const body = (req.body as any) || {};
  const tenant_id = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : '';
  const tenant_product_id = typeof body.tenant_product_id === 'string' ? body.tenant_product_id.trim() : null;
  const user_email = typeof body.user_email === 'string' ? body.user_email.trim() : null;
  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : null;
  const issue_summary = typeof body.issue_summary === 'string' ? body.issue_summary.trim() : 'Support request from voice agent';
  const conversation_text = typeof body.conversation_text === 'string' ? body.conversation_text.trim() : '';

  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenant_id }, select: { id: true, product_id: true } });
    if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }

    let resolvedUserId: string | null = user_id;
    if (!resolvedUserId && user_email) {
      const u = await prisma.user.findFirst({ where: { email: user_email }, select: { id: true } });
      resolvedUserId = u?.id ?? null;
    }

    const ticketNumber = 'TKT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const subject = issue_summary.slice(0, 200);
    const description = conversation_text
      ? `Voice conversation transcript:\n\n${conversation_text}\n\n---\nIssue summary: ${subject}`
      : `Issue raised via voice agent: ${subject}`;

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
    } catch { /* optional */ }

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

export async function describeImage(req: Request, res: Response): Promise<void> {
  const { base64, mime_type, context } = (req.body || {}) as {
    base64?: string;
    mime_type?: string;
    context?: string;
  };

  if (!base64 || !mime_type) { res.status(400).json({ error: 'base64 and mime_type are required' }); return; }

  const client = getOpenAI();
  if (!client) { res.status(503).json({ error: 'OpenAI not configured' }); return; }

  try {
    const prompt = context
      ? `${context}\n\nDescribe this image in detail, focusing on anything relevant to a technical support context.`
      : 'Describe this image in detail. Focus on error messages, UI elements, screenshots, or any technical content visible.';

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mime_type};base64,${base64}` } },
        ],
      }],
      max_tokens: 400,
    });

    const description = completion.choices[0]?.message?.content?.trim() || 'Unable to analyse image.';
    res.json({ description });
  } catch (e: any) {
    console.error('describeImage error:', e);
    res.status(500).json({ error: 'Failed to analyse image' });
  }
}
