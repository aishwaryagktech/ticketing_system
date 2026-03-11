'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ticketApi } from '@/lib/api/ticket.api';
import { useAuthStore } from '@/store/auth.store';

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
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<'conversation' | 'details' | 'sla' | 'escalations'>('conversation');
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const hasMarkedOpenRef = useRef(false);

  const isReadOnly = (searchParams.get('readonly') || '').toLowerCase() === '1' || (searchParams.get('readonly') || '').toLowerCase() === 'true';

  const statusNorm = ticket ? String(ticket.status || 'new_ticket').toLowerCase().replace(/-/g, '_') : '';
  const showStartInsteadOfReply = !isReadOnly && (statusNorm === 'new_ticket' || statusNorm === 'open');
  const showReplyArea = !isReadOnly && !showStartInsteadOfReply;
  const showResolvedComplete = !isReadOnly && (statusNorm === 'in_progress' || statusNorm === 'pending_user');

  const canEscalateTo2 = user?.role === 'l1_agent' || user?.role === 'tenant_admin' || user?.role === 'super_admin';
  const canEscalateTo3 = user?.role === 'l2_agent' || user?.role === 'tenant_admin' || user?.role === 'super_admin';

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

  // Poll conversation every 5s while on "conversation" tab
  useEffect(() => {
    if (tab !== 'conversation') {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
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
        // ignore polling errors, main load() handles user-visible errors
        console.warn('pollConversation failed:', e?.message || e);
      }
    }, 5000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [id, tab]);

  const addComment = async () => {
    if (isReadOnly) return;
    const text = reply.trim();
    if (!text) return;
    setSaving(true);
    setError('');
    try {
      await ticketApi.addComment(id, text, isInternal);
      setReply('');
      setIsInternal(false);
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

  const escalate = async (level: number) => {
    if (isReadOnly) return;
    setSaving(true);
    setError('');
    try {
      await ticketApi.update(id, { escalation_level: level });
      await load();
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
              {chip('Level', `L${Number(ticket.escalation_level || 0)}`, 'rgba(59,130,246,0.14)', '#93C5FD')}
              {chip('SLA', sla.label, 'rgba(148,163,184,0.12)', sla.color)}
              {ticket.tenant_product_id ? chip('Product', String(ticket.tenant_product_id).slice(0, 8) + '…', 'rgba(148,163,184,0.12)', '#E5E7EB') : null}
            </div>
          </div>

          {!isReadOnly && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={assignToMe}
                disabled={saving}
                style={{
                  padding: '9px 12px',
                  borderRadius: 999,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: 'rgba(15,23,42,0.75)',
                  color: '#E5E7EB',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Assign to me
              </button>
            </div>
          )}
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
                    {canEscalateTo2 && (
                      <button type="button" onClick={() => escalate(2)} disabled={saving} style={{ padding: '7px 10px', borderRadius: 999, border: 'none', background: 'rgba(59,130,246,0.85)', color: '#E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 950 }}>
                        Escalate L2
                      </button>
                    )}
                    {canEscalateTo3 && (
                      <button type="button" onClick={() => escalate(3)} disabled={saving} style={{ padding: '7px 10px', borderRadius: 999, border: 'none', background: 'rgba(168,85,247,0.85)', color: '#E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 950 }}>
                        Escalate L3
                      </button>
                    )}
                  </div>
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
                  <div style={{ padding: 12, borderTop: '1px solid rgba(148,163,184,0.2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={3}
                      placeholder="Write a reply or internal note…"
                      style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid rgba(148,163,184,0.25)', background: '#020617', color: '#E5E7EB', fontSize: 12, resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94A3B8' }}>
                        <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                        Internal note
                      </label>
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
                        <button type="button" onClick={addComment} disabled={saving} style={{ padding: '9px 14px', borderRadius: 999, border: 'none', background: '#FACC15', color: '#0F172A', cursor: 'pointer', fontSize: 12, fontWeight: 950 }}>
                          Send
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
                  <div style={{ color: '#E5E7EB', fontWeight: 900 }}>Current level: L{Number(ticket.escalation_level || 0)}</div>
                  <div style={{ marginTop: 6, color: '#94A3B8' }}>
                    Escalation history (manual + auto reasons) will appear here once we add audit logging.
                  </div>
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

