'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ticketApi } from '@/lib/api/ticket.api';
import { agentApi } from '@/lib/api/agent.api';
import { useAuthStore } from '@/store/auth.store';

type TicketListItem = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  escalation_level: number;
  assigned_to: string | null;
  tenant_product_id: string | null;
  sla_deadline: string | null;
  sla_breached: boolean;
  updated_at: string;
  escalated_by?: string | null;
  escalated_by_name?: string | null;
};

const STATUS_ORDER = ['new_ticket', 'open', 'in_progress', 'pending_user', 'resolved', 'closed'] as const;
const STATUS_LABELS: Record<string, string> = {
  new_ticket: 'New',
  open: 'Open',
  in_progress: 'In progress',
  pending_user: 'Pending user',
  resolved: 'Resolved',
  closed: 'Closed',
};

export default function AgentDashboardPage() {
  const { user, clearAuth, hydrate } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleLogout = () => {
    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/login';
  };
  const [tenantProductId, setTenantProductId] = useState<string>('');
  const [products, setProducts] = useState<Array<{ id: string; name: string; support_level: string }>>([]);
  const [unassignedItems, setUnassignedItems] = useState<TicketListItem[]>([]);
  const [assignedItems, setAssignedItems] = useState<TicketListItem[]>([]);
  const [breachedItems, setBreachedItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ assigned: number; unassigned: number; breached: number }>({
    assigned: 0,
    unassigned: 0,
    breached: 0,
  });
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [pendingActionLoading, setPendingActionLoading] = useState(false);

  useEffect(() => {
    agentApi
      .myProducts()
      .then((res) => {
        const list = (res.data?.items as any[]) || [];
        const shaped = list
          .filter((x) => x && typeof x.id === 'string')
          .map((x) => ({ id: String(x.id), name: String(x.name || 'Product'), support_level: String(x.support_level || '') }));
        setProducts(shaped);
        if (!tenantProductId && shaped.length > 0) setTenantProductId(shaped[0].id);
      })
      .catch(() => {
        setProducts([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [allItemsForStatus, setAllItemsForStatus] = useState<TicketListItem[]>([]);

  const fetchAll = async () => {
    if (!tenantProductId) {
      setUnassignedItems([]);
      setAssignedItems([]);
      setBreachedItems([]);
      setAllItemsForStatus([]);
      setStats({ assigned: 0, unassigned: 0, breached: 0 });
      return;
    }
    setLoading(true);
    setStatsLoading(true);
    setError('');
    try {
      const base = { take: 50, tenant_product_id: tenantProductId };
      const baseAll = { take: 500, tenant_product_id: tenantProductId, assigned: 'me' };
      const [unassignedRes, assignedRes, breachedRes, allRes] = await Promise.all([
        ticketApi.list({ ...base, assigned: 'unassigned' }),
        ticketApi.list({ ...base, assigned: 'me' }),
        ticketApi.list({ ...base, sla_breached: 'true' }),
        ticketApi.list(baseAll),
      ]);
      setUnassignedItems((unassignedRes.data?.items as TicketListItem[]) || []);
      setAssignedItems((assignedRes.data?.items as TicketListItem[]) || []);
      setBreachedItems((breachedRes.data?.items as TicketListItem[]) || []);
      setAllItemsForStatus((allRes.data?.items as TicketListItem[]) || []);
      setStats({
        unassigned: (unassignedRes.data?.items || []).length,
        assigned: (assignedRes.data?.items || []).length,
        breached: (breachedRes.data?.items || []).length,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantProductId]);

  const assignToMe = async (ticketId: string, openAfterAssign: boolean = false) => {
    if (!ticketId) return;
    setAssigningId(ticketId);
    setError('');
    try {
      await ticketApi.assign(ticketId, user?.id || '');
      if (!openAfterAssign) {
        await fetchAll();
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.error === 'already_assigned'
          ? 'This ticket has already been assigned to another agent.'
          : e?.message || 'Failed to assign ticket';
      setError(msg);
      if (!openAfterAssign) {
        await fetchAll();
      }
    } finally {
      setAssigningId(null);
    }
  };

  const openUnassignedTicketPrompt = (ticketId: string) => {
    if (!ticketId) return;
    setPendingTicketId(ticketId);
  };

  const handleAssignAndOpen = async () => {
    if (!pendingTicketId) return;
    const id = pendingTicketId;
    setPendingActionLoading(true);
    try {
      await assignToMe(id, true);
    } finally {
      setPendingActionLoading(false);
      setPendingTicketId(null);
      router.push(`/agent/tickets/${id}`);
    }
  };

  const handleOpenOnly = () => {
    if (!pendingTicketId) return;
    const id = pendingTicketId;
    setPendingTicketId(null);
    router.push(`/agent/tickets/${id}?readonly=1`);
  };

  const role = (user?.role || '').toLowerCase();
  const title = role.startsWith('l3') ? 'L3 Inbox' : role.startsWith('l2') ? 'L2 Inbox' : role.startsWith('l1') ? 'L1 Inbox' : 'Agent Inbox';

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_ORDER.forEach((s) => (counts[s] = 0));
    allItemsForStatus.forEach((t) => {
      const s = String(t.status || 'new_ticket').toLowerCase().replace(/-/g, '_');
      if (counts[s] !== undefined) counts[s]++;
      else counts[s] = 1;
    });
    return counts;
  }, [allItemsForStatus]);

  const maxStatusCount = Math.max(1, ...Object.values(statusCounts));

  const formatSlaCell = (t: TicketListItem) => {
    if (!t.sla_deadline) return '—';
    const deadline = new Date(t.sla_deadline).getTime();
    const msLeft = deadline - Date.now();
    const breached = t.sla_breached || msLeft <= 0;
    if (breached) {
      const overdueMs = Math.abs(msLeft);
      const m = Math.floor(overdueMs / 60000);
      const h = Math.floor(m / 60);
      return h > 0 ? `Breached ${h}h ago` : m < 1 ? 'Breached' : `Breached ${m}m ago`;
    }
    const m = Math.max(0, Math.floor(msLeft / 60000));
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m left` : `${m}m left`;
  };

  const getSlaBadge = (t: TicketListItem) => {
    const deadline = t.sla_deadline ? new Date(t.sla_deadline).getTime() : null;
    if (!deadline) return null;
    const msLeft = deadline - Date.now();
    const breached = t.sla_breached || msLeft <= 0;
    if (breached) {
      const overdueMs = Math.abs(msLeft);
      const m = Math.floor(overdueMs / 60000);
      const h = Math.floor(m / 60);
      const text = h > 0 ? `Breached ${h}h ago` : m < 1 ? 'Breached' : `Breached ${m}m ago`;
      return { text, color: '#FCA5A5', bg: 'rgba(248,113,113,0.2)' };
    }
    const m = Math.max(0, Math.floor(msLeft / 60000));
    const h = Math.floor(m / 60);
    const text = h > 0 ? `${h}h ${m % 60}m left` : `${m}m left`;
    const color = msLeft <= 30 * 60 * 1000 ? '#FACC15' : '#4ADE80';
    const bg = msLeft <= 30 * 60 * 1000 ? 'rgba(250,204,21,0.2)' : 'rgba(74,222,128,0.2)';
    return { text, color, bg };
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#020617',
        color: '#E5E7EB',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
        padding: 18,
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Agent dashboard: queues, SLA and product filters.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#94A3B8' }} title={user?.email}>
              {user?.name || user?.email || 'Agent'}
            </span>
            <Link
              href="/agent/queue"
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(15,23,42,0.75)',
                color: '#E5E7EB',
                fontSize: 12,
                textDecoration: 'none',
              }}
            >
              Next tickets
            </Link>
            <button
              type="button"
              onClick={() => fetchAll()}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(15,23,42,0.75)',
                color: '#E5E7EB',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(248,113,113,0.4)',
                background: 'rgba(248,113,113,0.15)',
                color: '#FCA5A5',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Log out
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'rgba(15,23,42,0.85)',
              fontSize: 12,
            }}
          >
            <div style={{ color: '#94A3B8', marginBottom: 4 }}>Assigned to me</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{statsLoading ? '…' : stats.assigned}</div>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'rgba(15,23,42,0.85)',
              fontSize: 12,
            }}
          >
            <div style={{ color: '#94A3B8', marginBottom: 4 }}>Unassigned (my level)</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{statsLoading ? '…' : stats.unassigned}</div>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'rgba(30,64,175,0.8)',
              fontSize: 12,
            }}
          >
            <div style={{ color: '#E5E7EB', marginBottom: 4 }}>SLA breached</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{statsLoading ? '…' : stats.breached}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Product</span>
          <select
            value={tenantProductId}
            onChange={(e) => setTenantProductId(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'rgba(15,23,42,0.75)',
              color: '#E5E7EB',
              fontSize: 12,
              width: 260,
            }}
          >
            {products.length === 0 ? (
              <option value="">No assigned products</option>
            ) : (
              products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.support_level ? `(${p.support_level})` : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Tickets by status — bar chart */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700, marginBottom: 8 }}>My tickets by status</div>
          <div
            style={{
              border: '1px solid rgba(148,163,184,0.35)',
              borderRadius: 14,
              padding: 14,
              background: 'rgba(15,23,42,0.9)',
            }}
          >
            {loading ? (
              <div style={{ fontSize: 12, color: '#94A3B8' }}>Loading…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {STATUS_ORDER.map((statusKey) => {
                  const count = statusCounts[statusKey] ?? 0;
                  const pct = maxStatusCount > 0 ? (count / maxStatusCount) * 100 : 0;
                  const label = STATUS_LABELS[statusKey] ?? statusKey.replace(/_/g, ' ');
                  const isClosed = statusKey === 'resolved' || statusKey === 'closed';
                  const barColor = isClosed ? 'rgba(74,222,128,0.5)' : statusKey === 'new_ticket' ? 'rgba(250,204,21,0.4)' : 'rgba(59,130,246,0.4)';
                  return (
                    <div key={statusKey} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 100, fontSize: 11, color: '#94A3B8', flexShrink: 0 }}>
                        {label}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: 22,
                          borderRadius: 6,
                          background: 'rgba(15,23,42,0.8)',
                          overflow: 'hidden',
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.max(0, pct)}%`,
                            minWidth: count > 0 ? 4 : 0,
                            height: '100%',
                            borderRadius: 6,
                            background: barColor,
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                      <div style={{ width: 32, fontSize: 12, fontWeight: 800, color: '#E5E7EB', textAlign: 'right' }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(248,113,113,0.12)', color: '#FCA5A5', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Unassigned queue — horizontal blocks */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700, marginBottom: 8 }}>Unassigned (my level)</div>
          <div style={{ border: '1px solid rgba(148,163,184,0.35)', borderRadius: 14, overflow: 'hidden', background: 'rgba(15,23,42,0.9)' }}>
            <div style={{ padding: 10 }}>
              {loading ? (
                <div style={{ padding: 8, fontSize: 12, color: '#94A3B8' }}>Loading…</div>
              ) : unassignedItems.length === 0 ? (
                <div style={{ padding: 8, fontSize: 12, color: '#94A3B8' }}>No unassigned tickets.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'flex', gap: 10, paddingBottom: 4, minHeight: 140 }}>
                    {unassignedItems.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openUnassignedTicketPrompt(t.id)}
                        style={{
                          minWidth: 260,
                          maxWidth: 320,
                          borderRadius: 12,
                          border: '1px solid rgba(148,163,184,0.35)',
                          background: 'rgba(15,23,42,0.95)',
                          padding: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#FACC15', fontWeight: 800 }}>{t.ticket_number}</span>
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 999,
                              background: 'rgba(30,64,175,0.6)',
                              color: '#E5E7EB',
                              fontWeight: 800,
                            }}
                          >
                            L{t.escalation_level}
                          </span>
                        </div>
                        <div
                          style={{
                            color: '#E5E7EB',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={t.subject}
                        >
                          {t.subject}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, color: '#94A3B8', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700 }}>{(t.priority || '').toUpperCase()}</span>
                          <span>{t.tenant_product_id || 'No product'}</span>
                        </div>
                        {(() => {
                          const badge = getSlaBadge(t);
                          return badge ? (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: badge.color,
                                background: badge.bg,
                                padding: '3px 8px',
                                borderRadius: 999,
                                alignSelf: 'flex-start',
                              }}
                            >
                              {badge.text}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Assigned to me (left) | SLA breached (right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ border: '1px solid rgba(148,163,184,0.35)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', background: 'rgba(15,23,42,0.9)', fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>
              Assigned to me
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 72px 56px 90px', gap: 0, padding: '8px 10px', background: 'rgba(15,23,42,0.85)', fontSize: 10, color: '#94A3B8' }}>
              <div>Ticket</div>
              <div>Subject</div>
              <div>Status</div>
              <div>Priority</div>
              <div>SLA</div>
            </div>
            {loading ? (
              <div style={{ padding: 12, fontSize: 12, color: '#94A3B8' }}>Loading…</div>
            ) : assignedItems.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: '#94A3B8' }}>No tickets assigned to you.</div>
            ) : (
              assignedItems.map((t) => {
                const slaText = formatSlaCell(t);
                const isBreached = slaText.startsWith('Breached');
                const escalatedByName = (t as any).escalated_by_name;
                return (
                  <div
                    key={t.id}
                    style={{
                      borderTop: '1px solid rgba(148,163,184,0.25)',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '90px 1fr 72px 56px 90px',
                        padding: '8px 10px',
                        fontSize: 12,
                        alignItems: 'center',
                      }}
                    >
                    <Link href={`/agent/tickets/${t.id}`} style={{ color: '#FACC15', textDecoration: 'none', fontWeight: 800 }}>
                      {t.ticket_number}
                    </Link>
                    <div style={{ color: '#E5E7EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                    <div style={{ color: '#94A3B8' }}>{String(t.status || '').replace(/_/g, ' ')}</div>
                    <div style={{ color: '#E5E7EB', fontWeight: 700 }}>{t.priority}</div>
                    <div style={{ color: isBreached ? '#FCA5A5' : '#94A3B8', fontSize: 11, fontWeight: 600 }} title={t.sla_deadline ? new Date(t.sla_deadline).toLocaleString() : ''}>
                      {slaText}
                    </div>
                    </div>
                    {escalatedByName && (
                      <div style={{ padding: '2px 10px 6px', fontSize: 10, color: '#94A3B8', background: 'rgba(59,130,246,0.1)', borderLeft: '3px solid rgba(59,130,246,0.5)' }}>
                        Escalated by {escalatedByName}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ border: '1px solid rgba(148,163,184,0.35)', borderRadius: 14, overflow: 'hidden', background: 'rgba(30,64,175,0.12)' }}>
            <div style={{ padding: '10px 12px', background: 'rgba(30,64,175,0.5)', fontSize: 11, color: '#E5E7EB', fontWeight: 700 }}>
              SLA breached
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 70px', gap: 0, padding: '8px 10px', background: 'rgba(15,23,42,0.85)', fontSize: 10, color: '#94A3B8' }}>
              <div>Ticket</div>
              <div>Subject</div>
              <div>Status</div>
              <div>Priority</div>
            </div>
            {loading ? (
              <div style={{ padding: 12, fontSize: 12, color: '#94A3B8' }}>Loading…</div>
            ) : breachedItems.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: '#94A3B8' }}>No SLA breached tickets.</div>
            ) : (
              breachedItems.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 80px 70px',
                    padding: '8px 10px',
                    borderTop: '1px solid rgba(148,163,184,0.25)',
                    fontSize: 12,
                    alignItems: 'center',
                  }}
                >
                  <Link href={`/agent/tickets/${t.id}`} style={{ color: '#FACC15', textDecoration: 'none', fontWeight: 800 }}>
                    {t.ticket_number}
                  </Link>
                  <div style={{ color: '#E5E7EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                  <div style={{ color: '#94A3B8' }}>{t.status}</div>
                  <div style={{ color: '#FCA5A5', fontWeight: 700 }}>{t.priority}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center modal for unassigned ticket actions */}
        {pendingTicketId && (() => {
          const pendingTicket =
            unassignedItems.find((t) => t.id === pendingTicketId) ||
            assignedItems.find((t) => t.id === pendingTicketId) ||
            breachedItems.find((t) => t.id === pendingTicketId) ||
            allItemsForStatus.find((t) => t.id === pendingTicketId);
          const priority = pendingTicket ? String(pendingTicket.priority || 'p2').toLowerCase() : 'p2';
          const isP1 = priority === 'p1';
          const agentRole = typeof user?.role === 'string' ? user.role.toLowerCase() : '';
          const isL1 = agentRole === 'l1_agent';
          const isL3 = agentRole === 'l3_agent';
          const isAdmin = agentRole === 'tenant_admin' || agentRole === 'super_admin';
          const canAssignToMe = isAdmin || (isP1 ? isL3 : isL1);
          const assignToMeReason = canAssignToMe
            ? null
            : isP1
              ? 'P1 tickets can only be assigned to L3 agents.'
              : 'Non-P1 tickets can only be assigned to L1 agents.';
          return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 40,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 420,
                borderRadius: 16,
                border: '1px solid rgba(148,163,184,0.45)',
                background: '#020617',
                padding: 18,
                boxShadow: '0 18px 45px rgba(15,23,42,0.9)',
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>Take this ticket?</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>
                Do you want to <span style={{ fontWeight: 700, color: '#FACC15' }}>assign this ticket to yourself</span> and open it, or just
                view it without assignment?
              </div>
              {assignToMeReason && (
                <div style={{ fontSize: 11, color: '#FCA5A5', marginBottom: 12 }}>
                  {assignToMeReason}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleOpenOnly}
                  disabled={pendingActionLoading}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.35)',
                    background: 'rgba(15,23,42,0.85)',
                    color: '#E5E7EB',
                    fontSize: 12,
                    cursor: pendingActionLoading ? 'default' : 'pointer',
                  }}
                >
                  Just open
                </button>
                <button
                  type="button"
                  onClick={handleAssignAndOpen}
                  disabled={pendingActionLoading || !canAssignToMe}
                  title={assignToMeReason || undefined}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: canAssignToMe ? '#FACC15' : 'rgba(100,116,139,0.4)',
                    color: canAssignToMe ? '#0F172A' : '#64748B',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: pendingActionLoading || !canAssignToMe ? 'not-allowed' : 'pointer',
                    opacity: canAssignToMe ? 1 : 0.9,
                  }}
                >
                  {pendingActionLoading ? 'Assigning…' : 'Assign to me & open'}
                </button>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
