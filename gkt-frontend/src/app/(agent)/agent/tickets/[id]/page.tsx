'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ticketApi } from '@/lib/api/ticket.api';
import { onboardingApi } from '@/lib/api/onboarding.api';
import { gmailApi } from '@/lib/api/gmail.api';
import { useAuthStore } from '@/store/auth.store';
import { connectSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';

const RenderMarkdown = ({ text }: { text: string }) => {
  if (!text) return null;
  const createHtml = (str: string) => {
    let ht = str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    ht = ht.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    ht = ht.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    ht = ht.replace(/_([^_]+)_/g, "<em>$1</em>");
    ht = ht.replace(/^-\s/gm, "• ");
    return { __html: ht };
  };
  return <span dangerouslySetInnerHTML={createHtml(text)} />;
};

type Ticket = any;
type ConversationMessage = {
  id: string;
  from: 'user' | 'bot' | 'agent' | 'system';
  text: string;
  created_at?: string | Date;
  author_name?: string | null;
  is_internal?: boolean;
  attachments?: Array<{ filename: string; mime_type: string; size_bytes: number; base64: string }>;
};

export default function AgentTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hydrate, token } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [botMessages, setBotMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<'conversation' | 'details' | 'sla' | 'escalations'>('conversation');
  const socketRef = useRef<Socket | null>(null);
  const socketJoinedRef = useRef(false);
  const loadRef = useRef<() => Promise<void>>(async () => { });
  const refetchSuggestionsRef = useRef<() => void>(() => { });
  const hasMarkedOpenRef = useRef(false);
  const [nextEscalationAgents, setNextEscalationAgents] = useState<Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role?: string | null }>>([]);
  const [nextEscalationLoading, setNextEscalationLoading] = useState(false);
  const [escalationHistory, setEscalationHistory] = useState<Array<{ from_level: number; to_level: number; trigger_reason: string; triggered_by_name: string | null; created_at: string }>>([]);
  const [escalationHistoryLoading, setEscalationHistoryLoading] = useState(false);
  const [escalatedTo, setEscalatedTo] = useState<string | null>(null);
  const [conversationSummary, setConversationSummary] = useState<string | null>(null);
  const [conversationSummaryLoading, setConversationSummaryLoading] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [suggestedRepliesLoading, setSuggestedRepliesLoading] = useState(false);

  const [showBotTranscript, setShowBotTranscript] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const displayedMessages = useMemo(() => {
    if (!showBotTranscript) {
      return messages.filter(m => m.from !== 'system' && !m.is_internal);
    }
    
    const all = [...botMessages, ...messages].filter(m => m.from !== 'system' && !m.is_internal);
    
    const unique = [];
    const textSeen = new Set();
    
    for (const m of all) {
      if (!m.text) continue;
      const key = `${m.from}:${m.text.trim()}`;
      if (!textSeen.has(key)) {
        textSeen.add(key);
        unique.push(m);
      }
    }
    
    unique.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    return unique;
  }, [messages, botMessages, showBotTranscript]);

  const isDark = mounted && theme === 'dark';

  const pageBg = isDark
    ? 'linear-gradient(160deg,#020617 0%,#0a1628 40%,#020617 100%)'
    : 'linear-gradient(160deg,#EFF6FF 0%,#DBEAFE 30%,#F0F9FF 65%,#E0F2FE 100%)';
  const textPrimary = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentBlue = '#0EA5E9';
  const accentIndigo = '#6366F1';
  const cardBg = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.96)';
  const cardBorder = isDark ? 'rgba(148,163,184,0.28)' : 'rgba(147,197,253,0.8)';
  const pillBg = isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)';
  const pillBorder = isDark ? 'rgba(148,163,184,0.55)' : 'rgba(147,197,253,0.9)';

  const isReadOnly = (searchParams.get('readonly') || '').toLowerCase() === '1' || (searchParams.get('readonly') || '').toLowerCase() === 'true';

  const statusNorm = ticket ? String(ticket.status || 'new_ticket').toLowerCase().replace(/-/g, '_') : '';
  const isAssignedToMe = ticket?.assigned_to === user?.id;
  const isEscalatedByMe = ticket?.escalated_by === user?.id && !isAssignedToMe;

  const showStartInsteadOfReply = !isReadOnly && !escalatedTo && !isEscalatedByMe && (statusNorm === 'new_ticket' || statusNorm === 'open');
  const showReplyArea = !isReadOnly && !showStartInsteadOfReply && !escalatedTo && isAssignedToMe;
  const showResolvedComplete = !isReadOnly && (statusNorm === 'in_progress' || statusNorm === 'pending_user');
  const isOpenState = statusNorm === 'new_ticket' || statusNorm === 'open';
  const isClosedState = statusNorm === 'resolved' || statusNorm === 'closed';

  const nextEscDeadline = (ticket as any)?.next_escalation_at;
  const timeUntilEscalationMins = nextEscDeadline ? Math.max(0, Math.floor((new Date(nextEscDeadline).getTime() - Date.now()) / (60 * 1000))) : null;

  const canEscalateTo2 = user?.role === 'l1_agent' || user?.role === 'tenant_admin' || user?.role === 'super_admin';
  const canEscalateTo3 = user?.role === 'l2_agent' || user?.role === 'tenant_admin' || user?.role === 'super_admin';
  const canEscalateToAdmin = user?.role === 'l3_agent' || user?.role === 'tenant_admin' || user?.role === 'super_admin';

  const nextEscalationRole = useMemo(() => {
    const r = user?.role;
    if (r === 'l1_agent') return { role: 'l2_agent' as const, label: 'L2' };
    if (r === 'l2_agent') return { role: 'l3_agent' as const, label: 'L3' };
    if (r === 'l3_agent') return { role: 'tenant_admin' as const, label: 'Admin' };
    return null;
  }, [user?.role]);

  const deriveRequesterName = (createdBy: unknown): string => {
    const raw = (typeof createdBy === 'string' ? createdBy : String(createdBy || '')).trim();
    if (!raw) return 'there';
    if (!raw.includes('@')) {
      const cleaned = raw.replace(/\s+/g, ' ').trim();
      return cleaned || 'there';
    }
    const localPart = raw.split('@')[0] || '';
    const cleanedLocal = localPart.replace(/[._-]+/g, ' ').trim();
    if (!cleanedLocal) return 'there';
    return cleanedLocal
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  useEffect(() => {
    if (!nextEscalationRole) {
      setNextEscalationAgents([]);
      return;
    }
    const tpId = ticket?.tenant_product_id;
    let cancelled = false;
    setNextEscalationLoading(true);
    onboardingApi
      .getAgents()
      .then((list: any[]) => {
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        const filtered =
          nextEscalationRole.role === 'tenant_admin'
            ? arr.filter((a: any) => a.role === 'tenant_admin')
            : arr.filter(
              (a: any) =>
                a.role === nextEscalationRole.role &&
                Array.isArray(a.assigned_products) &&
                (tpId && a.assigned_products.some((p: any) => p && p.id === tpId))
            );
        setNextEscalationAgents(filtered);
      })
      .catch(() => {
        if (!cancelled) setNextEscalationAgents([]);
      })
      .finally(() => {
        if (!cancelled) setNextEscalationLoading(false);
      });
    return () => { cancelled = true; };
  }, [ticket?.tenant_product_id, nextEscalationRole?.role]);

  useEffect(() => {
    if (tab !== 'escalations' || !id) return;
    let cancelled = false;
    setEscalationHistoryLoading(true);
    ticketApi
      .getEscalationHistory(id)
      .then((res: any) => {
        if (cancelled) return;
        setEscalationHistory(Array.isArray(res?.data?.items) ? res.data.items : []);
      })
      .catch(() => {
        if (!cancelled) setEscalationHistory([]);
      })
      .finally(() => {
        if (!cancelled) setEscalationHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, tab]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const tRes = await ticketApi.get(id);
      setTicket(tRes.data);
      const convRes = await ticketApi.getConversation(id);
      const conv = (convRes.data?.messages as any[]) || [];
      setMessages(
        conv.map((m: any) => ({
          id: String(m.id),
          from: (m.from === 'bot' || m.from === 'user' || m.from === 'agent' || m.from === 'system' ? m.from : 'agent') as
            | 'user'
            | 'bot'
            | 'agent'
            | 'system',
          text: String(m.text || ''),
          is_internal: m.is_internal || false,
          created_at: m.created_at,
          author_name: m.author_name ?? null,
          attachments: Array.isArray(m.attachments) ? m.attachments : [],
        })),
      );

      const botRes = await ticketApi.getBotConversation(id);
      const botConv = (botRes.data?.messages as any[]) || [];
      setBotMessages(
        botConv.map((m: any) => ({
          id: String(m.id),
          from: (m.from === 'bot' || m.from === 'user' || m.from === 'agent' || m.from === 'system' ? m.from : 'agent') as
            | 'user'
            | 'bot'
            | 'agent'
            | 'system',
          text: String(m.text || ''),
          is_internal: m.is_internal || false,
          created_at: m.created_at,
          author_name: m.author_name ?? null,
          attachments: Array.isArray(m.attachments) ? m.attachments : [],
        })),
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  // Keep loadRef in sync so socket callbacks always call the latest version
  loadRef.current = load;

  const refreshEmailThread = async () => {
    setLoading(true);
    setError('');
    try {
      // 1) Sync from Gmail into Mongo (best-effort)
      await gmailApi.syncTicketThread(String(id));
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to sync Gmail thread';
      // Show a clear message if OAuth not completed.
      setError(msg);
    }
    // 2) Reload ticket + conversation (from our DB/Mongo)
    await load();
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    load();
    hasMarkedOpenRef.current = false;
    setConversationSummary(null);
    setSuggestedReplies([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Always fetch conversation summary when ticket is loaded (show for all statuses)
  useEffect(() => {
    if (!id || !ticket || loading) return;
    let cancelled = false;
    setConversationSummaryLoading(true);
    ticketApi
      .getConversationSummary(id)
      .then((res) => {
        if (!cancelled && res.data?.summary) setConversationSummary(res.data.summary);
      })
      .catch(() => {
        if (!cancelled) setConversationSummary(null);
      })
      .finally(() => {
        if (!cancelled) setConversationSummaryLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, ticket?.id, loading, messages.length]);

  // Fetch AI suggested replies when ticket page is open and after each conversation update (e.g. chatbot response)
  const refetchSuggestions = () => {
    if (!id) return;
    setSuggestedRepliesLoading(true);
    ticketApi
      .getAiSuggestions(id)
      .then((res) => {
        if (Array.isArray(res.data?.replies)) setSuggestedReplies(res.data.replies);
        else setSuggestedReplies([]);
      })
      .catch(() => setSuggestedReplies([]))
      .finally(() => setSuggestedRepliesLoading(false));
  };
  refetchSuggestionsRef.current = refetchSuggestions;

  useEffect(() => {
    if (!id || !ticket || loading) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchSuggestions = () => {
      setSuggestedRepliesLoading(true);
      ticketApi
        .getAiSuggestions(id)
        .then((res) => {
          if (cancelled) return;
          const replies = Array.isArray(res.data?.replies) ? res.data.replies : [];
          if (replies.length > 0) {
            setSuggestedReplies(replies);
          } else {
            // Retry once after 3 s if we got an empty list
            retryTimer = setTimeout(() => {
              if (cancelled) return;
              ticketApi.getAiSuggestions(id)
                .then((r2) => { if (!cancelled) setSuggestedReplies(Array.isArray(r2.data?.replies) ? r2.data.replies : []); })
                .catch(() => { if (!cancelled) setSuggestedReplies([]); });
            }, 3000);
          }
        })
        .catch(() => { if (!cancelled) setSuggestedReplies([]); })
        .finally(() => { if (!cancelled) setSuggestedRepliesLoading(false); });
    };

    fetchSuggestions();
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [id, ticket?.id, loading, messages.length]);

  // When agent opens the ticket and it's still new, mark as "open" so status counts are correct
  useEffect(() => {
    if (isReadOnly || !ticket || loading) return;
    const s = String(ticket.status || '').toLowerCase().replace(/-/g, '_');
    if (s === 'new_ticket' && !hasMarkedOpenRef.current) {
      hasMarkedOpenRef.current = true;
      ticketApi
        .updateStatus(id, 'open')
        .then(() => load())
        .catch(() => { });
    }
  }, [ticket?.id, ticket?.status, loading, isReadOnly, id]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // WebSocket: join ticket room when in_progress/pending_user, leave on close/resolve/escalate
  useEffect(() => {
    const activeStatuses = ['in_progress', 'pending_user'];
    // Also stop when this agent has escalated the ticket to someone else
    const isActive = activeStatuses.includes(statusNorm) && !escalatedTo;

    if (!isActive || isReadOnly || !token || !id) {
      // Leave room if we were previously joined (e.g. ticket resolved/closed or escalated)
      if (socketJoinedRef.current && socketRef.current) {
        socketRef.current.emit('leave:ticket', id);
        socketRef.current.off('ticket:message');
        socketRef.current.off('ticket:closed');
        socketJoinedRef.current = false;
      }
      return;
    }

    // Already joined this ticket room — nothing to do
    if (socketJoinedRef.current) return;

    const sock = connectSocket(token);
    socketRef.current = sock;
    sock.emit('join:ticket', id);
    socketJoinedRef.current = true;

    sock.on('ticket:message', (data: any) => {
      const from = String(data.from || '');
      // Reload conversation for external messages (user/bot) or internal notes from other sessions
      if (from === 'user' || from === 'bot' || from === 'agent_internal') {
        loadRef.current().then(() => {
          if (from === 'user' || from === 'bot') {
            refetchSuggestionsRef.current();
          }
        });
      }
    });

    sock.on('ticket:closed', () => {
      // Thank-you message was added and conversation closed; refresh to show it and leave room
      loadRef.current();
    });

    return () => {
      if (socketRef.current && socketJoinedRef.current) {
        socketRef.current.emit('leave:ticket', id);
        socketRef.current.off('ticket:message');
        socketRef.current.off('ticket:closed');
        socketJoinedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, statusNorm, isReadOnly, token, escalatedTo]);

  const addComment = async () => {
    if (isReadOnly) return;
    const text = reply.trim();
    if (!text) return;
    setSaving(true);
    setError('');
    try {
      const res = await ticketApi.addComment(id, text, isInternal);
      const data = res?.data as { email_sent?: boolean; gmail_thread_id?: string | null } | undefined;
      setReply('');
      setIsInternal(false);

      // When the reply was sent via Gmail, auto-sync the thread so the UI
      // immediately shows the actual sent message fetched from the Gmail thread.
      if (isWebForm && data?.email_sent === true && data?.gmail_thread_id) {
        setSyncing(true);
        try {
          await gmailApi.syncTicketThread(String(id));
        } catch {
          // Non-fatal: thread sync failed, conversation will still reload from local store
        } finally {
          setSyncing(false);
        }
      } else if (isWebForm && data?.email_sent === false) {
        setError('Comment saved, but email could not be sent. Check SendGrid/Gmail config and logs.');
      }

      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add comment');
    } finally {
      setSaving(false);
    }
  };

  const addInternalNote = async () => {
    if (isReadOnly) return;
    const text = internalNoteText.trim();
    if (!text) return;
    setSaving(true);
    setError('');
    try {
      await ticketApi.addComment(id, text, true);
      setInternalNoteText('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add internal note');
    } finally {
      setSaving(false);
    }
  };

  const assignToMe = async () => {
    if (isReadOnly) return;
    setSaving(true);
    setError('');
    try {
      await ticketApi.assign(id, user?.id || '');
      // Also transition to in_progress to trigger WebSocket connection
      await ticketApi.updateStatus(id, 'in_progress');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: string) => {
    if (isReadOnly) return;
    setSaving(true);
    setError('');
    try {
      await ticketApi.updateStatus(id, status);
      if (status === 'resolved' || status === 'closed') {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7']
        });
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const refreshEscalationHistory = () => {
    ticketApi.getEscalationHistory(id).then((r: any) => setEscalationHistory(Array.isArray(r?.data?.items) ? r.data.items : [])).catch(() => { });
  };

  const escalate = async (level: number) => {
    if (isReadOnly) return;
    setSaving(true);
    setError('');
    try {
      await ticketApi.update(id, { escalation_level: level });
      await load();
      refreshEscalationHistory();
      setEscalatedTo(`L${level}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to escalate');
    } finally {
      setSaving(false);
    }
  };

  const escalateToAgent = async (level: number, agentId: string) => {
    if (isReadOnly) return;
    setSaving(true);
    setError('');
    try {
      await ticketApi.update(id, { escalation_level: level, assigned_to: agentId });
      // Resolve agent name from the list for the banner
      const agent = nextEscalationAgents.find((a) => a.id === agentId);
      const agentName = agent
        ? ([agent.first_name, agent.last_name].filter(Boolean).join(' ').trim() || agent.email || 'agent')
        : 'agent';
      await load();
      refreshEscalationHistory();
      setEscalatedTo(agentName);
    } catch (e: any) {
      setError(e?.message || 'Failed to escalate');
    } finally {
      setSaving(false);
    }
  };

  const formatMs = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatMsOverdue = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const sla = useMemo(() => {
    const deadline = ticket?.sla_deadline ? new Date(ticket.sla_deadline) : null;
    const createdAt = ticket?.created_at ? new Date(ticket.created_at) : null;

    if (!deadline) return { label: 'No SLA', color: '#94A3B8', msLeft: null as number | null, timeText: 'No SLA deadline set', progress: 0 };

    const now = Date.now();
    const msLeft = deadline.getTime() - now;
    const totalSlaMs = createdAt ? deadline.getTime() - createdAt.getTime() : 24 * 3600 * 1000;
    const elapsedMs = createdAt ? now - createdAt.getTime() : 0;
    const progress = totalSlaMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalSlaMs) * 100)) : 0;

    const breached = ticket?.sla_breached || msLeft <= 0;
    if (breached) {
      const overdueMs = Math.abs(msLeft);
      const timeText = overdueMs < 60_000 ? 'Just breached' : `Breached (${formatMsOverdue(overdueMs)} ago)`;
      return { label: 'Breached', color: '#FCA5A5', msLeft, timeText, progress: 100 };
    }
    if (msLeft <= 30 * 60 * 1000) return { label: 'Due soon', color: '#FACC15', msLeft, timeText: `${formatMs(msLeft)} left`, progress };
    return { label: 'On track', color: '#4ADE80', msLeft, timeText: `${formatMs(msLeft)} left`, progress };
  }, [ticket?.sla_deadline, ticket?.sla_breached, ticket?.created_at]);

  const hasFirstResponse = useMemo(() => {
    return messages.some(m => m.from === 'agent');
  }, [messages]);

  const ticketAge = useMemo(() => {
    if (!ticket?.created_at) return '—';
    const diff = Date.now() - new Date(ticket.created_at).getTime();
    return formatMs(diff);
  }, [ticket?.created_at]);

  if (!mounted || loading) {
    return (
      <div
        style={{
          color: textSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 0',
          fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif',
        }}
      >
        Loading…
      </div>
    );
  }

  if (!ticket) {
    return (
      <div
        style={{
          color: textPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 0',
          fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif',
        }}
      >
        <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${cardBorder}`, background: cardBg }}>
          <div style={{ marginBottom: 10 }}>Ticket not found.</div>
          <Link href="/agent/queue" style={{ color: accentBlue, fontWeight: 600 }}>
            Back to queue
          </Link>
        </div>
      </div>
    );
  }

  const isWebForm = String(ticket.source || '').toLowerCase() === 'web_form';
  const fromAddress =
    (isWebForm && (ticket.agent_email as string | undefined)) ||
    (isWebForm && (ticket.product?.email_sender_address as string | undefined)) ||
    (user?.email as string | undefined) ||
    '—';

  const requesterName = deriveRequesterName(ticket.created_by);
  const supportBrand =
    (ticket.product && ((ticket.product as any).display_name || (ticket.product as any).name)) ||
    ((ticket as any).tenant_name as string | undefined) ||
    'Support';

  const agentSignatureName = (() => {
    const u = user as any;
    const fullName = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (typeof user?.email === 'string' && user.email.includes('@')) return user.email.split('@')[0] || supportBrand;
    return supportBrand;
  })();

  const insertWebFormTemplate = () => {
    const base =
      `Hi ${requesterName},\n\n` +
      `\n` +
      `Regards,\n` +
      `${agentSignatureName}`;
    setReply((prev) => {
      const p = String(prev || '');
      if (!p.trim()) return base;
      const hasHi = /^\s*hi\s+/i.test(p);
      const hasRegards = /\n\s*regards\s*,?\s*\n/i.test(p);
      if (!hasHi && !hasRegards) {
        return `Hi ${requesterName},\n\n${p.trim()}\n\nRegards,\n${agentSignatureName}`;
      }
      if (!hasRegards) {
        return `${p.trim()}\n\nRegards,\n${agentSignatureName}`;
      }
      return p;
    });
  };

  const priority = String(ticket.priority || 'p2').toLowerCase();
  const isP1 = priority === 'p1';
  const role = typeof user?.role === 'string' ? user.role.toLowerCase() : '';
  const isL1 = role === 'l1_agent';
  const isL2 = role === 'l2_agent';
  const isL3 = role === 'l3_agent';
  const isAdmin = role === 'tenant_admin' || role === 'super_admin';
  const canAssignToMe =
    isAdmin || (isP1 ? isL3 : (isL1 || isL2 || isL3));
  const assignToMeReason = canAssignToMe
    ? null
    : isP1
      ? 'P1 tickets can only be assigned to L3 agents.'
      : 'Non-P1 tickets can only be assigned to L1/L2/L3 agents.';

  const chip = (label: string, value: string, bg: string, fg: string) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: bg,
        color: fg,
        border: '1px solid rgba(148,163,184,0.25)',
      }}
    >
      <span style={{ opacity: 0.8 }}>{label}</span>
      <span>{value}</span>
    </span>
  );

  return (
    <div style={{ color: textPrimary }}>
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>

        {/* Mockup-style Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 950, color: textPrimary, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ticket.ticket_number} — {ticket.subject}
            </div>
            {isAssignedToMe && (ticket as any).escalated_by_name && (ticket as any).escalated_by !== user?.id && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {chip('Escalated by', String((ticket as any).escalated_by_name), isDark ? 'rgba(245,158,11,0.14)' : 'rgba(251,191,36,0.18)', isDark ? '#FCD34D' : '#92400E')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {isAssignedToMe && !isReadOnly && (
              <>
                {nextEscalationRole && (
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        if (val === 'general') {
                          escalate(nextEscalationRole.label === 'L2' ? 2 : nextEscalationRole.label === 'L3' ? 3 : 4);
                        } else {
                          escalateToAgent(nextEscalationRole.label === 'L2' ? 2 : nextEscalationRole.label === 'L3' ? 3 : 4, val);
                        }
                        e.target.value = ''; // Reset select
                      }}
                      disabled={saving || (nextEscalationLoading && nextEscalationAgents.length === 0)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: `1px solid ${cardBorder}`,
                        background: isDark ? 'rgba(15,23,42,0.8)' : '#FFF',
                        color: textPrimary,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 800,
                        outline: 'none',
                        appearance: 'none',
                        paddingRight: '32px',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='${encodeURIComponent(textSecondary)}'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='C19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                        backgroundSize: '16px',
                      }}
                    >

                      <option value="general">Escalate to {nextEscalationRole.label} Queue</option>
                      {nextEscalationAgents.length > 0 && (
                        <optgroup label={`Available ${nextEscalationRole.label} Agents`}>
                          {nextEscalationAgents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.first_name || a.last_name ? [a.first_name, a.last_name].filter(Boolean).join(' ') : a.email}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {nextEscalationLoading && nextEscalationAgents.length === 0 && (
                      <span style={{ fontSize: 10, color: textSecondary, position: 'absolute', bottom: -14, left: 4 }}>Loading agents...</span>
                    )}
                  </div>
                )}


                <button style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer', fontSize: 20 }}>⋮</button>
              </>
            )}
          </div>
        </div>

        {/* Sub-header Metadata Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: textSecondary, fontWeight: 600 }}>{ticket.ticket_number}</span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', color: '#93C5FD', fontSize: 11, fontWeight: 800 }}>
              {Number(ticket.escalation_level || 0) === 4 ? 'Admin' : `L${Number(ticket.escalation_level || 0)}`}
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(234,179,8,0.15)', color: '#FACC15', fontSize: 11, fontWeight: 800 }}>
              {String(ticket.priority || 'p2').toUpperCase()}
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(148,163,184,0.12)', color: textPrimary, fontSize: 11, fontWeight: 800 }}>
              {String(ticket.status || 'open').replace('_', ' ').charAt(0).toUpperCase() + String(ticket.status || 'open').replace('_', ' ').slice(1)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: textSecondary, fontWeight: 600 }}>
            Age: {ticketAge}
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background: 'rgba(248,113,113,0.12)',
              color: '#B91C1C',
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Main 2-column Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }}>
          {/* Left Column Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* TICKET DETAILS Card */}
            <div style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, background: cardBg, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: textSecondary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ticket Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 12, alignItems: 'center', fontSize: 13 }}>
                <div style={{ color: textSecondary }}>Product</div>
                <div style={{ fontWeight: 700, color: textPrimary }}>
                  {(ticket as any).tenant_product?.name || '—'}
                </div>

                <div style={{ color: textSecondary }}>Source</div>
                <div>
                  <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.1)', color: '#93C5FD', fontWeight: 700, fontSize: 11 }}>
                    {ticket.source}
                  </span>
                </div>

                <div style={{ color: textSecondary }}>Priority</div>
                <div>
                  <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(234,179,8,0.15)', color: '#FACC15', fontWeight: 700, fontSize: 11 }}>
                    {String(ticket.priority || 'p2').toUpperCase()}
                  </span>
                </div>

                <div style={{ color: textSecondary }}>Created</div>
                <div style={{ fontWeight: 600, color: textPrimary }}>
                  {ticket.created_at ? new Date(ticket.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>

                {nextEscalationRole && nextEscDeadline && (
                  <>
                    <div style={{ color: textSecondary }}>Escalation Due</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontWeight: 700, color: timeUntilEscalationMins !== null && timeUntilEscalationMins < 30 ? '#F87171' : '#A855F7', fontSize: 13 }}>
                        {new Date(nextEscDeadline).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: 10, color: textSecondary, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                        Auto-jumps to {nextEscalationRole.label} if not resolved
                      </div>
                    </div>
                  </>
                )}

                <div style={{ color: textSecondary }}>Status</div>
                <div>
                  <select
                    value={ticket.status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    disabled={saving}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 10,
                      border: `1px solid ${cardBorder}`,
                      background: isDark ? 'rgba(15,23,42,0.8)' : '#FFF',
                      color: textPrimary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pending_user">Pending User</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {/* AI Tags Section */}
                {ticket.category && (
                  <>
                    <div style={{ color: textSecondary }}>AI Category</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(168,85,247,0.1)', color: '#D8B4FE', fontWeight: 700, fontSize: 11 }}>
                        {ticket.category}
                      </span>
                      {ticket.sub_category && (
                        <span style={{ padding: '3px 10px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: textSecondary, fontWeight: 700, fontSize: 11 }}>
                          {ticket.sub_category}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {ticket.department && (
                  <>
                    <div style={{ color: textSecondary }}>Department</div>
                    <div>
                      <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', fontWeight: 700, fontSize: 11 }}>
                        {ticket.department}
                      </span>
                    </div>
                  </>
                )}

                {ticket.sentiment && (
                  <>
                    <div style={{ color: textSecondary }}>Sentiment</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: ticket.sentiment === 'critical' || ticket.sentiment === 'frustrated' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          color: ticket.sentiment === 'critical' || ticket.sentiment === 'frustrated' ? '#FCA5A5' : '#6EE7B7',
                          fontWeight: 700,
                          fontSize: 11,
                          textTransform: 'capitalize'
                        }}
                      >
                        {ticket.sentiment}
                      </span>
                      {ticket.sentiment_trend && (
                        <span style={{ fontSize: 11, color: textSecondary }}>
                          Trend: <span style={{ color: ticket.sentiment_trend === 'worsening' ? '#FCA5A5' : '#6EE7B7', fontWeight: 700 }}>{ticket.sentiment_trend}</span>
                        </span>
                      )}
                    </div>
                  </>
                )}

                {ticket.ai_confidence !== null && (
                  <>
                    <div style={{ color: textSecondary }}>AI Confidence</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(ticket.ai_confidence || 0) * 100}%`, height: '100%', background: (ticket.ai_confidence || 0) > 0.8 ? '#10B981' : '#F59E0B' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: textSecondary }}>{Math.round((ticket.ai_confidence || 0) * 100)}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* CONVERSATION / TRANSCRIPT Card */}
            <div style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, background: cardBg, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 16px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {showBotTranscript ? 'Full Conversation' : (isWebForm ? 'Email Thread' : 'Transcript')}
                </div>
                <button
                  onClick={() => setShowBotTranscript(!showBotTranscript)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: showBotTranscript ? 'rgba(59,130,246,0.1)' : 'transparent',
                    border: `1px solid ${showBotTranscript ? 'rgba(59,130,246,0.3)' : cardBorder}`,
                    color: showBotTranscript ? accentBlue : textSecondary,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: showBotTranscript ? accentBlue : textSecondary }} />
                  {showBotTranscript ? 'Showing Full Chat' : 'Show Bot Chat'}
                </button>
              </div>

              <div
                ref={scrollRef}
                style={{
                  height: 450,
                  overflowY: 'auto',
                  padding: '0 16px 16px 16px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayedMessages.map((m, idx) => {
                      const isAgent = m.from === 'agent';
                      const isBot = m.from === 'bot';
                      const isCustomer = m.from === 'user';
                      const bubbleBg = isAgent
                        ? (isDark ? 'rgba(250,204,21,0.15)' : '#FEF9C3')
                        : isBot
                          ? (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)')
                          : (isDark ? 'rgba(30,41,59,0.5)' : '#F1F5F9');
                      const bubbleBorder = isAgent
                        ? (isDark ? 'rgba(250,204,21,0.3)' : '#FEF08A')
                        : isBot
                          ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.25)')
                          : (isDark ? 'rgba(148,163,184,0.2)' : '#E2E8F0');

                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isAgent ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            alignSelf: isAgent ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <div style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: textSecondary,
                            marginBottom: 4,
                            display: 'flex',
                            gap: 6,
                            flexDirection: isAgent ? 'row-reverse' : 'row'
                          }}>
                            <span>
                              {m.author_name || (isAgent ? 'Support' : isBot ? 'Bot' : isCustomer ? 'Customer' : 'Customer')}
                            </span>
                            <span style={{ opacity: 0.6 }}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isAgent ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                            background: bubbleBg,
                            border: `1px solid ${bubbleBorder}`,
                            color: textPrimary,
                            fontSize: 13,
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}>
                            <RenderMarkdown text={m.text} />
                            {Array.isArray((m as any).attachments) && (m as any).attachments.length > 0 && (
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                                {(m as any).attachments.map((a: any, i: number) => (
                                  <a
                                    key={`${a.filename || 'image'}-${i}`}
                                    href={`data:${a.mime_type};base64,${a.base64}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display: 'block', borderRadius: 12, overflow: 'hidden', border: `1px solid ${bubbleBorder}` }}
                                    title={a.filename || 'attachment'}
                                  >
                                    <img
                                      src={`data:${a.mime_type};base64,${a.base64}`}
                                      alt={a.filename || 'attachment'}
                                      style={{ width: 220, height: 140, objectFit: 'cover', display: 'block' }}
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            {/* REPLY Card */}
            {!isClosedState && (
              <div style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, background: cardBg, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Reply
                </div>

                {/* AI Suggested Block */}
                {suggestedReplies.length > 0 && showReplyArea && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(239,246,255,0.7)',
                    border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(191,219,254,0.5)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: accentBlue, textTransform: 'uppercase' }}>AI Suggested Reply</div>
                    <div style={{ fontSize: 13, color: textPrimary, lineHeight: 1.5 }}>
                      {suggestedReplies[0]}
                    </div>
                    <button
                      onClick={() => setReply(suggestedReplies[0])}
                      style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 8, border: `1px solid ${accentBlue}`, background: 'transparent', color: accentBlue, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                    >
                      Use this reply
                    </button>
                  </div>
                )}

                {escalatedTo || isEscalatedByMe ? (
                  <div style={{
                    padding: '24px',
                    borderRadius: 12,
                    background: isDark ? 'rgba(59,130,246,0.05)' : '#F8FAFC',
                    border: `1px solid ${cardBorder}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    color: textSecondary
                  }}>
                    <div style={{ fontSize: 24 }}>📤</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: textPrimary }}>Ticket Escalated</div>
                    <div style={{ fontSize: 13 }}>
                      {escalatedTo ? `This ticket has been moved to ${escalatedTo}` : 'This ticket has been escalated to another tier/agent.'}
                    </div>
                  </div>
                ) : showReplyArea ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {isWebForm && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={insertWebFormTemplate}
                          disabled={saving}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 10,
                            border: `1px solid ${cardBorder}`,
                            background: 'transparent',
                            color: textSecondary,
                            fontWeight: 800,
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          Insert template
                        </button>
                      </div>
                    )}
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={4}
                      placeholder="Custom reply..."
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${cardBorder}`,
                        background: isDark ? '#020617' : '#FFF',
                        color: textPrimary,
                        fontSize: 13,
                        resize: 'none',
                        outline: 'none'
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      {showResolvedComplete && (
                        <>
                          <button type="button" onClick={() => setStatus('resolved')} disabled={saving}
                            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid rgba(74,222,128,0.5)`, background: 'transparent', color: '#4ADE80', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                            Resolved
                          </button>
                          <button type="button" onClick={() => setStatus('closed')} disabled={saving}
                            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${cardBorder}`, background: 'transparent', color: textSecondary, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                            Complete
                          </button>
                        </>
                      )}
                      <button type="button" onClick={addComment} disabled={saving}
                        style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: '#FACC15', color: '#0F172A', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
                        {saving ? 'Sending…' : isWebForm ? 'Send email' : 'Send'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={assignToMe}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 12,
                      background: isDark ? 'rgba(234,179,8,0.1)' : '#FFFBEB',
                      border: '1px solid #FEF3C7',
                      color: '#D97706',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = isDark ? 'rgba(234,179,8,0.15)' : '#FEF3C7';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = isDark ? 'rgba(234,179,8,0.1)' : '#FFFBEB';
                    }}
                  >
                    {saving ? 'Assigning...' : 'Start working on this ticket to reply'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* RESOLUTION SLA Card */}
            <div style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, background: cardBg, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: textSecondary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resolution SLA
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: textSecondary }}>First response</span>
                  <span style={{ color: hasFirstResponse ? '#4ADE80' : '#FACC15', fontWeight: 700 }}>{hasFirstResponse ? 'Met' : 'Pending'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: textSecondary }}>Resolution</span>
                  <span style={{ color: sla.color, fontWeight: 700 }}>{sla.timeText}</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${sla.progress}%`, height: '100%', background: sla.color }} />
                </div>
                <div style={{ fontSize: 11, color: textSecondary }}>
                  {Math.round(100 - sla.progress)}% time remaining · Due {ticket.sla_deadline ? new Date(ticket.sla_deadline).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'today'}
                </div>
              </div>
            </div>

            {/* TIMELINE Card */}
            <div style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, background: cardBg, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: textSecondary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Timeline
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Created */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E', marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>Created via {ticket.source}</div>
                    <div style={{ fontSize: 11, color: textSecondary }}>
                      {ticket.created_at ? new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
                {/* Assigned */}
                {ticket.assigned_to_name && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>Assigned to {ticket.assigned_to_name}</div>
                      <div style={{ fontSize: 11, color: textSecondary }}>Ticket claimed</div>
                    </div>
                  </div>
                )}
                {/* Escalations */}
                {escalationHistory.map((entry, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>Level {entry.from_level} → {entry.to_level}</div>
                      <div style={{ fontSize: 11, color: textSecondary }}>{entry.created_at ? new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CHAT SUMMARY Card */}
            <div style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, background: cardBg, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Chat Summary
              </div>
              {conversationSummaryLoading ? (
                <div style={{ fontSize: 12, color: textSecondary }}>Generating summary…</div>
              ) : conversationSummary ? (
                <div style={{ fontSize: 13, color: textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  <RenderMarkdown text={conversationSummary} />
                </div>
              ) : (
                <div style={{ fontSize: 12, color: textSecondary, fontStyle: 'italic' }}>
                  No summary available yet.
                </div>
              )}
            </div>

            {/* INTERNAL NOTE Card */}
            <div style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, background: cardBg, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: textSecondary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Internal Notes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, maxHeight: 300, overflowY: 'auto' }}>
                {messages.filter(m => m.is_internal).map((m) => (
                  <div key={m.id} style={{ padding: '10px 12px', borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${cardBorder}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: accentBlue }}>{m.author_name || 'Agent'}</span>
                      <span style={{ fontSize: 10, color: textSecondary }}>{m.created_at ? new Date(m.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <div style={{ fontSize: 12, color: textPrimary, whiteSpace: 'pre-wrap' }}><RenderMarkdown text={m.text} /></div>
                  </div>
                ))}
                {messages.filter(m => m.is_internal).length === 0 && (
                  <div style={{ fontSize: 12, color: textSecondary, fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No internal notes yet.</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea
                  value={internalNoteText}
                  onChange={(e) => setInternalNoteText(e.target.value)}
                  rows={3}
                  placeholder="Internal note (not visible to user)..."
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 12,
                    border: `1px solid ${cardBorder}`,
                    background: isDark ? '#020617' : '#FFF',
                    color: textPrimary,
                    fontSize: 12,
                    resize: 'none',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={addInternalNote}
                  disabled={saving || !internalNoteText.trim()}
                  style={{ padding: '8px', borderRadius: 10, border: `1px solid ${cardBorder}`, background: '#FFF', color: textPrimary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  {saving ? 'Saving...' : 'Post note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

