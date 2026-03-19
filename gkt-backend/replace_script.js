const fs = require('fs');

const code = fs.readFileSync('src/controllers/bot.controller.ts', 'utf8');

// --- 1. REWRITE L0 CHAT TO IMMEDIATELY CREATE TICKET AND ESCALATE TO L1 ONLY ---
let newCode = code.replace(
  /export async function chat\(req: Request, res: Response\): Promise<void> \{[\s\S]*?\n  \/\/ ── Build shared context for LLM calls ────────────────────────────────────/g,
  `export async function chat(req: Request, res: Response): Promise<void> {
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
    session = { id: sessionId, tenant_id, tenant_product_id, user_id, user_email, exchanges: 0, messages: [] };
    sessions.set(sessionId, session);

    try {
      const initialTicket = await createHandoffTicket({
        tenant_id, user_email, subject: 'Support request (from chatbot)',
        description: message, priority: classifyPriority(message), session
      });
      session.ticket_id = initialTicket.ticket_id;
      session.ticket_number = initialTicket.ticket_number;
    } catch (e) {
      console.error('Failed to create initial ticket on session start:', e);
    }

    if (tenant_product_id && (user_id || app_session_id)) {
      fetchAndAttachAppLogs({
        tenant_product_id, session_id: sessionId, user_id: user_id || app_session_id || 'unknown', app_session_id
      }).catch(e => console.warn('[FlowPayLogger] log fetch failed (non-fatal):', (e as Error).message));
    }
  }

  if (tenant_product_id && !session.appLogs) {
    if (session.exchanges === 0) await new Promise(r => setTimeout(r, 800));
    const loaded = await loadAppLogsForSession(tenant_product_id, sessionId);
    session.appLogs = loaded ? { ...loaded, loaded: true } : { raw_text: '', error_count: 0, issue_types: [], loaded: true };
  }

  session.messages.push({ from: 'user', text: message, at: Date.now() });
  appendConversationMessage({
    tenant_id, tenant_product_id, session_id: sessionId, from: 'user', text: message, user_id, user_email, attachments,
    meta: session.ticket_id ? { ticket_id: session.ticket_id } : undefined,
  }).catch((e) => console.error('bot conversation append(user) error:', e));

  if (session.pendingHandoffOffer && acceptsHandoffOffer(message)) {
    session.pendingHandoffOffer = false;
    if (session.ticket_id) {
      try {
        await prisma.ticket.update({ where: { id: session.ticket_id }, data: { status: 'open' } });
        await prisma.ticketComment.create({
          data: { ticket_id: session.ticket_id, product_id: tenant_product_id || '', author_id: session.user_id ?? 'bot', body: \`User accepted handoff. Escalating to L1.\nLast message: \${message}\`, is_internal: true, is_bot: true }
        });
      } catch (e) { console.error('Failed to update ticket on escalate', e); }
    }
    const reply = \`I've escalated this to our L1 support agent. They will join the chat momentarily.\\n\\nTicket: \${session.ticket_number || 'Unknown'}\`;
    session.messages.push({ from: 'bot', text: reply, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply, meta: { handoff_reason: 'user_accepted_offer', handoff_ticket_id: session.ticket_id, turns_count: session.exchanges }
    }).catch((e) => console.error('bot conversation append(bot handoff) error:', e));
    sessions.delete(sessionId);
    res.json({ reply, session_id: sessionId, handoff: { escalate_to: 'l1', ticket_id: session.ticket_id, ticket_number: session.ticket_number } });
    return;
  }
  session.pendingHandoffOffer = false;

  if (session.exchanges >= 2 && isYes(message)) {
    const replyYes = \`Great — happy to help. If you need anything else, just message here anytime.\`;
    session.messages.push({ from: 'bot', text: replyYes, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: replyYes, meta: { resolved_by_bot: true, turns_count: session.exchanges, ended_at: new Date() }
    }).catch((e) => console.error('bot conversation append(bot yes) error:', e));
    sessions.delete(sessionId);
    res.json({ reply: replyYes, session_id: sessionId, ended: true });
    return;
  }

  if (session.exchanges >= 2 && looksLikeNotResolvedOrDissatisfied(message)) {
    const offerReply = \`I'm sorry that didn't resolve your issue.\\n\\nWould you like me to hand this over to our L1 support agent? Reply **yes** to connect with an agent, or ask me something else.\`;
    session.messages.push({ from: 'bot', text: offerReply, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: offerReply, meta: { turns_count: session.exchanges }
    }).catch((e) => console.error('bot conversation append(bot offer) error:', e));
    session.exchanges += 1;
    session.pendingHandoffOffer = true;
    res.json({ reply: offerReply, session_id: sessionId });
    return;
  }

  if (looksLikeHumanRequest(message)) {
    if (session.ticket_id) {
      try {
        await prisma.ticket.update({ where: { id: session.ticket_id }, data: { status: 'open' } });
        await prisma.ticketComment.create({
          data: { ticket_id: session.ticket_id, product_id: tenant_product_id || '', author_id: session.user_id ?? 'bot', body: \`User explicitly requested escalation to a human.\\nLast message: \${message}\`, is_internal: true, is_bot: true }
        });
      } catch (e) { console.error('Failed to update ticket on explicit escalate', e); }
    }
    const reply = \`No problem — I’m escalating this to our L1 support agent right now.\\n\\nTicket: \${session.ticket_number || 'Unknown'}\`;
    session.messages.push({ from: 'bot', text: reply, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply, meta: { handoff_reason: 'user_requested_escalation', handoff_ticket_id: session.ticket_id, turns_count: session.exchanges }
    }).catch((e) => console.error('bot conversation append(bot handoff) error:', e));
    sessions.delete(sessionId);
    res.json({ reply, session_id: sessionId, handoff: { escalate_to: 'l1', ticket_id: session.ticket_id, ticket_number: session.ticket_number } });
    return;
  }

  // ── Build shared context for LLM calls ────────────────────────────────────`
);


// --- 2. REWRITE L1 CHAT TO CHECK HUMAN_SUPPORT_CHANNEL AND TELL LLM L0 SUMMARY ---
newCode = newCode.replace(
  /export async function chatL1\(req: Request, res: Response\): Promise<void> \{[\s\S]*?\n  \/\/ ── Build shared context for LLM calls ────────────────────────────────────/g,
  `export async function chatL1(req: Request, res: Response): Promise<void> {
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
    session = { id: sessionId, tenant_id, tenant_product_id, user_id, user_email, exchanges: 0, messages: [] };
    sessions.set(sessionId, session);
  }

  session.messages.push({ from: 'user', text: message, at: Date.now() });
  appendConversationMessage({
    tenant_id, tenant_product_id, session_id: sessionId, from: 'user', text: message, user_id, user_email, attachments,
    meta: session.ticket_id ? { ticket_id: session.ticket_id } : undefined,
  }).catch((e) => console.error('bot conversation append(user) error:', e));

  if (session.pendingHandoffOffer && acceptsHandoffOffer(message)) {
    session.pendingHandoffOffer = false;
    const lastUser = [...session.messages].reverse().find((m) => m.from === 'user')?.text || message;
    const channelMode = await getHumanSupportChannel(tenant_id);
    const ticketSource: 'bot_handoff' | 'web_form' = channelMode === 'email' ? 'web_form' : 'bot_handoff';
    
    // In L1, we create a fresh handoff ticket to L2 or just update? Actually wait, L0 already created the ticket!
    // But since L2 means HUMAN intervention properly, let's keep the existing ticket if we have it, updating it.
    if (session.ticket_id) {
       try {
         await prisma.ticket.update({ where: { id: session.ticket_id }, data: { status: 'open', source: ticketSource as any } });
         await prisma.ticketComment.create({ data: { ticket_id: session.ticket_id, product_id: tenant_product_id || '', author_id: session.user_id ?? 'bot', body: \`Escalating to L2 human (\${channelMode}).\\nLast message: \${message}\`, is_internal: true, is_bot: true } });
       } catch (e) { console.error('Failed to update ticket L1->L2', e); }
    } else {
       // Fallback
       const t = await createHandoffTicket({ tenant_id, user_email, subject: 'Support request (L2 Escalation)', description: lastUser, priority: classifyPriority(lastUser), session, source: ticketSource });
       session.ticket_id = t.ticket_id;
       session.ticket_number = t.ticket_number;
    }

    const reply = channelMode === 'email'
      ? \`Your request has been raised to human support. Our team will review your conversation and get back to you via email shortly.\\n\\nTicket: \${session.ticket_number}\`
      : \`I've transferred this to our human support agent.\\n\\nTicket: \${session.ticket_number}\`;
    
    session.messages.push({ from: 'bot', text: reply, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply, meta: { handoff_reason: 'user_accepted_offer', handoff_ticket_id: session.ticket_id, turns_count: session.exchanges, channel_mode: channelMode }
    }).catch((e) => console.error('bot conversation append(bot handoff) error:', e));
    sessions.delete(sessionId);
    const responsePayload: any = { reply, session_id: sessionId, handoff: { ticket_id: session.ticket_id, ticket_number: session.ticket_number } };
    if (channelMode === 'email') responsePayload.ended = true;
    res.json(responsePayload);
    return;
  }
  session.pendingHandoffOffer = false;

  if (session.exchanges >= 2 && isYes(message)) {
    const replyYes = \`Great — happy to help. Let me know if you need anything else.\`;
    session.messages.push({ from: 'bot', text: replyYes, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: replyYes, meta: { resolved_by_bot: true, turns_count: session.exchanges, ended_at: new Date() }
    }).catch((e) => console.error('bot conversation append(bot yes) error:', e));
    sessions.delete(sessionId);
    res.json({ reply: replyYes, session_id: sessionId, ended: true });
    return;
  }

  if (session.exchanges >= 2 && looksLikeNotResolvedOrDissatisfied(message)) {
    const offerReply = \`I'm sorry I couldn't resolve your issue.\\n\\nWould you like me to escalate this to a human support agent? Reply **yes** to escalate.\`;
    session.messages.push({ from: 'bot', text: offerReply, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: offerReply, meta: { turns_count: session.exchanges }
    }).catch((e) => console.error('bot conversation append(bot offer) error:', e));
    session.exchanges += 1;
    session.pendingHandoffOffer = true;
    res.json({ reply: offerReply, session_id: sessionId });
    return;
  }

  if (looksLikeHumanRequest(message)) {
    const channelMode = await getHumanSupportChannel(tenant_id);
    const ticketSource: 'bot_handoff' | 'web_form' = channelMode === 'email' ? 'web_form' : 'bot_handoff';
    if (session.ticket_id) {
       try {
         await prisma.ticket.update({ where: { id: session.ticket_id }, data: { status: 'open', source: ticketSource as any } });
         await prisma.ticketComment.create({ data: { ticket_id: session.ticket_id, product_id: tenant_product_id || '', author_id: session.user_id ?? 'bot', body: \`Escalating to L2 human (\${channelMode}).\\nLast message: \${message}\`, is_internal: true, is_bot: true } });
       } catch (e) { console.error('Failed to update ticket L1->L2 explicit', e); }
    } else {
       const t = await createHandoffTicket({ tenant_id, user_email, subject: 'Support request (L2 Escalation)', description: message, priority: classifyPriority(message), session, source: ticketSource });
       session.ticket_id = t.ticket_id;
       session.ticket_number = t.ticket_number;
    }

    const reply = channelMode === 'email'
      ? \`Your request has been raised to human support. Our team will review your conversation and get back to you via email shortly.\\n\\nTicket: \${session.ticket_number}\`
      : \`I'm transferring this to a human agent now.\\n\\nTicket: \${session.ticket_number}\`;
    
    session.messages.push({ from: 'bot', text: reply, at: Date.now() });
    appendConversationMessage({
      tenant_id, tenant_product_id, session_id: sessionId, from: 'bot', text: reply, meta: { handoff_reason: 'user_requested_human', handoff_ticket_id: session.ticket_id, turns_count: session.exchanges, channel_mode: channelMode }
    }).catch((e) => console.error('bot conversation append(bot handoff) error:', e));
    sessions.delete(sessionId);
    const responsePayload: any = { reply, session_id: sessionId, handoff: { ticket_id: session.ticket_id, ticket_number: session.ticket_number } };
    if (channelMode === 'email') responsePayload.ended = true;
    res.json(responsePayload);
    return;
  }

  // ── Build shared context for LLM calls ────────────────────────────────────`
);

// --- 3. FIX L1 SYSTEM PROMPT ---
let l1SystemPromptIndex = newCode.indexOf("const system =");
let l1SystemPromptEnd = newCode.indexOf(";", l1SystemPromptIndex) + 1;
if (l1SystemPromptIndex > -1) {
  // Let's replace the whole 'const system =' definition inside chatL1
  // Wait, chat is defined TWICE! We need to make sure we are editing chatL1's system prompt!
  
  // A safer way: Add a special instruction block at the start of L1's system prompt inside the LLM call section.
  let isL1Check = "const isFirstMessage = session.exchanges === 0;";
  let replacementL1Intro = \`const isFirstMessage = session.exchanges === 0;
  
  if (isFirstMessage && req.url.includes('/l1')) {
     appLogContext = appLogContext || '';
     appLogContext += "\\n\\nIMPORTANT SYSTEM INSTRUCTION: The user has just been transferred to you from an automated L0 bot. Review the conversation history above safely. **Your VERY FIRST response MUST begin with a 1-2 sentence summary of their issue to confirm understanding, followed by immediate troubleshooting steps or a resolution effort.** Do not greet them like it's a new conversation, they already spoke to the L0 bot.";
  }
\`;
  newCode = newCode.replace(isL1Check, replacementL1Intro);
}

fs.writeFileSync('src/controllers/bot.controller.ts', newCode);
console.log("Successfully rewrote chat and chatL1.");
