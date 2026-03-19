/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { botApi } from '@/lib/api/bot.api';
import { widgetApi } from '@/lib/api/widget.api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

interface Message {
  id: string;
  from: 'user' | 'bot' | 'system';
  text: string;
  author_name?: string;
  bold_prefix?: string;
  created_at?: string | Date;
  attachments?: Array<{ filename: string; mime_type: string; size_bytes: number; base64: string }>;
}

const VOICE_API_BASE =
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_API_URL as string | undefined)) ||
  'http://localhost:5000';

const DEFAULT_SUGGESTIONS = [
  'Emails or notifications not being received',
  'How to submit a feature request',
  'How do I report a bug?',
];

export default function PortalChatPage() {
  const search = useSearchParams();
  const primaryColor = search.get('primary_color') || '#7c3aed';
  const logo = search.get('logo');
  const tenantId = search.get('tenant_id');
  const tenantProductId = search.get('tenant_product_id') || search.get('product_id') || undefined;
  const userId = search.get('user_id') || undefined;
  const userEmail = search.get('user_email') || undefined;

  // ─── text chat state ──────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [view, setView] = useState<'bot' | 'tickets'>('bot');
  const [ticketList, setTicketList] = useState<
    Array<{
      id: string;
      ticket_number: string;
      subject: string;
      status: string;
      updated_at: string;
      assigned_to: string | null;
    }>
  >([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [conversationClosed, setConversationClosed] = useState(false);
  const [isL1Session, setIsL1Session] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', from: 'bot', text: 'Hi! How can I help you today?' },
  ]);
  const [welcomeLoading, setWelcomeLoading] = useState(true);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ filename: string; mime_type: string; size_bytes: number; base64: string }>>([]);

  // ─── voice state ──────────────────────────────────────────────────────────
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceBotSpeaking, setVoiceBotSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const voicePcRef = useRef<RTCPeerConnection | null>(null);
  const voiceDcRef = useRef<RTCDataChannel | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceBotItemIdRef = useRef('');
  const voiceBotItemTextRef = useRef('');
  // Cancels any in-flight startVoiceSession() when user taps stop.
  const voiceSessionSeqRef = useRef(0);
  // Function-call tracking (raise_support_ticket tool)
  const voiceFnCallIdRef = useRef('');
  const voiceFnCallArgsRef = useRef('');
  const messagesRef = useRef<Message[]>([]); // always up-to-date snapshot for async callbacks

  // ─── refs ─────────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasWindow = typeof window !== 'undefined';
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const ticketSocketRef = useRef<Socket | null>(null);
  const loadTicketMessagesRef = useRef<(ticketId: string) => Promise<void>>(() => Promise.resolve());
  const activeTicketIdRef = useRef<string | null>(null);
  const conversationClosedRef = useRef(false);
  const sessionStorageKey = tenantId && tenantProductId ? `gkt_bot_session_${tenantId}_${tenantProductId}` : null;

  // ─── layout mode (sidebar = 320px panel | fullscreen = two-column) ─────────
  const [layoutMode, setLayoutMode] = useState<'sidebar' | 'fullscreen'>('sidebar');
  // Stable ref so paste/resize handlers can call addAttachmentsFromFiles w/o deps
  const addAttachmentsRef = useRef<(files: FileList | null) => Promise<void>>(async () => {});

  // ─── mount ────────────────────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ─── layout listener (parent widget.js tells us to switch layout) ─────────
  useEffect(() => {
    if (!hasWindow) return;
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'gkt-layout-fullscreen') setLayoutMode('fullscreen');
      if (e.data.type === 'gkt-layout-sidebar')    setLayoutMode('sidebar');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWindow]);

  // ─── paste-image handler ──────────────────────────────────────────────────
  useEffect(() => {
    if (!hasWindow) return;
    const handler = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const imageItems = Array.from(e.clipboardData.items).filter((item) =>
        item.type.startsWith('image/')
      );
      if (imageItems.length === 0) return;
      const fileArr = imageItems
        .map((item) => item.getAsFile())
        .filter(Boolean) as File[];
      if (fileArr.length === 0) return;
      const dt = new DataTransfer();
      fileArr.forEach((f) => dt.items.add(f));
      addAttachmentsRef.current(dt.files);
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWindow]);

  // ─── initial conversation load ────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId || !tenantProductId || !mounted) {
      if (!tenantId) setWelcomeLoading(false);
      return;
    }
    setWelcomeLoading(true);
    const sessionIdFromUrl = search.get('session_id');
    const sessionIdFromStorage = hasWindow && sessionStorageKey ? sessionStorage.getItem(sessionStorageKey) : null;
    const existingSessionId = sessionIdFromUrl || sessionIdFromStorage;

    if (existingSessionId) {
      botApi
        .getConversation(tenantId, tenantProductId, existingSessionId)
        .then((res) => {
          const list = res.data?.messages;
          if (res.data?.is_l1) setIsL1Session(true);
          if (Array.isArray(list) && list.length > 0) {
            setMessages(
              list.map((m: any) => ({
                id: m.id,
                from: (m.from === 'agent' ? 'bot' : m.from) as Message['from'],
                text: String(m.text ?? ''),
                author_name: m.author_name,
                attachments: Array.isArray(m.attachments) ? m.attachments : [],
                created_at: m.created_at,
              }))
            );
            setSessionId(existingSessionId);
          } else {
            return botApi.welcomeMessage(tenantId, tenantProductId).then((w) => {
              const msg = typeof w.data?.message === 'string' ? w.data.message.trim() : '';
              if (msg) setMessages([{ id: 'welcome', from: 'bot', text: msg }]);
            });
          }
        })
        .catch(() =>
          botApi.welcomeMessage(tenantId, tenantProductId).then((w) => {
            const msg = typeof w.data?.message === 'string' ? w.data.message.trim() : '';
            if (msg) setMessages([{ id: 'welcome', from: 'bot', text: msg }]);
          })
        )
        .finally(() => setWelcomeLoading(false));
    } else {
      botApi
        .welcomeMessage(tenantId, tenantProductId)
        .then((res) => {
          const message = typeof res.data?.message === 'string' ? res.data.message.trim() : '';
          if (message) {
            setMessages((prev) =>
              prev.length === 1 && prev[0].id === 'welcome'
                ? [{ id: 'welcome', from: 'bot', text: message }]
                : prev
            );
          }
        })
        .catch(() => {})
        .finally(() => setWelcomeLoading(false));
    }
  }, [tenantId, tenantProductId, mounted, sessionStorageKey, search]);

  // ─── keep messagesRef in sync for async voice callbacks ──────────────────
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ─── auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  // ─── socket: live ticket messages ────────────────────────────────────────
  useEffect(() => {
    if (view !== 'tickets' || !activeTicketId) {
      if (ticketSocketRef.current) {
        ticketSocketRef.current.off('ticket:message');
        ticketSocketRef.current = null;
      }
      return;
    }
    const socket = getSocket();
    ticketSocketRef.current = socket;
    activeTicketIdRef.current = activeTicketId;
    if (!socket.connected) socket.connect();
    socket.emit('join:ticket', activeTicketId);

    const messageHandler = (payload: any) => {
      if (!payload || payload.ticket_id !== activeTicketId) return;
      if (String(payload.from || 'agent') === 'user') return;
      const text = String(payload.text || '');
      if (!text) return;
      const msgId = String(payload.id || `rt-${Date.now()}`);
      const author_name = payload.author_name ? String(payload.author_name) : undefined;
      setMessages((prev) => {
        const recent = prev.slice(-3);
        if (recent.some((m) => m.text === text && m.from === 'bot')) return prev;
        return [...prev, { id: msgId, from: 'bot' as const, text, author_name, created_at: payload.created_at }];
      });
    };
    const escalatedHandler = (payload: any) => {
      if (!payload || payload.ticket_id !== activeTicketId) return;
      const byName = payload.escalated_by_name ?? 'Your agent';
      const toName = payload.assigned_to_name ? ` to ${payload.assigned_to_name}` : '';
      setMessages((prev) => [
        ...prev,
        { id: `sys-esc-${Date.now()}`, from: 'system' as const, text: `${byName} has transferred your chat${toName}. Please wait while the next agent connects.` },
      ]);
    };
    const agentStartedHandler = (payload: any) => {
      if (!payload || payload.ticket_id !== activeTicketId) return;
      setMessages((prev) => [
        ...prev,
        { id: `sys-start-${Date.now()}`, from: 'system' as const, text: `${payload.agent_name ?? 'An agent'} has joined the conversation.` },
      ]);
    };
    const closedHandler = (payload: any) => {
      if (!payload || payload.ticket_id !== activeTicketId) return;
      const closedMessage = payload.closed_message || 'Thank you for contacting us. This conversation is now closed.';
      setMessages((prev) => [...prev, { id: `sys-closed-${Date.now()}`, from: 'system' as const, text: closedMessage }]);
      setConversationClosed(true);
      socket.emit('leave:ticket', activeTicketId);
      loadTicketMessagesRef.current(activeTicketId);
    };
    const disconnectHandler = () => {
      const tid = activeTicketIdRef.current;
      if (tid) loadTicketMessagesRef.current(tid);
    };
    socket.on('ticket:message', messageHandler);
    socket.on('ticket:escalated', escalatedHandler);
    socket.on('ticket:agent_started', agentStartedHandler);
    socket.on('ticket:closed', closedHandler);
    socket.on('disconnect', disconnectHandler);
    return () => {
      socket.off('ticket:message', messageHandler);
      socket.off('ticket:escalated', escalatedHandler);
      socket.off('ticket:agent_started', agentStartedHandler);
      socket.off('ticket:closed', closedHandler);
      socket.off('disconnect', disconnectHandler);
      socket.emit('leave:ticket', activeTicketId);
    };
  }, [view, activeTicketId]);

  useEffect(() => {
    return () => {
      if (ticketSocketRef.current) {
        ticketSocketRef.current.off('ticket:message');
        disconnectSocket();
        ticketSocketRef.current = null;
      }
    };
  }, []);

  // ─── polling fallback ─────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'tickets' || !activeTicketId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (conversationClosedRef.current) { clearInterval(pollRef.current!); pollRef.current = null; return; }
      const tid = activeTicketIdRef.current;
      if (tid) loadTicketMessagesRef.current(tid);
    }, 5000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [view, activeTicketId]);

  // ─── voice: cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => stopVoiceSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── auto-close on email handoff ──────────────────────────────────────────
  useEffect(() => {
    if (ended) {
      const t = setTimeout(() => {
        if (hasWindow) {
          window.parent.postMessage({ type: 'gkt-widget-close' }, '*');
        }
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [ended, hasWindow]);

  if (!mounted) return null;

  // ─── helpers ──────────────────────────────────────────────────────────────
  const renderMessageContent = (m: Message) => {
    if (m.bold_prefix && m.text.startsWith(m.bold_prefix)) {
      const rest = m.text.slice(m.bold_prefix.length);
      return (<><strong style={{ fontWeight: 700 }}>{m.bold_prefix}</strong>{rest}</>);
    }
    return m.text;
  };

  async function readFileToBase64(file: File): Promise<{ filename: string; mime_type: string; size_bytes: number; base64: string }> {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => {
        const result = String(reader.result || '');
        // result is a data URL: data:<mime>;base64,<...>
        const idx = result.indexOf('base64,');
        resolve(idx >= 0 ? result.slice(idx + 'base64,'.length) : '');
      };
      reader.readAsDataURL(file);
    });
    return {
      filename: file.name || 'image',
      mime_type: file.type || 'image/png',
      size_bytes: file.size || 0,
      base64,
    };
  }

  async function addAttachmentsFromFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, 3);
    const encoded = await Promise.all(list.map((f) => readFileToBase64(f)));
    const cleaned = encoded.filter((a) => a.base64 && a.base64.length > 20);
    if (cleaned.length === 0) return;
    setPendingAttachments((prev) => [...prev, ...cleaned].slice(0, 3));

    // If voice is active: describe each image via backend (vision → text) and
    // inject the description as a text turn into the Realtime session.
    // The Realtime API doesn't accept image_url content; text description is the workaround.
    const dc = voiceDcRef.current;
    if (voiceActive && dc && dc.readyState === 'open') {
      for (const a of cleaned) {
        try {
          const descRes = await fetch(`${VOICE_API_BASE}/api/bot/describe-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64: a.base64,
              mime_type: a.mime_type,
              context: 'user support issue',
            }),
          });
          if (descRes.ok) {
            const { description } = await descRes.json() as { description: string };
            const currentDc = voiceDcRef.current;
            if (currentDc && currentDc.readyState === 'open') {
              currentDc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [{
                    type: 'input_text',
                    text: `[User shared an image. Image analysis: ${description}]`,
                  }],
                },
              }));
              currentDc.send(JSON.stringify({ type: 'response.create' }));
            }
          }
        } catch { /* ignore — don't break UI if describe fails */ }
      }
    }
  }
  // Keep ref in sync so paste handler can call this without stale closure issues
  addAttachmentsRef.current = addAttachmentsFromFiles;

  // ─── voice functions ──────────────────────────────────────────────────────
  function stopVoiceSession() {
    // Invalidate any in-flight startVoiceSession()
    voiceSessionSeqRef.current += 1;

    if (voiceDcRef.current) {
      try { voiceDcRef.current.onmessage = null; } catch { /* ignore */ }
      try { voiceDcRef.current.onopen = null; } catch { /* ignore */ }
      try { voiceDcRef.current.onclose = null; } catch { /* ignore */ }
      try { voiceDcRef.current.close(); } catch { /* ignore */ }
      voiceDcRef.current = null;
    }
    if (voicePcRef.current) {
      try { voicePcRef.current.ontrack = null; } catch { /* ignore */ }
      try { voicePcRef.current.onicecandidate = null; } catch { /* ignore */ }
      try { voicePcRef.current.onconnectionstatechange = null; } catch { /* ignore */ }
      try { voicePcRef.current.close(); } catch { /* ignore */ }
      voicePcRef.current = null;
    }
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((t) => t.stop());
      voiceStreamRef.current = null;
    }
    if (voiceAudioRef.current) {
      try { voiceAudioRef.current.pause(); } catch { /* ignore */ }
      voiceAudioRef.current.srcObject = null;
      try { (voiceAudioRef.current as any).src = ''; } catch { /* ignore */ }
    }
    voiceBotItemIdRef.current = '';
    voiceBotItemTextRef.current = '';
  }

  async function startVoiceSession() {
    const seq = (voiceSessionSeqRef.current += 1);
    setVoiceStatus('connecting');
    setVoiceError('');
    try {
      const tokenRes = await fetch(`${VOICE_API_BASE}/api/bot/voice-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, tenant_product_id: tenantProductId, user_email: userEmail }),
      });
      if (seq !== voiceSessionSeqRef.current) return;
      if (!tokenRes.ok) {
        const eb = await tokenRes.json().catch(() => ({}));
        throw new Error((eb as any).error || 'Failed to get voice token');
      }
      const { client_secret } = await tokenRes.json() as { client_secret: any };
      if (seq !== voiceSessionSeqRef.current) return;

      if (!voiceAudioRef.current) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        document.body.appendChild(audio);
        voiceAudioRef.current = audio;
      }

      const pc = new RTCPeerConnection();
      voicePcRef.current = pc;
      pc.ontrack = (e) => { if (voiceAudioRef.current) voiceAudioRef.current.srcObject = e.streams[0]; };

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (seq !== voiceSessionSeqRef.current) { ms.getTracks().forEach((t) => t.stop()); return; }
      voiceStreamRef.current = ms;
      pc.addTrack(ms.getTracks()[0]);

      const dc = pc.createDataChannel('oai-events');
      voiceDcRef.current = dc;
      dc.onopen = () => setVoiceStatus('active');
      dc.onmessage = (event) => {
        let evt: any;
        try { evt = JSON.parse(event.data as string); } catch { return; }
        switch (evt.type as string) {
          case 'session.created':
          case 'session.updated':
            setVoiceStatus('active');
            break;
          case 'input_audio_buffer.speech_started':
            setVoiceListening(true);
            setVoiceBotSpeaking(false);
            break;
          case 'input_audio_buffer.speech_stopped':
            setVoiceListening(false);
            break;
          case 'conversation.item.input_audio_transcription.completed': {
            const text = ((evt.transcript as string | undefined) || '').trim();
            if (text) setMessages((prev) => [...prev, { id: `v-u-${Date.now()}`, from: 'user', text }]);
            break;
          }
          case 'response.audio_transcript.delta': {
            const delta = (evt.delta as string | undefined) || '';
            if (!delta) break;
            const rid = (evt.response_id as string | undefined) || `v-b-${Date.now()}`;
            if (voiceBotItemIdRef.current !== rid) {
              voiceBotItemIdRef.current = rid;
              voiceBotItemTextRef.current = delta;
              setVoiceBotSpeaking(true);
              setMessages((prev) => [...prev, { id: rid, from: 'bot', text: delta }]);
            } else {
              voiceBotItemTextRef.current += delta;
              const acc = voiceBotItemTextRef.current;
              setMessages((prev) => prev.map((m) => (m.id === rid ? { ...m, text: acc } : m)));
            }
            break;
          }
          case 'response.audio_transcript.done': {
            const finalText = ((evt.transcript as string | undefined) || '').trim();
            if (finalText && voiceBotItemIdRef.current) {
              const id = voiceBotItemIdRef.current;
              setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: finalText } : m)));
            }
            setVoiceBotSpeaking(false);
            voiceBotItemIdRef.current = '';
            voiceBotItemTextRef.current = '';
            break;
          }

          // ── function call: raise_support_ticket ───────────────────────────
          case 'response.output_item.added': {
            // Track the call_id when LLM starts a function call
            if (evt.item?.type === 'function_call' && evt.item?.name === 'raise_support_ticket') {
              voiceFnCallIdRef.current = evt.item.call_id as string || '';
              voiceFnCallArgsRef.current = '';
            }
            break;
          }
          case 'response.function_call_arguments.delta': {
            // Accumulate the JSON args
            if (voiceFnCallIdRef.current) {
              voiceFnCallArgsRef.current += (evt.delta as string | undefined) || '';
            }
            break;
          }
          case 'response.function_call_arguments.done': {
            // Execute the tool call
            const callId = voiceFnCallIdRef.current;
            if (!callId) break;
            const rawArgs = voiceFnCallArgsRef.current || evt.arguments as string || '{}';
            voiceFnCallIdRef.current = '';
            voiceFnCallArgsRef.current = '';

            // Run async without blocking the event handler
            (async () => {
              let toolResult = '{"error":"Failed to create ticket"}';
              try {
                const args = JSON.parse(rawArgs) as { issue_summary?: string };
                const issueSummary = args.issue_summary || 'Support request from voice agent';

                // Build conversation text from current messages
                const convText = messagesRef.current
                  .filter((m) => m.from !== 'system')
                  .map((m) => `${m.from === 'user' ? 'User' : 'Bot'}: ${m.text}`)
                  .join('\n');

                const resp = await fetch(`${VOICE_API_BASE}/api/bot/voice-handoff`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    tenant_id: tenantId,
                    tenant_product_id: tenantProductId,
                    user_email: userEmail,
                    user_id: userId,
                    issue_summary: issueSummary,
                    conversation_text: convText,
                  }),
                });

                if (resp.ok) {
                  const { ticket_id, ticket_number } = await resp.json() as { ticket_id: string; ticket_number: string };
                  toolResult = JSON.stringify({ success: true, ticket_number, message: `Ticket ${ticket_number} has been created. A support agent will follow up with you shortly.` });

                  // Update UI: show system message, switch to tickets view
                  setMessages((prev) => [
                    ...prev,
                    { id: `sys-ticket-${Date.now()}`, from: 'system', text: `🎫 Ticket ${ticket_number} created — a support agent will reach out soon.` },
                  ]);
                  if (ticket_id && tenantId && userEmail) {
                    await loadTickets();
                    setView('tickets');
                    setActiveTicketId(ticket_id);
                    await loadTicketMessages(ticket_id);
                  }
                } else {
                  const errBody = await resp.json().catch(() => ({})) as any;
                  toolResult = JSON.stringify({ error: errBody.error || 'Failed to create ticket' });
                }
              } catch (e: any) {
                toolResult = JSON.stringify({ error: e?.message || 'Unknown error' });
              }

              // Send the function result back to the Realtime session
              const dc = voiceDcRef.current;
              if (dc && dc.readyState === 'open') {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: toolResult,
                  },
                }));
                // Trigger LLM to speak the result
                dc.send(JSON.stringify({ type: 'response.create' }));
              }
            })();
            break;
          }

          case 'error':
            setVoiceError((evt.error as any)?.message || 'Voice error');
            setVoiceStatus('error');
            break;
        }
      };

      const offer = await pc.createOffer();
      if (seq !== voiceSessionSeqRef.current) return;
      await pc.setLocalDescription(offer);
      if (seq !== voiceSessionSeqRef.current) return;

      const sdpRes = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          body: offer.sdp,
          headers: { Authorization: `Bearer ${client_secret.value}`, 'Content-Type': 'application/sdp' },
        }
      );
      if (seq !== voiceSessionSeqRef.current) return;
      if (!sdpRes.ok) throw new Error('Failed to connect to OpenAI Realtime');
      const answerText = await sdpRes.text();
      if (seq !== voiceSessionSeqRef.current) return;
      await pc.setRemoteDescription({ type: 'answer' as RTCSdpType, sdp: answerText });
      if (seq !== voiceSessionSeqRef.current) return;
      setVoiceStatus('active');
    } catch (e: any) {
      console.error('[Voice]', e);
      setVoiceError(e?.message || 'Failed to start voice');
      setVoiceStatus('error');
      setVoiceActive(false);
      stopVoiceSession();
    }
  }

  function toggleVoice() {
    if (voiceActive) {
      stopVoiceSession();
      setVoiceActive(false);
      setVoiceStatus('idle');
      setVoiceListening(false);
      setVoiceBotSpeaking(false);
    } else {
      setVoiceActive(true);
      startVoiceSession();
    }
  }

  // ─── chat handlers ────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (view === 'tickets') {
      const text = input.trim();
      if ((text.length === 0 && pendingAttachments.length === 0) || sending || !activeTicketId || !tenantId || !userEmail) return;
      setSending(true);
      setInput('');
      setError('');
      try {
        const atts = pendingAttachments;
        setPendingAttachments([]);
        await widgetApi.sendTicketMessage(activeTicketId, tenantId, userEmail, text, tenantProductId, atts);
        const res = await widgetApi.getTicketMessages(activeTicketId, tenantId, userEmail, tenantProductId);
        const msgs = (res.data?.messages as any[]) || [];
        setMessages(msgs.map((m: any) => ({
          id: String(m.id),
          from: (m.from === 'agent' ? 'bot' : m.from) as Message['from'],
          author_name: m.author_name || undefined,
          text: String(m.text || ''),
          bold_prefix: m.bold_prefix,
          attachments: Array.isArray(m.attachments) ? m.attachments : [],
          created_at: m.created_at,
        })));
      } catch (e: any) {
        setError(e?.message || 'Failed to send message');
      } finally {
        setSending(false);
      }
      return;
    }
    const text = input.trim();
    if ((text.length === 0 && pendingAttachments.length === 0) || sending || ended) return;
    if (!tenantId) { setError('Missing tenant_id'); return; }
    setInput('');
    setError('');
    setSuggestions([]);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const atts = pendingAttachments;
    setPendingAttachments([]);
    setMessages((prev) => [...prev, { id, from: 'user', text, attachments: atts }]);
    setSending(true);
    try {
      const res = isL1Session
        ? await botApi.chatL1({
            message: text,
            tenant_id: tenantId,
            tenant_product_id: tenantProductId,
            session_id: sessionId ?? undefined,
            l0_session_id: sessionId ?? undefined,
            user_id: userId,
            user_email: userEmail,
            attachments: atts,
          })
        : await botApi.chat({
            message: text,
            tenant_id: tenantId,
            tenant_product_id: tenantProductId,
            session_id: sessionId ?? undefined,
            user_id: userId,
            user_email: userEmail,
            attachments: atts,
          });
      const replyText = (res.data?.reply as string) || 'Bot did not return a reply.';
      if (typeof res.data?.session_id === 'string') {
        setSessionId(res.data.session_id);
        if (hasWindow && sessionStorageKey) sessionStorage.setItem(sessionStorageKey, res.data.session_id);
      }
      
      const transitionMessage = res.data?.transition_message as string | undefined;
      if (transitionMessage) {
        setMessages((prev) => [...prev, { id: `${id}-trans`, from: 'system', text: transitionMessage }]);
      }
      
      if (res.data?.ended === true) setEnded(true);
      setMessages((prev) => [...prev, { id: `${id}-bot`, from: 'bot', text: replyText }]);
      const handoffData = res.data?.handoff as { ticket_id?: string; ticket_number?: string; escalate_to?: string; channel?: string } | undefined;
      
      // Inline L1 upgrade (Gate 1 or Gate 2 in-session): backend already returned L1's first reply
      if (res.data?.agent_level === 'l1') {
        setIsL1Session(true);
        // nothing else needed – reply is already shown above
      } else if (handoffData?.escalate_to === 'l1') {
        setIsL1Session(true);
        // Ping dedicated /l1/chat endpoint (legacy path)
        setSending(true);
        try {
          const l1Res = await botApi.chatL1({
            message: 'I have been transferred to you. Please read our chat history and help me resolve this issue.',
            tenant_id: tenantId,
            tenant_product_id: tenantProductId,
            session_id: res.data.session_id,
            l0_session_id: res.data.session_id,
            user_id: userId,
            user_email: userEmail,
            attachments: [],
          });
          const l1Trans = (l1Res.data?.transition_message as string | undefined);
          if (l1Trans) {
            setMessages((prev) => [...prev, { id: `${id}-l1-trans`, from: 'system', text: l1Trans }]);
          }
          const l1Reply = (l1Res.data?.reply as string) || 'How can I help you?';
          setMessages((prev) => [...prev, { id: `${id}-l1-init`, from: 'bot', text: l1Reply }]);
        } catch (e: any) {
          setError(e?.message || 'Failed to connect to L1 agent');
        } finally {
          setSending(false);
        }
      } else if (handoffData?.ticket_id && tenantId && userEmail) {
        if (res.data?.ended === true || handoffData?.channel === 'email') {
          setEnded(true); // Auto-close in 5s
        } else {
          setMessages((prev) => [...prev, { id: `${id}-sys`, from: 'system', text: 'A live agent will join shortly...' }]);
          if (ticketSocketRef.current) { ticketSocketRef.current.off('ticket:message'); disconnectSocket(); ticketSocketRef.current = null; }
          setView('tickets');
          setActiveTicketId(handoffData.ticket_id);
          await loadTickets();
          await loadTicketMessagesRef.current(handoffData.ticket_id);
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!hasWindow) return;
    if (ticketSocketRef.current) { ticketSocketRef.current.off('ticket:message'); disconnectSocket(); ticketSocketRef.current = null; }
    window.parent?.postMessage({ type: 'gkt-widget-close' }, '*');
  };

  const handleMinimize = () => {
    if (!hasWindow) return;
    window.parent?.postMessage({ type: 'gkt-widget-minimize' }, '*');
  };

  const handleNewChat = () => {
    stopVoiceSession();
    setVoiceActive(false);
    setVoiceStatus('idle');
    setView('bot');
    setActiveTicketId(null);
    setConversationClosed(false);
    setIsL1Session(false);
    if (pollRef.current) clearInterval(pollRef.current);
    setSessionId(null);
    if (hasWindow && sessionStorageKey) sessionStorage.removeItem(sessionStorageKey);
    setEnded(false);
    setPendingAttachments([]);
    setMessages([{ id: 'welcome', from: 'bot', text: 'Hi! How can I help you today?' }]);
    setSuggestions(DEFAULT_SUGGESTIONS);
    setError('');
    setWelcomeLoading(true);
    botApi.welcomeMessage(tenantId || '', tenantProductId)
      .then((res) => {
        const message = typeof res.data?.message === 'string' ? res.data.message.trim() : '';
        if (message) setMessages([{ id: 'welcome', from: 'bot', text: message }]);
      })
      .catch(() => {})
      .finally(() => setWelcomeLoading(false));
    // In fullscreen mode, don't reload the iframe (it briefly shows sidebar layout before parent message arrives).
    // Just reset local state.
    if (hasWindow && layoutMode !== 'fullscreen') window.parent?.postMessage({ type: 'gkt-widget-new-session' }, '*');
  };

  const loadTickets = async () => {
    if (!tenantId || !userEmail) return;
    setTicketLoading(true);
    try {
      const res = await widgetApi.listMyTickets(tenantId, userEmail, tenantProductId);
      const items = (res.data?.items as any[]) || [];
      setTicketList(items.map((t: any) => ({
        id: String(t.id),
        ticket_number: String(t.ticket_number),
        subject: String(t.subject || ''),
        status: String(t.status || ''),
        assigned_to: t.assigned_to ? String(t.assigned_to) : null,
        updated_at: String(t.updated_at || ''),
      })));
    } catch { setTicketList([]); } finally { setTicketLoading(false); }
  };

  const loadTicketMessages = async (ticketId: string) => {
    if (!tenantId || !userEmail) return;
    try {
      const res = await widgetApi.getTicketMessages(ticketId, tenantId, userEmail, tenantProductId);
      const msgs = (res.data?.messages as any[]) || [];
      const hasClosedMsg = msgs.some((m: any) => String(m.text || '').toLowerCase().includes('this conversation is now closed'));
      conversationClosedRef.current = hasClosedMsg;
      setConversationClosed(hasClosedMsg);
      setMessages(msgs.map((m: any) => ({
        id: String(m.id),
        from: (m.from === 'agent' ? 'bot' : m.from) as Message['from'],
        author_name: m.author_name || undefined,
        text: String(m.text || ''),
        bold_prefix: m.bold_prefix,
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
        created_at: m.created_at,
      })));
    } catch (e: any) { setError(e?.message || 'Failed to load ticket messages'); }
  };
  loadTicketMessagesRef.current = loadTicketMessages;

  const handleRaiseTicket = async () => {
    if (!sessionId) return;
    setError('');
    setSending(true);
    try {
      const res = await botApi.handoff(sessionId);
      const ticketNumber = res.data?.handoff?.ticket_number as string | undefined;
      const ticketId = res.data?.handoff?.ticket_id as string | undefined;
      const msg = ticketNumber ? `Ticket ${ticketNumber} created. An agent will follow up.` : 'Ticket created. An agent will follow up.';
      setMessages((prev) => [...prev, { id: `${Date.now()}-bot-handoff`, from: 'bot', text: msg }]);
      setEnded(true);
      if (ticketId && tenantId && userEmail) {
        if (ticketSocketRef.current) { ticketSocketRef.current.off('ticket:message'); disconnectSocket(); ticketSocketRef.current = null; }
        setView('tickets');
        setActiveTicketId(ticketId);
        await loadTickets();
        await loadTicketMessages(ticketId);
      }
    } catch (e: any) { setError(e?.message || 'Failed to create ticket'); } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  };

  // ─── derived ──────────────────────────────────────────────────────────────
  const lastBot = [...messages].reverse().find((m) => m.from === 'bot');
  const showActions = !ended && !!sessionId && !!lastBot && view === 'bot';

  const orbColor = voiceListening
    ? '#ef4444'
    : voiceBotSpeaking
    ? '#22c55e'
    : voiceActive
    ? '#7c3aed'
    : '#4c1d95';

  const orbLabel =
    voiceStatus === 'connecting'
      ? 'Connecting…'
      : voiceStatus === 'error'
      ? 'Error — tap to retry'
      : voiceListening
      ? 'Listening…'
      : voiceBotSpeaking
      ? 'Speaking…'
      : voiceActive
      ? 'Tap to stop'
      : 'Tap to speak';

  const isTicketView = view === 'tickets';
  const activeTicket = ticketList.find((t) => t.id === activeTicketId);
  const isConvClosed =
    conversationClosed ||
    ['resolved', 'closed'].includes((activeTicket?.status || '').toLowerCase());

  // ─── fullscreen 2-column layout ──────────────────────────────────────────
  if (layoutMode === 'fullscreen') {
    const fsFont = 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    const fsInput = (disabled: boolean, placeholder: string) => (
      <div style={{ padding: '10px 20px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <InputRow
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          onSend={handleSend}
          disabled={disabled}
          placeholder={placeholder}
          sending={sending}
          textareaRef={textareaRef}
          primary={primaryColor}
          voiceActive={voiceActive}
          onVoiceToggle={toggleVoice}
          onPickImages={addAttachmentsFromFiles}
          pendingAttachments={pendingAttachments}
          onRemoveAttachment={(idx) => setPendingAttachments((p) => p.filter((_, i) => i !== idx))}
        />
      </div>
    );

    return (
      <div style={{ width: '100%', height: '100vh', background: '#0f0e0d', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: fsFont, color: '#f1f5f9' }}>

        {/* ── FULLSCREEN HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 54, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,7,7,0.97)', gap: 12 }}>
          {/* Logo + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 8 }}>
            <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${orbColor}, #2e1065)`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 12px ${orbColor}44`, transition: 'all 0.4s', flexShrink: 0 }}>
              {logo ? <img src={logo} alt="logo" style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#e9d5ff' }} />}
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>Support Bot</span>
          </div>
          {/* Centred tab switcher */}
          <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
            {(['bot', 'tickets'] as const).map((v) => (
              <button key={v} type="button"
                onClick={() => { setView(v); setActiveTicketId(null); if (v === 'tickets') loadTickets(); }}
                style={{ padding: '5px 18px', borderRadius: 8, border: `1px solid ${view === v ? `${primaryColor}60` : 'rgba(255,255,255,0.08)'}`, background: view === v ? `${primaryColor}18` : 'transparent', color: view === v ? '#e2e8f0' : '#475569', fontSize: 13, fontWeight: view === v ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                {v === 'bot' ? 'Chat' : 'My Tickets'}
              </button>
            ))}
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <HdrBtn onClick={handleNewChat} title="New chat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </HdrBtn>
            <HdrBtn onClick={handleMinimize} title="Minimize to sidebar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="5" y1="19" x2="19" y2="19" /></svg>
            </HdrBtn>
            <HdrBtn onClick={handleClose} title="Close">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </HdrBtn>
          </div>
        </div>

        {/* ── FULLSCREEN BODY: two columns ── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* ─── LEFT (2/3): voice orb centred ─── */}
          <div
            style={{
              flex: 2,
              borderRight: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              flexDirection: 'column',
              background: 'radial-gradient(900px circle at 45% 30%, rgba(124,58,237,0.12), rgba(0,0,0,0) 55%), rgba(4,3,3,0.55)',
              minWidth: 0,
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 28px', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                {/* Large orb */}
                <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(voiceActive || voiceListening || voiceBotSpeaking) && <>
                    <div style={{ position: 'absolute', inset: -30, borderRadius: '50%', border: `1.5px solid ${orbColor}38`, animation: `skRipple1 ${voiceListening ? '0.9s' : '1.6s'} ease-out infinite`, pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: `1.5px solid ${orbColor}50`, animation: `skRipple1 ${voiceListening ? '0.9s' : '1.6s'} ease-out infinite 0.45s`, pointerEvents: 'none' }} />
                  </>}
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={voiceStatus === 'connecting'}
                    aria-label={voiceActive ? 'Stop voice' : 'Start voice'}
                    style={{
                      width: 170,
                      height: 170,
                      borderRadius: '50%',
                      background: voiceActive
                        ? `radial-gradient(circle at 35% 30%, ${orbColor}ee, #1e0040)`
                        : 'radial-gradient(circle at 35% 30%, #6d28d9cc, #150025)',
                      border: `1.5px solid ${orbColor}55`,
                      cursor: voiceStatus === 'connecting' ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: voiceActive
                        ? `0 0 70px ${orbColor}66, 0 10px 44px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.12)`
                        : '0 0 28px #6d28d944, 0 10px 34px rgba(0,0,0,0.6)',
                      transition: 'all 0.35s',
                    }}
                  >
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="white" opacity={voiceStatus === 'connecting' ? 0.45 : 1}>
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </button>
                </div>

                {/* Status + controls */}
                <span style={{ fontSize: 13, fontWeight: 600, color: voiceStatus === 'error' ? '#fca5a5' : voiceListening ? '#fca5a5' : voiceBotSpeaking ? '#86efac' : '#94a3b8' }}>
                  {orbLabel}
                </span>
                {voiceError && <span style={{ fontSize: 11, color: '#fca5a5', textAlign: 'center', lineHeight: 1.5, maxWidth: 420 }}>{voiceError}</span>}
                {voiceActive && (
                  <button type="button" onClick={toggleVoice}
                    style={{ padding: '8px 22px', borderRadius: 999, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.07)', color: '#fca5a5', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    Stop voice
                  </button>
                )}
              </div>
            </div>

            {/* Resolve / raise-ticket actions (kept in voice panel) */}
            {showActions && (
              <div style={{ padding: '16px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleSendText('yes, that resolved it')} disabled={sending}
                  style={{ padding: '9px 14px', borderRadius: 12, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.07)', color: '#86efac', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  ✓ Resolved
                </button>
                <button type="button" onClick={handleRaiseTicket} disabled={sending}
                  style={{ padding: '9px 14px', borderRadius: 12, border: `1px solid ${primaryColor}44`, background: `${primaryColor}11`, color: '#a78bfa', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  Raise ticket
                </button>
              </div>
            )}
          </div>

          {/* ─── RIGHT (1/3): conversation + quick asks ─── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {isTicketView ? (
              activeTicketId ? (
                <>
                  {/* Ticket info bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'rgba(6,5,5,0.7)' }}>
                    <button type="button" onClick={() => { setActiveTicketId(null); loadTickets(); }} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 13, padding: '2px 6px', borderRadius: 6 }}>← Back</button>
                    <span style={{ fontSize: 12, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTicket?.ticket_number} · {activeTicket?.subject}</span>
                    <button type="button" onClick={() => { loadTickets(); if (activeTicketId) loadTicketMessages(activeTicketId); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#64748b', cursor: 'pointer', fontSize: 10, padding: '3px 8px' }}>Refresh</button>
                  </div>
                  {isConvClosed && <div style={{ padding: '6px 20px', background: 'rgba(22,163,74,0.12)', borderBottom: '1px solid rgba(22,163,74,0.2)', fontSize: 12, color: '#86efac', textAlign: 'center' }}>Conversation closed</div>}
                  {!isConvClosed && activeTicket && (
                    <div style={{ padding: '6px 20px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.15)', fontSize: 12, color: '#a5b4fc', textAlign: 'center' }}>
                      {!activeTicket.assigned_to ? 'Waiting for an agent…' : activeTicket.status === 'in_progress' ? 'Chatting with a support agent.' : 'Agent assigned — will respond shortly.'}
                    </div>
                  )}
                  <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                    {messages.map((m) => <MessageBubble key={m.id} m={m} primary={primaryColor} renderContent={renderMessageContent} />)}
                  </div>
                  {!isConvClosed && fsInput(false, 'Reply…')}
                </>
              ) : (
                /* Ticket list */
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', minHeight: 0 }}>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.07em' }}>My tickets</div>
                  {ticketLoading ? <SkeletonList /> : ticketList.length === 0 ? (
                    <div style={{ color: '#475569', fontSize: 14, textAlign: 'center', marginTop: 64 }}>No tickets yet.</div>
                  ) : ticketList.map((t) => (
                    <button key={t.id} type="button" onClick={() => { setActiveTicketId(t.id); loadTicketMessages(t.id); }}
                      style={{ width: '100%', textAlign: 'left', padding: '14px 18px', marginBottom: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', color: '#e2e8f0', cursor: 'pointer', transition: 'background 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>{t.ticket_number}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: t.status === 'in_progress' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)', color: t.status === 'in_progress' ? '#a5b4fc' : '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.status.replace('_', ' ')}</span>
                      </div>
                      <div style={{ fontSize: 14, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              /* Chat messages */
              <>
                <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                  {hasWindow && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
                      <span style={{ fontSize: 10, color: '#475569' }}>{(() => { try { return window.location.hostname || 'localhost'; } catch { return 'localhost'; } })()}</span>
                    </div>
                  )}

                  {/* Quick asks live inside the chat column */}
                  {!ended && suggestions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setSuggestions((p) => p.filter((x) => x !== s)); handleSendText(s); }}
                          style={{
                            padding: '7px 10px',
                            borderRadius: 999,
                            border: '1px solid rgba(139,92,246,0.28)',
                            background: 'rgba(139,92,246,0.06)',
                            color: '#a78bfa',
                            fontSize: 12,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.15s',
                            maxWidth: '100%',
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {welcomeLoading && messages.length === 1 && messages[0].id === 'welcome' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 0.2, 0.4].map((d) => <div key={d} style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', animation: `skDot 1s infinite ${d}s` }} />)}
                    </div>
                  ) : (
                    messages.map((m) => <MessageBubble key={m.id} m={m} primary={primaryColor} renderContent={renderMessageContent} />)
                  )}
                  {sending && (
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[0, 0.18, 0.36].map((d) => <div key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: '#475569', animation: `skDot 1s infinite ${d}s` }} />)}
                    </div>
                  )}
                  {error && <div style={{ fontSize: 12, color: '#fca5a5' }}>{error}</div>}
                </div>
                {fsInput(ended, ended ? 'Conversation ended' : 'Ask a question…')}
              </>
            )}
          </div>
        </div>

        <style>{`
          @keyframes skRipple1 { 0% { transform:scale(1); opacity:1; } 100% { transform:scale(1.9); opacity:0; } }
          @keyframes skDot { 0%,80%,100% { transform:scale(0.6); opacity:0.4; } 40% { transform:scale(1); opacity:1; } }
        `}</style>
      </div>
    );
  }

  // ─── sidebar (320 px) render ──────────────────────────────────────────────
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        maxHeight: '100vh',
        background: '#0f0e0d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        color: '#f1f5f9',
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 14px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(10,8,8,0.95)',
          gap: 8,
        }}
      >
        {/* Logo + name */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              background: `linear-gradient(135deg, ${orbColor}, #2e1065)`,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 10px ${orbColor}44`,
              transition: 'background 0.4s, box-shadow 0.4s',
            }}
          >
            {logo ? (
              <img src={logo} alt="logo" style={{ width: '100%', height: '100%', borderRadius: 7, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#e9d5ff' }} />
            )}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
            Support Bot
          </span>
        </div>
        {/* Header actions */}
        <div style={{ display: 'flex', gap: 4 }}>
          <HdrBtn onClick={handleNewChat} title="New chat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </HdrBtn>
          <HdrBtn
            onClick={() => {
              setView('tickets');
              setActiveTicketId(null);
              loadTickets();
            }}
            title="My tickets"
            active={isTicketView}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </HdrBtn>
          <HdrBtn onClick={handleMinimize} title="Minimize to sidebar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="5" y1="19" x2="19" y2="19" />
            </svg>
          </HdrBtn>
          <HdrBtn onClick={handleClose} title="Close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </HdrBtn>
        </div>
      </div>

      {/* ── VOICE ORB ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 18,
          paddingBottom: 14,
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 96,
            height: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Ripple rings */}
          {(voiceActive || voiceListening || voiceBotSpeaking) && (
            <>
              <div
                style={{
                  position: 'absolute',
                  inset: -16,
                  borderRadius: '50%',
                  border: `1.5px solid ${orbColor}40`,
                  animation: `skRipple1 ${voiceListening ? '0.9s' : '1.6s'} ease-out infinite`,
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: -8,
                  borderRadius: '50%',
                  border: `1.5px solid ${orbColor}55`,
                  animation: `skRipple1 ${voiceListening ? '0.9s' : '1.6s'} ease-out infinite 0.45s`,
                  pointerEvents: 'none',
                }}
              />
            </>
          )}
          {/* Orb button */}
          <button
            type="button"
            onClick={toggleVoice}
            disabled={voiceStatus === 'connecting'}
            aria-label={voiceActive ? 'Stop voice' : 'Start voice'}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: voiceActive
                ? `radial-gradient(circle at 35% 30%, ${orbColor}ee, #1e0040)`
                : 'radial-gradient(circle at 35% 30%, #6d28d9cc, #150025)',
              border: `1.5px solid ${orbColor}55`,
              cursor: voiceStatus === 'connecting' ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: voiceActive
                ? `0 0 32px ${orbColor}66, 0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)`
                : '0 0 14px #6d28d944, 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
              transition: 'background 0.35s, box-shadow 0.35s, border-color 0.35s',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" opacity={voiceStatus === 'connecting' ? 0.5 : 1}>
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        </div>
        <span style={{ fontSize: 11, color: voiceStatus === 'error' ? '#fca5a5' : '#64748b', letterSpacing: '0.02em' }}>
          {orbLabel}
        </span>
        {voiceError && (
          <span style={{ fontSize: 10, color: '#fca5a5', maxWidth: 240, textAlign: 'center', padding: '0 16px' }}>
            {voiceError}
          </span>
        )}
      </div>

      {/* ── TAB BAR ── */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          background: 'rgba(10,8,8,0.6)',
        }}
      >
        <TabBtn
          active={!isTicketView}
          onClick={() => {
            setView('bot');
            setActiveTicketId(null);
          }}
          primary={primaryColor}
        >
          Chat
        </TabBtn>
        <TabBtn
          active={isTicketView}
          onClick={() => {
            setView('tickets');
            setActiveTicketId(null);
            loadTickets();
          }}
          primary={primaryColor}
        >
          My Tickets
        </TabBtn>
      </div>

      {/* ── CONTENT ── */}
      {isTicketView ? (
        /* ── TICKETS VIEW ── */
        activeTicketId ? (
          /* ── TICKET CONVERSATION ── */
          <>
            {/* Back + ticket info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => { setActiveTicketId(null); loadTickets(); }}
                style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 13, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                ← Back
              </button>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <span style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {activeTicket?.ticket_number} · {activeTicket?.subject}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { loadTickets(); loadTicketMessages(activeTicketId); }}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#64748b', cursor: 'pointer', fontSize: 10, padding: '3px 7px' }}
              >
                Refresh
              </button>
            </div>
            {/* Status banner */}
            {isConvClosed ? (
              <div style={{ padding: '6px 12px', background: 'rgba(22,163,74,0.15)', borderBottom: '1px solid rgba(22,163,74,0.2)', fontSize: 11, color: '#86efac', flexShrink: 0, textAlign: 'center' }}>
                Conversation closed — thank you for reaching out.
              </div>
            ) : activeTicket && (
              <div style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.2)', fontSize: 11, color: '#a5b4fc', flexShrink: 0, textAlign: 'center' }}>
                {!activeTicket.assigned_to
                  ? 'Waiting for an agent to be assigned…'
                  : activeTicket.status === 'in_progress'
                  ? 'You are now chatting with a support agent.'
                  : 'An agent has been assigned and will get back to you soon.'}
              </div>
            )}
            {/* Messages */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              {messages.map((m) => <MessageBubble key={m.id} m={m} primary={primaryColor} renderContent={renderMessageContent} />)}
            </div>
            {/* Reply input */}
            <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <InputRow
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                disabled={isConvClosed}
                placeholder={isConvClosed ? 'Conversation closed' : 'Reply…'}
                sending={sending}
                textareaRef={textareaRef}
                primary={primaryColor}
                voiceActive={voiceActive}
                onVoiceToggle={toggleVoice}
                onPickImages={addAttachmentsFromFiles}
                pendingAttachments={pendingAttachments}
                onRemoveAttachment={(idx) => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
              />
            </div>
          </>
        ) : (
          /* ── TICKET LIST ── */
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', minHeight: 0 }}>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>My tickets</div>
            {ticketLoading ? (
              <SkeletonList />
            ) : ticketList.length === 0 ? (
              <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 32 }}>No tickets yet.</div>
            ) : (
              ticketList.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setActiveTicketId(t.id); loadTicketMessages(t.id); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)',
                    color: '#e2e8f0', cursor: 'pointer', display: 'block', transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>{t.ticket_number}</span>
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 99, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: t.status === 'in_progress' ? 'rgba(99,102,241,0.2)' : t.status === 'resolved' || t.status === 'closed' ? 'rgba(22,163,74,0.2)' : 'rgba(255,255,255,0.08)',
                      color: t.status === 'in_progress' ? '#a5b4fc' : t.status === 'resolved' || t.status === 'closed' ? '#86efac' : '#94a3b8',
                    }}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</div>
                </button>
              ))
            )}
          </div>
        )
      ) : (
        /* ── CHAT VIEW ── */
        <>
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}
          >
            {/* Current page chip */}
            {hasWindow && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(() => { try { return window.location.hostname || 'localhost'; } catch { return 'localhost'; } })()}
                </span>
              </div>
            )}

            {welcomeLoading && messages.length === 1 && messages[0].id === 'welcome' ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', animation: 'skDot 1s infinite' }} />
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', animation: 'skDot 1s infinite 0.2s' }} />
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', animation: 'skDot 1s infinite 0.4s' }} />
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} m={m} primary={primaryColor} renderContent={renderMessageContent} />)
            )}

            {/* Typing indicator */}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#475569', animation: 'skDot 1s infinite' }} />
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#475569', animation: 'skDot 1s infinite 0.18s' }} />
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#475569', animation: 'skDot 1s infinite 0.36s' }} />
              </div>
            )}

            {error && <div style={{ fontSize: 11, color: '#fca5a5' }}>{error}</div>}
          </div>

          {/* Suggestion pills */}
          {suggestions.length > 0 && !ended && (
            <div style={{ display: 'flex', gap: 6, padding: '4px 12px 6px', flexWrap: 'wrap', flexShrink: 0 }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSuggestions((prev) => prev.filter((x) => x !== s));
                    setInput(s);
                    setTimeout(() => { setInput(''); handleSendText(s); }, 0);
                  }}
                  style={{
                    padding: '4px 10px', borderRadius: 99, fontSize: 11,
                    border: '1px solid rgba(139,92,246,0.35)', background: 'rgba(139,92,246,0.08)',
                    color: '#a78bfa', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Action buttons when bot replied */}
          {showActions && (
            <div style={{ display: 'flex', gap: 8, padding: '4px 12px 4px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => { setInput('yes, that resolved it'); setTimeout(() => handleSend(), 0); }}
                disabled={sending}
                style={{ padding: '6px 12px', borderRadius: 99, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#86efac', fontSize: 11, cursor: 'pointer' }}
              >
                ✓ Resolved
              </button>
              <button
                type="button"
                onClick={handleRaiseTicket}
                disabled={sending}
                style={{ padding: '6px 12px', borderRadius: 99, border: `1px solid ${primaryColor}44`, background: `${primaryColor}11`, color: '#a78bfa', fontSize: 11, cursor: 'pointer' }}
              >
                Raise ticket
              </button>
            </div>
          )}

          {/* Input bar */}
          <div style={{ padding: '8px 12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <InputRow
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onSend={handleSend}
              disabled={ended}
              placeholder={ended ? 'Conversation ended' : 'Ask a question…'}
              sending={sending}
              textareaRef={textareaRef}
              primary={primaryColor}
              voiceActive={voiceActive}
              onVoiceToggle={toggleVoice}
              onPickImages={addAttachmentsFromFiles}
              pendingAttachments={pendingAttachments}
              onRemoveAttachment={(idx) => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
            />
          </div>
        </>
      )}

      <style>{`
        @keyframes skRipple1 {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes skDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );

  // Helper to send a text without going through the input state
  function handleSendText(text: string) {
    if (!text.trim() || sending || ended || !tenantId) return;
    setError('');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [...prev, { id, from: 'user', text }]);
    setSending(true);
    botApi.chat({ message: text, tenant_id: tenantId, tenant_product_id: tenantProductId, session_id: sessionId ?? undefined, user_id: userId, user_email: userEmail })
      .then((res) => {
        const replyText = (res.data?.reply as string) || 'Bot did not return a reply.';
        if (typeof res.data?.session_id === 'string') {
          setSessionId(res.data.session_id);
          if (hasWindow && sessionStorageKey) sessionStorage.setItem(sessionStorageKey, res.data.session_id);
        }
        if (res.data?.ended === true) setEnded(true);
        setMessages((prev) => [...prev, { id: `${id}-bot`, from: 'bot', text: replyText }]);
      })
      .catch((e: any) => setError(e?.message || 'Failed'))
      .finally(() => setSending(false));
  }
}

// ─── sub-components ────────────────────────────────────────────────────────

function HdrBtn({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title?: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 7,
        border: active ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
        background: active ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
        color: active ? '#a78bfa' : '#94a3b8', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function TabBtn({ children, active, onClick, primary }: { children: React.ReactNode; active: boolean; onClick: () => void; primary: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '9px 0', background: 'none', border: 'none',
        borderBottom: active ? `2px solid ${primary}` : '2px solid transparent',
        color: active ? '#e2e8f0' : '#475569', fontSize: 12, fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function MessageBubble({
  m, primary, renderContent,
}: {
  m: { id: string; from: string; text: string; author_name?: string; bold_prefix?: string; attachments?: Array<{ filename: string; mime_type: string; size_bytes: number; base64: string }> };
  primary: string;
  renderContent: (m: any) => React.ReactNode;
}) {
  if (m.from === 'system') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
        <span style={{
          fontSize: 10, color: '#475569', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 99,
          padding: '3px 10px', maxWidth: '90%', textAlign: 'center',
        }}>
          {m.text}
        </span>
      </div>
    );
  }
  const isUser = m.from === 'user';
  const senderLabel = isUser ? 'You' : (m.author_name || 'Bot');
  const atts = Array.isArray(m.attachments) ? m.attachments : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <span style={{ fontSize: 9, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 2, paddingRight: 2 }}>
        {senderLabel}
      </span>
      <div style={{
        maxWidth: '84%', padding: '8px 11px', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
        background: isUser ? `${primary}22` : 'rgba(255,255,255,0.06)',
        border: isUser ? `1px solid ${primary}44` : '1px solid rgba(255,255,255,0.08)',
        color: isUser ? '#e9d5ff' : '#cbd5e1',
      }}>
        {renderContent(m)}
        {atts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {atts.map((a, i) => (
              <a
                key={`${a.filename}-${i}`}
                href={`data:${a.mime_type};base64,${a.base64}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}
                title={a.filename}
              >
                <img
                  src={`data:${a.mime_type};base64,${a.base64}`}
                  alt={a.filename}
                  style={{ width: 140, height: 90, objectFit: 'cover', display: 'block' }}
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InputRow({
  value, onChange, onKeyDown, onSend, disabled, placeholder, sending, textareaRef, primary, voiceActive, onVoiceToggle,
  onPickImages, pendingAttachments, onRemoveAttachment,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  sending: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  primary: string;
  voiceActive: boolean;
  onVoiceToggle: () => void;
  onPickImages: (files: FileList | null) => void;
  pendingAttachments: Array<{ filename: string; mime_type: string; size_bytes: number; base64: string }>;
  onRemoveAttachment: (idx: number) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pendingAttachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {pendingAttachments.map((a, idx) => (
            <div key={`${a.filename}-${idx}`} style={{ position: 'relative' }}>
              <img
                src={`data:${a.mime_type};base64,${a.base64}`}
                alt={a.filename}
                style={{ width: 70, height: 46, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <button
                type="button"
                onClick={() => onRemoveAttachment(idx)}
                title="Remove"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(15,14,13,0.9)',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 6,
        background: 'rgba(255,255,255,0.05)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.09)', padding: '6px 8px',
      }}>
      {/* Mic toggle */}
      <button
        type="button"
        onClick={onVoiceToggle}
        title={voiceActive ? 'Stop voice' : 'Start voice'}
        style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          border: voiceActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
          background: voiceActive ? 'rgba(139,92,246,0.2)' : 'transparent',
          color: voiceActive ? '#a78bfa' : '#475569', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
      {/* Attach image */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          onPickImages(e.target.files);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        title="Attach image"
        style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'transparent',
          color: '#475569',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none',
          color: '#e2e8f0', fontSize: 12, lineHeight: 1.5, padding: '3px 0',
          fontFamily: 'inherit', maxHeight: 100, overflowY: 'auto',
          opacity: disabled ? 0.45 : 1,
        }}
      />
      {/* Send button */}
      <button
        type="button"
        onClick={onSend}
        disabled={sending || disabled || !value.trim()}
        style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: sending || disabled || !value.trim() ? 'rgba(255,255,255,0.05)' : primary,
          border: 'none', cursor: sending || disabled || !value.trim() ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sending || disabled || !value.trim() ? '#475569' : 'white'} strokeWidth="2.5">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 58, borderRadius: 10, background: 'rgba(255,255,255,0.04)', marginBottom: 6, animation: 'skDot 1.4s ease-in-out infinite' }} />
      ))}
    </>
  );
}
