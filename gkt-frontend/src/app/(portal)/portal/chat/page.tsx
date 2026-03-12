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
  author_name?: string;   // agent display name for differentiation
  created_at?: string | Date;
}

export default function PortalChatPage() {
  const search = useSearchParams();
  const primaryColor = search.get('primary_color') || '#FACC15';
  const logo = search.get('logo');
  const tenantId = search.get('tenant_id');
  const tenantProductId = search.get('tenant_product_id') || search.get('product_id') || undefined;
  const userId = search.get('user_id') || undefined;
  const userEmail = search.get('user_email') || undefined;
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      from: 'bot',
      text: 'Hi! How can I help you today?',
    },
  ]);
  const [welcomeLoading, setWelcomeLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasWindow = typeof window !== 'undefined';
  const pollRef = useRef<NodeJS.Timeout | null>(null); // kept for backward compatibility but no longer used for Mongo polling
  const ticketSocketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!tenantId) {
      setWelcomeLoading(false);
      return;
    }
    setWelcomeLoading(true);
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
  }, [tenantId, tenantProductId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Live ticket conversation via Socket.io — join as soon as a ticket is active.
  // No status gate: we want to receive agent replies the moment they are sent,
  // regardless of whether the local ticketList has the latest status.
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
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('join:ticket', activeTicketId);

    const messageHandler = (payload: any) => {
      if (!payload || payload.ticket_id !== activeTicketId) return;
      const fromRaw = String(payload.from || 'agent');
      // Skip user's own messages — handleSend already appends them via getTicketMessages REST call
      if (fromRaw === 'user') return;
      const text = String(payload.text || '');
      if (!text) return;
      const msgId = String(payload.id || `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      const author_name = payload.author_name ? String(payload.author_name) : undefined;
      setMessages((prev) => {
        // Deduplicate: skip if same text+author already exists in last 3 messages
        const recent = prev.slice(-3);
        if (recent.some((m) => m.text === text && m.from === 'bot')) return prev;
        return [...prev, { id: msgId, from: 'bot' as const, text, author_name, created_at: payload.created_at }];
      });
    };

    const escalatedHandler = (payload: any) => {
      if (!payload || payload.ticket_id !== activeTicketId) return;
      const byName = payload.escalated_by_name ? `${payload.escalated_by_name}` : 'Your agent';
      const toName = payload.assigned_to_name ? ` to ${payload.assigned_to_name}` : '';
      setMessages((prev) => [...prev, {
        id: `sys-esc-${Date.now()}`,
        from: 'system' as const,
        text: `${byName} has transferred your chat${toName}. Please wait while the next agent connects.`,
      }]);
    };

    const agentStartedHandler = (payload: any) => {
      if (!payload || payload.ticket_id !== activeTicketId) return;
      const name = payload.agent_name ? payload.agent_name : 'An agent';
      setMessages((prev) => [...prev, {
        id: `sys-start-${Date.now()}`,
        from: 'system' as const,
        text: `${name} has joined the conversation.`,
      }]);
    };

    socket.on('ticket:message', messageHandler);
    socket.on('ticket:escalated', escalatedHandler);
    socket.on('ticket:agent_started', agentStartedHandler);

    return () => {
      socket.off('ticket:message', messageHandler);
      socket.off('ticket:escalated', escalatedHandler);
      socket.off('ticket:agent_started', agentStartedHandler);
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

  if (!mounted) return null;

  const handleSend = async () => {
    // Ticket reply mode
    if (view === 'tickets') {
      const text = input.trim();
      if (!text || sending || !activeTicketId || !tenantId || !userEmail) return;
      setSending(true);
      setInput('');
      setError('');
      try {
        await widgetApi.sendTicketMessage(activeTicketId, tenantId, userEmail, text, tenantProductId);
        const res = await widgetApi.getTicketMessages(activeTicketId, tenantId, userEmail, tenantProductId);
        const msgs = (res.data?.messages as any[]) || [];
        setMessages(
          msgs.map((m: any) => ({
            id: String(m.id),
            from: (m.from === 'agent' ? 'bot' : m.from) as Message['from'],
            author_name: m.author_name || undefined,
            text: String(m.text || ''),
            created_at: m.created_at,
          })),
        );
      } catch (e: any) {
        setError(e?.message || 'Failed to send message');
      } finally {
        setSending(false);
      }
      return;
    }
    const text = input.trim();
    if (!text || sending || ended) return;
    if (!tenantId) {
      setError('Missing tenant_id');
      return;
    }
    setInput('');
    setError('');

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userMsg: Message = { id, from: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await botApi.chat({
        message: text,
        tenant_id: tenantId,
        tenant_product_id: tenantProductId,
        session_id: sessionId ?? undefined,
        user_id: userId,
        user_email: userEmail,
      });
      const replyText = (res.data?.reply as string) || 'Bot did not return a reply.';
      if (typeof res.data?.session_id === 'string') setSessionId(res.data.session_id);
      if (res.data?.ended === true) setEnded(true);
      const botMsg: Message = {
        id: `${id}-bot`,
        from: 'bot',
        text: replyText,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      setError(e?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const lastBot = [...messages].reverse().find((m) => m.from === 'bot');
  const showActions = !ended && !!sessionId && !!lastBot?.text?.toLowerCase().includes('did this solve it?');

  const handleClose = () => {
    if (!hasWindow) return;
    if (ticketSocketRef.current) {
      ticketSocketRef.current.off('ticket:message');
      disconnectSocket();
      ticketSocketRef.current = null;
    }
    window.parent?.postMessage({ type: 'gkt-widget-close' }, '*');
  };

  const handleNewChat = () => {
    setView('bot');
    setActiveTicketId(null);
    if (pollRef.current) clearInterval(pollRef.current);
    setSessionId(null);
    setEnded(false);
    setMessages([{ id: 'welcome', from: 'bot', text: 'Hi! How can I help you today?' }]);
    setError('');
    setWelcomeLoading(true);
    botApi
      .welcomeMessage(tenantId || '', tenantProductId)
      .then((res) => {
        const message = typeof res.data?.message === 'string' ? res.data.message.trim() : '';
        if (message) setMessages([{ id: 'welcome', from: 'bot', text: message }]);
      })
      .catch(() => {})
      .finally(() => setWelcomeLoading(false));
    if (hasWindow) {
      window.parent?.postMessage({ type: 'gkt-widget-new-session' }, '*');
    }
  };

  const loadTickets = async () => {
    if (!tenantId || !userEmail) return;
    setTicketLoading(true);
    try {
      const res = await widgetApi.listMyTickets(tenantId, userEmail, tenantProductId);
      const items = (res.data?.items as any[]) || [];
      setTicketList(
        items.map((t: any) => ({
          id: String(t.id),
          ticket_number: String(t.ticket_number),
          subject: String(t.subject || ''),
          status: String(t.status || ''),
          assigned_to: t.assigned_to ? String(t.assigned_to) : null,
          updated_at: String(t.updated_at || ''),
        })),
      );
    } catch {
      setTicketList([]);
    } finally {
      setTicketLoading(false);
    }
  };

  const loadTicketMessages = async (ticketId: string) => {
    if (!tenantId || !userEmail) return;
    try {
      const res = await widgetApi.getTicketMessages(ticketId, tenantId, userEmail, tenantProductId);
      const msgs = (res.data?.messages as any[]) || [];
      setMessages(
        msgs.map((m: any) => ({
          id: String(m.id),
          from: (m.from === 'agent' ? 'bot' : m.from) as Message['from'],
          author_name: m.author_name || undefined,
          text: String(m.text || ''),
          created_at: m.created_at,
        })),
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load ticket messages');
    }
  };

  const handleYes = () => {
    setInput('yes');
    setTimeout(() => handleSend(), 0);
  };

  const handleRaiseTicket = async () => {
    if (!sessionId) return;
    setError('');
    setSending(true);
    try {
      const res = await botApi.handoff(sessionId);
      const ticketNumber = res.data?.handoff?.ticket_number as string | undefined;
      const ticketId = res.data?.handoff?.ticket_id as string | undefined;
      const msg = ticketNumber ? `Ticket created: ${ticketNumber}` : 'Ticket created. A support agent will follow up.';
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-bot-handoff`, from: 'bot', text: msg },
      ]);
      // End the bot session so it stops replying,
      // but immediately switch to the ticket conversation view
      // so the user can continue chatting with a human.
      setEnded(true);
      if (ticketId && tenantId && userEmail) {
        // Ensure any existing ticket socket is reset when switching into ticket view
        if (ticketSocketRef.current) {
          ticketSocketRef.current.off('ticket:message');
          disconnectSocket();
          ticketSocketRef.current = null;
        }
        setView('tickets');
        setActiveTicketId(ticketId);
        await loadTickets();
        await loadTicketMessages(ticketId);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to create ticket');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        background: '#020617',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          height: '100vh',
          minHeight: 0,
          borderRadius: 20,
          border: '1px solid rgba(148,163,184,0.5)',
          background: 'radial-gradient(circle at top, #1d283a 0, #020617 60%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid rgba(148,163,184,0.4)',
            background: 'rgba(15,23,42,0.9)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: primaryColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              {logo ? (
                <img
                  src={logo}
                  alt="Tenant logo"
                  style={{ width: '100%', height: '100%', borderRadius: '999px', objectFit: 'cover' }}
                />
              ) : (
                '🤖'
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB' }}>ReWire Support Bot</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                if (view === 'bot') return;
                setView('bot');
                setError('');
                setActiveTicketId(null);
                if (pollRef.current) clearInterval(pollRef.current);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.5)',
                background: view === 'bot' ? primaryColor : 'transparent',
                color: view === 'bot' ? '#111827' : '#E5E7EB',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              Chatbot
            </button>
            <button
              type="button"
              onClick={() => {
                if (view === 'tickets') return;
                setView('tickets');
                setError('');
                loadTickets();
                if (pollRef.current) clearInterval(pollRef.current);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.5)',
                background: view === 'tickets' ? primaryColor : 'transparent',
                color: view === 'tickets' ? '#111827' : '#E5E7EB',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              My tickets
            </button>
            <button
              type="button"
              onClick={handleNewChat}
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.5)',
                background: 'transparent',
                color: '#E5E7EB',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              New chat
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.6)',
                background: 'transparent',
                color: '#9CA3AF',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body: bot chat vs tickets view */}
        {view === 'tickets' ? (
          <div style={{ display: 'flex', flex: 1, minHeight: 0, borderTop: '1px solid rgba(30,64,175,0.4)' }}>
            <div
              style={{
                width: 150,
                flexShrink: 0,
                borderRight: '1px solid rgba(30,64,175,0.4)',
                padding: '8px 6px',
                fontSize: 11,
                overflowY: 'auto',
              }}
            >
              <div style={{ marginBottom: 6, color: '#9CA3AF', fontWeight: 600 }}>My tickets</div>
              {ticketLoading ? (
                <div style={{ color: '#9CA3AF' }}>Loading…</div>
              ) : ticketList.length === 0 ? (
                <div style={{ color: '#9CA3AF' }}>No tickets yet.</div>
              ) : (
                ticketList.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTicketId(t.id);
                      loadTicketMessages(t.id);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 6px',
                      marginBottom: 4,
                      borderRadius: 8,
                      border: 'none',
                      background: activeTicketId === t.id ? 'rgba(30,64,175,0.8)' : 'transparent',
                      color: '#E5E7EB',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 11 }}>{t.ticket_number}</div>
                    <div
                      style={{
                        fontSize: 10,
                        color: '#9CA3AF',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t.subject}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                padding: '10px 10px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {activeTicketId && (
                <div
                  style={{
                    marginBottom: 8,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'linear-gradient(90deg, rgba(30,64,175,0.9), rgba(56,189,248,0.85))',
                    color: '#F9FAFB',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    boxShadow: '0 8px 16px rgba(15,23,42,0.5)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {(() => {
                      const t = ticketList.find((x) => x.id === activeTicketId);
                      if (!t) return null;
                      const s = (t.status || '').toLowerCase();
                      if (!t.assigned_to) {
                        return 'Waiting for an agent to be assigned…';
                      }
                      if (s === 'new_ticket' || s === 'open') {
                        return 'An agent has been assigned and will get back to you soon.';
                      }
                      if (s === 'in_progress') {
                        return 'You are now chatting with a support agent.';
                      }
                      return null;
                    })()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeTicketId) return;
                      loadTickets();
                      loadTicketMessages(activeTicketId);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: '1px solid rgba(15,23,42,0.35)',
                      background: 'rgba(15,23,42,0.15)',
                      color: '#EFF6FF',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Refresh
                  </button>
                </div>
              )}
              {messages.map((m) => {
                if (m.from === 'system') {
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                      <div style={{
                        fontSize: 10, color: '#94A3B8', background: 'rgba(30,41,59,0.7)',
                        border: '1px solid rgba(148,163,184,0.2)', borderRadius: 99,
                        padding: '4px 12px', maxWidth: '90%', textAlign: 'center',
                      }}>
                        {m.text}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                      {m.from === 'bot' && m.author_name && (
                        <span style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2, paddingLeft: 4 }}>{m.author_name}</span>
                      )}
                      <div style={{
                        padding: '8px 10px', borderRadius: 14, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                        background: m.from === 'user' ? primaryColor : 'rgba(15,23,42,0.9)',
                        color: m.from === 'user' ? '#111827' : '#E5E7EB',
                      }}>
                        {m.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              {error && (
                <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 4 }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              padding: '10px 10px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {welcomeLoading && messages.length === 1 && messages[0].id === 'welcome' ? (
              <div
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '80%',
                  padding: '8px 10px',
                  borderRadius: 14,
                  fontSize: 12,
                  background: 'rgba(15,23,42,0.9)',
                  color: '#94A3B8',
                }}
              >
                Loading…
              </div>
            ) : (
              messages.map((m) => {
                if (m.from === 'system') {
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                      <div style={{
                        fontSize: 10, color: '#94A3B8', background: 'rgba(30,41,59,0.7)',
                        border: '1px solid rgba(148,163,184,0.2)', borderRadius: 99,
                        padding: '4px 12px', maxWidth: '90%', textAlign: 'center',
                      }}>
                        {m.text}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                      {m.from === 'bot' && m.author_name && (
                        <span style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2, paddingLeft: 4 }}>{m.author_name}</span>
                      )}
                      <div style={{
                        padding: '8px 10px', borderRadius: 14, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                        background: m.from === 'user' ? primaryColor : 'rgba(15,23,42,0.9)',
                        color: m.from === 'user' ? '#111827' : '#E5E7EB',
                      }}>
                        {m.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {error && (
              <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 4 }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div
          style={{
            padding: '8px 10px 10px 10px',
            borderTop: '1px solid rgba(148,163,184,0.4)',
            background: 'rgba(15,23,42,0.96)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {showActions && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleYes}
                disabled={sending}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: '1px solid rgba(148,163,184,0.5)',
                  background: 'rgba(15,23,42,0.9)',
                  color: '#E5E7EB',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  opacity: sending ? 0.8 : 1,
                }}
              >
                Yes, solved
              </button>
              <button
                type="button"
                onClick={handleRaiseTicket}
                disabled={sending}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: 'none',
                  background: primaryColor,
                  color: '#111827',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  opacity: sending ? 0.8 : 1,
                }}
              >
                Raise ticket
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                view === 'tickets'
                  ? activeTicketId
                    ? 'Reply to this ticket...'
                    : 'Select a ticket to reply...'
                  : ended
                    ? 'Conversation ended'
                    : 'Ask a question...'
              }
              disabled={view === 'tickets' ? !activeTicketId : ended}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.5)',
                background: '#020617',
                color: '#E5E7EB',
                fontSize: 12,
                outline: 'none',
                opacity: ended ? 0.6 : 1,
              }}
            />
            <button
              type="button"
              disabled={sending || (view === 'bot' && ended) || (view === 'tickets' && !activeTicketId)}
              onClick={handleSend}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: 'none',
                background: primaryColor,
                color: '#111827',
                fontSize: 12,
                fontWeight: 600,
                cursor: sending || ended ? 'not-allowed' : 'pointer',
                opacity: sending || ended ? 0.8 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
