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
  escalated_by?: string | null;
  escalated_by_name?: string | null;
};

const PAGE_SIZE = 50;

export default function AgentQueuePage() {
  const { user, clearAuth, hydrate } = useAuthStore();
  const [tab, setTab] = useState<'assigned' | 'unassigned' | 'breached'>('assigned');
  const [tenantProductId, setTenantProductId] = useState<string>('');
  const [products, setProducts] = useState<Array<{ id: string; name: string; support_level: string }>>([]);
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [skip, setSkip] = useState(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleLogout = () => {
    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/login';
  };

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
      const params: any = { take: PAGE_SIZE, skip };
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

  useEffect(() => {
    setSkip(0);
  }, [tab, tenantProductId]);

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tenantProductId, skip]);

  const title = user?.role === 'l2_agent' ? 'L2 Inbox' : user?.role === 'l3_agent' ? 'L3 Inbox' : 'L1 Inbox';

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
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Assigned, unassigned, and SLA tickets.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#94A3B8' }} title={user?.email}>
              {user?.name || user?.email || 'Agent'}
            </span>
            <Link
              href="/agent/dashboard"
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
              Dashboard
            </Link>
            <button
              type="button"
              onClick={fetchTickets}
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
                width: 320,
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
            <>
            {items.map((t) => {
              const escalatedByName = (t as any).escalated_by_name;
              return (
                <div key={t.id} style={{ borderTop: '1px solid rgba(148,163,184,0.25)' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '140px 1.2fr 120px 90px 90px 1fr',
                      padding: '10px 12px',
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
                  {escalatedByName && (
                    <div style={{ padding: '2px 12px 6px', fontSize: 10, color: '#94A3B8', background: 'rgba(59,130,246,0.1)', borderLeft: '3px solid rgba(59,130,246,0.5)' }}>
                      Escalated by {escalatedByName}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: '1px solid rgba(148,163,184,0.25)', background: 'rgba(15,23,42,0.6)' }}>
              <button
                type="button"
                onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
                disabled={skip === 0}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: skip === 0 ? 'rgba(30,41,59,0.5)' : 'rgba(15,23,42,0.75)',
                  color: skip === 0 ? '#64748B' : '#E5E7EB',
                  cursor: skip === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>
                {skip + 1}–{skip + items.length}
              </span>
              <button
                type="button"
                onClick={() => setSkip((s) => s + PAGE_SIZE)}
                disabled={items.length < PAGE_SIZE}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: items.length < PAGE_SIZE ? 'rgba(30,41,59,0.5)' : 'rgba(15,23,42,0.75)',
                  color: items.length < PAGE_SIZE ? '#64748B' : '#E5E7EB',
                  cursor: items.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                Next
              </button>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
