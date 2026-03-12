'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ticketApi } from '@/lib/api/ticket.api';
import { onboardingApi } from '@/lib/api/onboarding.api';
import { gmailApi } from '@/lib/api/gmail.api';
import { useAuthStore } from '@/store/auth.store';
import { connectSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

type Ticket = any;
type ConversationMessage = {
  id: string;
  from: 'user' | 'bot' | 'agent';
  text: string;
  created_at?: string | Date;
};

export default function AgentTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hydrate, token } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<'conversation' | 'details' | 'sla' | 'escalations'>('conversation');
  const socketRef = useRef<Socket | null>(null);
  const socketJoinedRef = useRef(false);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const hasMarkedOpenRef = useRef(false);
  const [nextEscalationAgents, setNextEscalationAgents] = useState<Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role?: string | null }>>([]);
  const [nextEscalationLoading, setNextEscalationLoading] = useState(false);
  const [escalationHistory, setEscalationHistory] = useState<Array<{ from_level: number; to_level: number; trigger_reason: string; triggered_by_name: string | null; created_at: string }>>([]);
  const [escalationHistoryLoading, setEscalationHistoryLoading] = useState(false);
  const [escalatedTo, setEscalatedTo] = useState<string | null>(null);

  const isReadOnly = (searchParams.get('readonly') || '').toLowerCase() === '1' || (searchParams.get('readonly') || '').toLowerCase() === 'true';

  const statusNorm = ticket ? String(ticket.status || 'new_ticket').toLowerCase().replace(/-/g, '_') : '';
  const showStartInsteadOfReply = !isReadOnly && !escalatedTo && (statusNorm === 'new_ticket' || statusNorm === 'open');
  const showReplyArea = !isReadOnly && !showStartInsteadOfReply && !escalatedTo;
  const showResolvedComplete = !isReadOnly && (statusNorm === 'in_progress' || statusNorm === 'pending_user');

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
          from: (m.from === 'bot' || m.from === 'user' || m.from === 'agent' ? m.from : 'agent') as
            | 'user'
            | 'bot'
            | 'agent',
          text: String(m.text || ''),
          created_at: m.created_at,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // When agent opens the ticket and it's still new, mark as "open" so status counts are correct
  useEffect(() => {
    if (isReadOnly || !ticket || loading) return;
    const s = String(ticket.status || '').toLowerCase().replace(/-/g, '_');
    if (s === 'new_ticket' && !hasMarkedOpenRef.current) {
      hasMarkedOpenRef.current = true;
      ticketApi
        .updateStatus(id, 'open')
        .then(() => load())
        .catch(() => {});
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
      // Leave room if we were previously joined
      if (socketJoinedRef.current && socketRef.current) {
        socketRef.current.emit('leave:ticket', id);
        socketRef.current.off('ticket:message');
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
      // Reload conversation for external messages (user/bot).
      // Agent's own replies are already refreshed by addComment → load().
      if (from === 'user' || from === 'bot') {
        loadRef.current();
      }
    });

    return () => {
      if (socketRef.current && socketJoinedRef.current) {
        socketRef.current.emit('leave:ticket', id);
        socketRef.current.off('ticket:message');
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

  const assignToMe = async () => {
    if (isReadOnly) return;
    setSaving(true);
    setError('');
    try {
      await ticketApi.assign(id, user?.id || '');
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
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const refreshEscalationHistory = () => {
    ticketApi.getEscalationHistory(id).then((r: any) => setEscalationHistory(Array.isArray(r?.data?.items) ? r.data.items : [])).catch(() => {});
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
    if (!deadline) return { label: 'No SLA', color: '#94A3B8', msLeft: null as number | null, timeText: 'No SLA deadline set' };
    const msLeft = deadline.getTime() - Date.now();
    const breached = ticket?.sla_breached || msLeft <= 0;
    if (breached) {
      const overdueMs = Math.abs(msLeft);
      const timeText = overdueMs < 60_000 ? 'Just breached' : `Breached (${formatMsOverdue(overdueMs)} ago)`;
      return { label: 'Breached', color: '#FCA5A5', msLeft, timeText };
    }
    if (msLeft <= 30 * 60 * 1000) return { label: 'Due soon', color: '#FACC15', msLeft, timeText: `Time left to solve: ${formatMs(msLeft)}` };
    return { label: 'On track', color: '#4ADE80', msLeft, timeText: `Time left to solve: ${formatMs(msLeft)}` };
  }, [ticket?.sla_deadline, ticket?.sla_breached]);

  if (loading) {
    return <div style={{ padding: 24, color: '#94A3B8' }}>Loading…</div>;
  }

  if (!ticket) {
    return (
      <div style={{ padding: 24, color: '#E5E7EB' }}>
        <div style={{ marginBottom: 10 }}>Ticket not found.</div>
        <Link href="/agent/dashboard" style={{ color: '#FACC15' }}>Back to inbox</Link>
      </div>
    );
  }

  const isWebForm = String(ticket.source || '').toLowerCase() === 'web_form';
  const fromAddress =
    (isWebForm && (ticket.agent_email as string | undefined)) ||
    (isWebForm && (ticket.product?.email_sender_address as string | undefined)) ||
    (user?.email as string | undefined) ||
    '—';

  const priority = String(ticket.priority || 'p2').toLowerCase();
  const isP1 = priority === 'p1';
  const role = typeof user?.role === 'string' ? user.role.toLowerCase() : '';
  const isL1 = role === 'l1_agent';
  const isL3 = role === 'l3_agent';
  const isAdmin = role === 'tenant_admin' || role === 'super_admin';
  const canAssignToMe =
    isAdmin || (isP1 ? isL3 : isL1);
  const assignToMeReason = canAssignToMe
    ? null
    : isP1
      ? 'P1 tickets can only be assigned to L3 agents.'
      : 'Non-P1 tickets can only be assigned to L1 agents.';

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
    <div style={{ minHeight: '100vh', background: '#020617', color: '#E5E7EB', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, \"Inter\", sans-serif' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: 16 }}>
        {/* Top header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 16,
            border: '1px solid rgba(148,163,184,0.25)',
            background: 'rgba(15,23,42,0.75)',
            marginBottom: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>
              <Link href="/agent/dashboard" style={{ color: '#94A3B8', textDecoration: 'none' }}>
                Inbox
              </Link>{' '}
              / {ticket.ticket_number}
            </div>
            <div style={{ fontSize: 18, fontWeight: 950, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ticket.subject}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {chip('Priority', String(ticket.priority || 'p2').toUpperCase(), 'rgba(250,204,21,0.18)', '#FACC15')}
              {chip('Status', String(ticket.status || 'new_ticket'), 'rgba(148,163,184,0.12)', '#E5E7EB')}
              {chip('Level', Number(ticket.escalation_level || 0) === 4 ? 'Admin' : `L${Number(ticket.escalation_level || 0)}`, 'rgba(59,130,246,0.14)', '#93C5FD')}
              {(ticket as any).escalated_by_name && chip('Escalated', `by ${(ticket as any).escalated_by_name}`, 'rgba(59,130,246,0.2)', '#93C5FD')}
              {chip('SLA', sla.label, 'rgba(148,163,184,0.12)', sla.color)}
              {ticket.tenant_product_id ? chip('Product', String(ticket.tenant_product_id).slice(0, 8) + '…', 'rgba(148,163,184,0.12)', '#E5E7EB') : null}
            </div>
          </div>

        </div>

        {error && (
          <div style={{ padding: 10, borderRadius: 12, background: 'rgba(248,113,113,0.12)', color: '#FCA5A5', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Workspace grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr) 340px', gap: 12 }}>
          {/* Left rail */}
          <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 16, background: 'rgba(15,23,42,0.65)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(148,163,184,0.2)', color: '#94A3B8', fontSize: 11, fontWeight: 800 }}>
              Workspace
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/agent/dashboard" style={{ textDecoration: 'none', color: '#E5E7EB', fontSize: 12, fontWeight: 800 }}>
                ← Back to queue
              </Link>
              <div style={{ padding: 10, borderRadius: 14, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(2,6,23,0.55)' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>SLA</div>
                <div style={{ fontSize: 13, fontWeight: 950, color: sla.color }}>{sla.label}</div>
                {sla.timeText && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#E5E7EB' }}>
                    {sla.timeText}
                  </div>
                )}
              </div>

              {!isReadOnly && (
                <div style={{ padding: 10, borderRadius: 14, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(2,6,23,0.55)' }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>Quick actions</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button type="button" onClick={() => setStatus('pending_user')} disabled={saving} style={{ padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.25)', background: '#020617', color: '#E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
                      Pending user
                    </button>
                    <button type="button" onClick={() => setStatus('resolved')} disabled={saving} style={{ padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.25)', background: '#020617', color: '#E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
                      Resolve
                    </button>
                    <button type="button" onClick={() => setStatus('closed')} disabled={saving} style={{ padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.25)', background: '#020617', color: '#E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
                      Close
                    </button>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {canEscalateTo2 && nextEscalationRole?.label !== 'L2' && !escalatedTo && (
                      <button type="button" onClick={() => escalate(2)} disabled={saving} style={{ padding: '7px 10px', borderRadius: 999, border: 'none', background: 'rgba(59,130,246,0.85)', color: '#E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 950 }}>
                        Escalate L2
                      </button>
                    )}
                    {canEscalateTo3 && nextEscalationRole?.label !== 'L3' && !escalatedTo && (
                      <button type="button" onClick={() => escalate(3)} disabled={saving} style={{ padding: '7px 10px', borderRadius: 999, border: 'none', background: 'rgba(168,85,247,0.85)', color: '#E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 950 }}>
                        Escalate L3
                      </button>
                    )}
                  </div>
                </div>
              )}

              {nextEscalationRole && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 14,
                    border: escalatedTo
                      ? '1px solid rgba(59,130,246,0.45)'
                      : '1px solid rgba(148,163,184,0.22)',
                    background: escalatedTo ? 'rgba(30,64,175,0.15)' : 'rgba(2,6,23,0.55)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                      Next escalation: {nextEscalationRole.label} — choose to escalate to:
                    </div>
                    {escalatedTo && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(59,130,246,0.25)',
                          color: '#93C5FD',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ✓ Escalated
                      </span>
                    )}
                  </div>
                  {nextEscalationRole.role !== 'tenant_admin' && !ticket?.tenant_product_id ? (
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                      Link ticket to a product to see agents for this product.
                    </div>
                  ) : nextEscalationLoading ? (
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Loading…</div>
                  ) : nextEscalationAgents.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                      {nextEscalationRole.role === 'tenant_admin'
                        ? 'No Admin users in this tenant.'
                        : `No ${nextEscalationRole.label} agents assigned to this product.`}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                      {nextEscalationAgents.map((a) => {
                        const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email || 'Agent';
                        const level = nextEscalationRole.role === 'l2_agent' ? 2 : nextEscalationRole.role === 'l3_agent' ? 3 : 4;
                        return (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#E5E7EB' }}>{name}</span>
                            {!isReadOnly && !escalatedTo && (
                              <button
                                type="button"
                                onClick={() => escalateToAgent(level, a.id)}
                                disabled={saving}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 999,
                                  border: 'none',
                                  background: nextEscalationRole.label === 'Admin' ? 'rgba(234,88,12,0.85)' : nextEscalationRole.label === 'L3' ? 'rgba(168,85,247,0.85)' : 'rgba(59,130,246,0.85)',
                                  color: '#E5E7EB',
                                  cursor: saving ? 'not-allowed' : 'pointer',
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                {saving ? 'Escalating…' : `Escalate to ${name}`}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Center panel */}
          <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 16, background: 'rgba(15,23,42,0.65)', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, padding: 10, borderBottom: '1px solid rgba(148,163,184,0.2)', flexWrap: 'wrap' }}>
              {([
                ['conversation', 'Conversation'],
                ['details', 'Details'],
                ['sla', 'SLA'],
                ['escalations', 'Escalations'],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.25)',
                    background: tab === k ? '#FACC15' : 'rgba(2,6,23,0.55)',
                    color: tab === k ? '#0F172A' : '#E5E7EB',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'conversation' && (
            <>
                {isWebForm && ticket.description && (
                  <div
                    style={{
                      padding: 12,
                      borderBottom: '1px solid rgba(148,163,184,0.25)',
                      background: 'rgba(15,23,42,0.9)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 800, marginBottom: 4 }}>
                        Original request
                      </div>
                      <button
                        type="button"
                        onClick={refreshEmailThread}
                        disabled={loading || saving}
                        title="Refresh email thread"
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: '1px solid rgba(148,163,184,0.25)',
                          background: loading || saving ? 'rgba(30,41,59,0.5)' : 'rgba(2,6,23,0.55)',
                          color: loading || saving ? '#64748B' : '#E5E7EB',
                          cursor: loading || saving ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        {loading ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#E5E7EB',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {ticket.description}
                    </div>
                  </div>
                )}
                <div
                  ref={scrollRef}
                  style={{
                    padding: 12,
                    height: 480,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    background: 'rgba(15,23,42,0.85)',
                  }}
                >
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: m.from === 'user' ? 'flex-start' : m.from === 'agent' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '76%',
                          padding: '8px 10px',
                          borderRadius: 14,
                          fontSize: 12,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          background:
                            m.from === 'agent'
                              ? '#FACC15'
                              : m.from === 'bot'
                                ? 'rgba(15,23,42,0.9)'
                                : 'rgba(30,64,175,0.9)',
                          color: m.from === 'agent' ? '#111827' : '#E5E7EB',
                          border: '1px solid rgba(15,23,42,0.6)',
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>

                {escalatedTo && (
                  <div
                    style={{
                      padding: '14px 16px',
                      borderTop: '1px solid rgba(59,130,246,0.35)',
                      background: 'rgba(30,64,175,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(59,130,246,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      ↑
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#93C5FD' }}>
                        Ticket escalated to {escalatedTo}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748B' }}>
                        This ticket has been handed off. Replies are disabled for your role.
                      </span>
                    </div>
                  </div>
                )}

                {showStartInsteadOfReply && (
                  <div style={{ padding: 20, borderTop: '1px solid rgba(148,163,184,0.2)', textAlign: 'center', background: 'rgba(15,23,42,0.6)' }}>
                    <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 14 }}>
                      Start working on this ticket to reply and add notes.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStatus('in_progress')}
                      disabled={saving}
                      style={{
                        padding: '12px 24px',
                        borderRadius: 12,
                        border: 'none',
                        background: '#FACC15',
                        color: '#0F172A',
                        cursor: saving ? 'default' : 'pointer',
                        fontSize: 14,
                        fontWeight: 900,
                      }}
                    >
                      {saving ? 'Starting…' : 'Start'}
                    </button>
                  </div>
                )}

                {showReplyArea && (
                  <div
                    style={{
                      padding: 12,
                      borderTop: '1px solid rgba(148,163,184,0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {isWebForm && (
                      <div
                        style={{
                          borderRadius: 12,
                          border: '1px solid rgba(148,163,184,0.35)',
                          background: '#020617',
                          padding: 10,
                          fontSize: 12,
                          color: '#E5E7EB',
                          display: 'grid',
                          gridTemplateColumns: '56px minmax(0, 1fr)',
                          rowGap: 4,
                          columnGap: 8,
                        }}
                      >
                        <div style={{ color: '#94A3B8', fontWeight: 700 }}>To</div>
                        <div style={{ fontWeight: 600 }}>{ticket.created_by || '—'}</div>
                        <div style={{ color: '#94A3B8', fontWeight: 700 }}>From</div>
                        <div style={{ fontWeight: 600 }}>{fromAddress}</div>
                        <div style={{ color: '#94A3B8', fontWeight: 700 }}>Subject</div>
                        <div style={{ fontWeight: 600 }}>
                          {`Re: ${ticket.ticket_number} - ${ticket.subject}`}
                        </div>
                      </div>
                    )}

                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={4}
                      placeholder={isWebForm ? 'Draft an email reply to the requester…' : 'Write a reply or internal note…'}
                      style={{
                        width: '100%',
                        padding: 10,
                        borderRadius: 12,
                        border: '1px solid rgba(148,163,184,0.25)',
                        background: '#020617',
                        color: '#E5E7EB',
                        fontSize: 12,
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      {!isWebForm ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94A3B8' }}>
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={(e) => setIsInternal(e.target.checked)}
                          />
                          Internal note
                        </label>
                      ) : (
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>
                          This reply will be sent as an email to the requester.
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {showResolvedComplete && (
                          <>
                            <button
                              type="button"
                              onClick={() => setStatus('resolved')}
                              disabled={saving}
                              style={{
                                padding: '8px 14px',
                                borderRadius: 999,
                                border: '1px solid rgba(74,222,128,0.6)',
                                background: 'rgba(74,222,128,0.2)',
                                color: '#4ADE80',
                                cursor: saving ? 'default' : 'pointer',
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              Resolved
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatus('closed')}
                              disabled={saving}
                              style={{
                                padding: '8px 14px',
                                borderRadius: 999,
                                border: '1px solid rgba(148,163,184,0.5)',
                                background: 'rgba(148,163,184,0.15)',
                                color: '#E5E7EB',
                                cursor: saving ? 'default' : 'pointer',
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              Complete
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={addComment}
                          disabled={saving}
                          style={{
                            padding: '9px 14px',
                            borderRadius: 999,
                            border: 'none',
                            background: '#FACC15',
                            color: '#0F172A',
                            cursor: saving ? 'default' : 'pointer',
                            fontSize: 12,
                            fontWeight: 950,
                          }}
                        >
                          {syncing ? 'Syncing thread…' : saving ? 'Sending…' : isWebForm ? 'Send email' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'details' && (
              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, fontSize: 12 }}>
                  {[
                    ['Ticket', ticket.ticket_number],
                    ['Status', ticket.status],
                    ['Priority', ticket.priority],
                    ['Source', ticket.source],
                    ['Created', ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'],
                    ['Updated', ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : '—'],
                    ['Assigned to', ticket.assigned_to || '—'],
                    ['Tenant product', ticket.tenant_product_id || '—'],
                    ['Escalation level', String(ticket.escalation_level)],
                    ...((ticket as any).escalated_by_name ? [['Escalated by', (ticket as any).escalated_by_name] as const] : []),
                  ].map(([k, v]) => (
                    <React.Fragment key={k}>
                      <div style={{ color: '#94A3B8', fontWeight: 800 }}>{k}</div>
                      <div style={{ color: '#E5E7EB', fontWeight: 700, whiteSpace: 'pre-wrap' }}>{String(v ?? '—')}</div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {tab === 'sla' && (
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 900, marginBottom: 10 }}>SLA overview</div>
                <div style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(2,6,23,0.55)' }}>
                  <div style={{ fontSize: 13, fontWeight: 950, color: sla.color }}>{sla.label}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: '#E5E7EB' }}>
                    Deadline: <span style={{ fontWeight: 900 }}>{ticket.sla_deadline ? new Date(ticket.sla_deadline).toLocaleString() : '—'}</span>
                  </div>
                  {sla.timeText && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#E5E7EB' }}>
                      {sla.timeText}
                    </div>
                  )}
                  <div style={{ marginTop: 10, fontSize: 12, color: '#94A3B8' }}>
                    {ticket.tenant_product_id
                      ? 'SLA is based on the policy for this product. Pause/resume and 75% warnings can be added later.'
                      : 'No product linked; set a product to use SLA policies. Pause/resume and 75% warnings can be added later.'}
                  </div>
                </div>
              </div>
            )}

            {tab === 'escalations' && (
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 900, marginBottom: 10 }}>Escalations</div>
                <div style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(2,6,23,0.55)', fontSize: 12 }}>
                  <div style={{ color: '#E5E7EB', fontWeight: 900 }}>
                    Current level: {Number(ticket.escalation_level || 0) === 4 ? 'Admin' : `L${Number(ticket.escalation_level || 0)}`}
                  </div>
                  {nextEscalationRole && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ color: '#94A3B8', fontWeight: 800, marginBottom: 6 }}>
                        {nextEscalationRole.label} (next in line)
                      </div>
                      {nextEscalationRole.role !== 'tenant_admin' && !ticket?.tenant_product_id ? (
                        <div style={{ color: '#94A3B8' }}>Link ticket to a product to see escalation agents.</div>
                      ) : nextEscalationAgents.length === 0 ? (
                        <div style={{ color: '#94A3B8' }}>
                          {nextEscalationRole.role === 'tenant_admin' ? 'No Admin users in this tenant.' : `No ${nextEscalationRole.label} agents assigned to this product.`}
                        </div>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 16, color: '#E5E7EB', lineHeight: 1.8 }}>
                          {nextEscalationAgents.map((a) => {
                            const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email || 'Agent';
                            return <li key={a.id}>{name}</li>;
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                  <div style={{ marginTop: 16, color: '#94A3B8', fontWeight: 800, marginBottom: 6 }}>Escalation history</div>
                  {escalationHistoryLoading ? (
                    <div style={{ color: '#94A3B8', fontSize: 12 }}>Loading…</div>
                  ) : escalationHistory.length === 0 ? (
                    <div style={{ color: '#94A3B8', fontSize: 12 }}>No escalations recorded yet. L1 → L2 → L3 → Admin path is tracked here.</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 16, color: '#E5E7EB', lineHeight: 2, listStyle: 'none' }}>
                      {escalationHistory.map((entry, idx) => {
                        const fromLabel = entry.from_level === 4 ? 'Admin' : `L${entry.from_level}`;
                        const toLabel = entry.to_level === 4 ? 'Admin' : `L${entry.to_level}`;
                        const by = entry.triggered_by_name ? ` by ${entry.triggered_by_name}` : '';
                        const date = entry.created_at ? new Date(entry.created_at).toLocaleString() : '';
                        return (
                          <li key={idx} style={{ borderLeft: '3px solid rgba(59,130,246,0.5)', paddingLeft: 10, marginBottom: 6 }}>
                            {fromLabel} → {toLabel}{by} — {date}
                            {entry.trigger_reason && entry.trigger_reason !== 'manual' && (
                              <span style={{ color: '#94A3B8', fontSize: 11 }}> ({entry.trigger_reason})</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 16, background: 'rgba(15,23,42,0.65)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(148,163,184,0.2)', color: '#94A3B8', fontSize: 11, fontWeight: 900 }}>
              Agent Assist
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(2,6,23,0.55)' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 900, marginBottom: 6 }}>SLA</div>
                <div style={{ fontSize: 14, fontWeight: 950, color: sla.color }}>{sla.label}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#E5E7EB' }}>
                  {ticket.sla_deadline ? `Deadline: ${new Date(ticket.sla_deadline).toLocaleString()}` : 'No deadline set'}
                </div>
                {sla.timeText && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#E5E7EB', fontWeight: 700 }}>
                    {sla.timeText}
                  </div>
                )}
              </div>

              <div style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(2,6,23,0.55)' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 900, marginBottom: 6 }}>Knowledge base</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  KB/RAG suggestions panel will show top matches and “Insert into reply”.
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(2,6,23,0.55)' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 900, marginBottom: 6 }}>AI suggested replies</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  Next: generate 2–3 drafts using past resolutions + KB context (phase 2).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

