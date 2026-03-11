'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
};

export default function AgentDashboardPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'assigned' | 'unassigned' | 'breached'>('assigned');
  const [tenantProductId, setTenantProductId] = useState<string>('');
  const [products, setProducts] = useState<Array<{ id: string; name: string; support_level: string }>>([]);
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ assigned: number; unassigned: number; breached: number }>({
    assigned: 0,
    unassigned: 0,
    breached: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

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

  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = { take: 50 };
      if (tenantProductId) params.tenant_product_id = tenantProductId;
      if (tab === 'assigned') params.assigned = 'me';
      if (tab === 'unassigned') params.assigned = 'unassigned';
      if (tab === 'breached') params.sla_breached = 'true';
      const res = await ticketApi.list(params);
      setItems((res.data?.items as TicketListItem[]) || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!tenantProductId) return;
    setStatsLoading(true);
    try {
      const [assignedRes, unassignedRes, breachedRes] = await Promise.all([
        ticketApi.list({ take: 1_000, tenant_product_id: tenantProductId, assigned: 'me' }),
        ticketApi.list({ take: 1_000, tenant_product_id: tenantProductId, assigned: 'unassigned' }),
        ticketApi.list({ take: 1_000, tenant_product_id: tenantProductId, sla_breached: 'true' }),
      ]);
      setStats({
        assigned: (assignedRes.data?.items || []).length,
        unassigned: (unassignedRes.data?.items || []).length,
        breached: (breachedRes.data?.items || []).length,
      });
    } catch {
      setStats({ assigned: 0, unassigned: 0, breached: 0 });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tenantProductId]);

  const role = (user?.role || '').toLowerCase();
  const title = role.startsWith('l3') ? 'L3 Inbox' : role.startsWith('l2') ? 'L2 Inbox' : role.startsWith('l1') ? 'L1 Inbox' : 'Agent Inbox';

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Agent dashboard: queues, SLA and product filters.</div>
          </div>
          <button
            type="button"
            onClick={() => {
              fetchTickets();
              fetchStats();
            }}
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

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              ['assigned', 'Assigned to me'],
              ['unassigned', 'Unassigned'],
              ['breached', 'SLA breached'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: tab === k ? '#FACC15' : 'rgba(15,23,42,0.75)',
                  color: tab === k ? '#0F172A' : '#E5E7EB',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
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
        </div>

        {error && (
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(248,113,113,0.12)', color: '#FCA5A5', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ border: '1px solid rgba(148,163,184,0.35)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1.2fr 120px 90px 90px 1fr', gap: 0, padding: '10px 12px', background: 'rgba(15,23,42,0.9)', fontSize: 11, color: '#94A3B8' }}>
            <div>Ticket</div>
            <div>Subject</div>
            <div>Status</div>
            <div>Priority</div>
            <div>Level</div>
            <div>Tenant product</div>
          </div>

          {loading ? (
            <div style={{ padding: 14, fontSize: 12, color: '#94A3B8' }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: '#94A3B8' }}>No tickets.</div>
          ) : (
            items.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1.2fr 120px 90px 90px 1fr',
                  padding: '10px 12px',
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
                <div style={{ color: '#E5E7EB', fontWeight: 700 }}>{t.priority}</div>
                <div style={{ color: '#E5E7EB' }}>{t.escalation_level}</div>
                <div style={{ color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.tenant_product_id || '—'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
