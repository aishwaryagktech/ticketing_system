'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { superAdminApi } from '@/lib/api/super-admin.api';

type TicketItem = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  source: string;
  sla_breached: boolean;
  sla_deadline: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  product_id: string;
  product_name: string | null;
  tenant_product_id: string | null;
  tenant_product_name: string | null;
  bot_replies_count: number;
};

type TicketStats = {
  total_tickets: number;
  by_status: Record<string, number>;
  sla_breached_count: number;
  resolved_or_closed_count: number;
  bot_replies_total: number;
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'new_ticket', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'pending_user', label: 'Pending user' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export default function SuperAdminTicketsPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [tenantProducts, setTenantProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    tenant_product_id: '',
    sla_breached: '',
  });
  const [page, setPage] = useState(0);
  const take = 30;

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { take, skip: page * take };
      if (filters.status) params.status = filters.status;
      if (filters.tenant_product_id) params.tenant_product_id = filters.tenant_product_id;
      if (filters.sla_breached) params.sla_breached = filters.sla_breached;
      const res = await superAdminApi.getTickets(params);
      setTickets(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err) {
      console.error('Failed to fetch tickets', err);
      setTickets([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [filters.status, filters.tenant_product_id, filters.sla_breached, page]);

  useEffect(() => {
    if (!mounted) return;
    fetchTickets();
  }, [mounted, fetchTickets]);

  useEffect(() => {
    if (!mounted) return;
    Promise.all([
      superAdminApi.getTicketStats(),
      superAdminApi.getTenantProducts(),
    ])
      .then(([statsRes, listRes]) => {
        setStats(statsRes.data ?? null);
        const list = Array.isArray(listRes.data) ? listRes.data : [];
        setTenantProducts(list.map((tp: { id: string; name: string }) => ({ id: tp.id, name: tp.name })));
      })
      .catch(() => {});
  }, [mounted]);

  const isDark = mounted && theme === 'dark';
  const textPrimary = isDark ? '#F8FAFC' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const surfaceBg = isDark ? '#1E293B' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';
  const accentBrand = '#FACC15';

  const cardStyle: React.CSSProperties = {
    background: surfaceBg,
    border: `1px solid ${borderColor}`,
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  };

  const statCards = [
    { label: 'Total Tickets', value: stats?.total_tickets ?? '—', color: accentBrand, icon: '🎫' },
    { label: 'Resolved / Closed', value: stats?.resolved_or_closed_count ?? '—', color: '#22C55E', icon: '✅' },
    { label: 'SLA Breached', value: stats?.sla_breached_count ?? '—', color: '#EF4444', icon: '⚠️' },
    { label: 'Bot Replies (total)', value: stats?.bot_replies_total ?? '—', color: '#8B5CF6', icon: '🤖' },
  ];

  const isResolvedByBot = (t: TicketItem) =>
    (t.status === 'resolved' || t.status === 'closed') && t.bot_replies_count > 0;

  if (!mounted) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: textPrimary, marginBottom: '4px' }}>
            Tickets Dashboard
          </h1>
          <p style={{ fontSize: '14px', color: textSecondary }}>
            All tickets across tenant products — status, SLA breached, resolved by AI
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {statCards.map((s) => (
          <div key={s.label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '28px' }}>{s.icon}</div>
            <div>
              <p style={{ fontSize: '13px', color: textSecondary, marginBottom: '4px', fontWeight: 500 }}>{s.label}</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* By status breakdown */}
      {stats?.by_status && Object.keys(stats.by_status).length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: textSecondary, marginBottom: '12px', textTransform: 'uppercase' }}>
            By status
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {Object.entries(stats.by_status).map(([status, count]) => (
              <span
                key={status}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                  color: textPrimary,
                }}
              >
                {status.replace('_', ' ')}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ ...cardStyle, marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: textSecondary }}>Filters:</span>
        <select
          value={filters.status}
          onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(0); }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1px solid ${borderColor}`,
            background: isDark ? '#0F172A' : '#fff',
            color: textPrimary,
            fontSize: '13px',
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={filters.tenant_product_id}
          onChange={(e) => { setFilters((f) => ({ ...f, tenant_product_id: e.target.value })); setPage(0); }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1px solid ${borderColor}`,
            background: isDark ? '#0F172A' : '#fff',
            color: textPrimary,
            fontSize: '13px',
            minWidth: '180px',
          }}
        >
          <option value="">All tenant products</option>
          {tenantProducts.map((tp) => (
            <option key={tp.id} value={tp.id}>{tp.name}</option>
          ))}
        </select>
        <select
          value={filters.sla_breached}
          onChange={(e) => { setFilters((f) => ({ ...f, sla_breached: e.target.value })); setPage(0); }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1px solid ${borderColor}`,
            background: isDark ? '#0F172A' : '#fff',
            color: textPrimary,
            fontSize: '13px',
          }}
        >
          <option value="">All</option>
          <option value="true">SLA breached only</option>
          <option value="false">Not breached</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: textSecondary }}>Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: textSecondary }}>No tickets match the filters.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: isDark ? '#1E293B' : '#F9FAFB' }}>
                    {['Ticket', 'Subject', 'Tenant product', 'Tenant', 'Status', 'SLA', 'Resolved', 'Bot', 'Solved by AI', 'Created'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: textSecondary,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: `1px solid ${borderColor}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: textPrimary }}>
                        {t.ticket_number}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: textPrimary, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.subject}>
                        {t.subject}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: textSecondary }}>
                        {t.tenant_product_name ?? t.tenant_product_id ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: textSecondary }}>
                        {t.tenant_name ?? t.tenant_slug ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                            color: textPrimary,
                          }}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {t.sla_breached ? (
                          <span style={{ color: '#EF4444', fontWeight: 600, fontSize: '12px' }}>Breached</span>
                        ) : (
                          <span style={{ color: textSecondary, fontSize: '12px' }}>OK</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: textSecondary }}>
                        {t.resolved_at ? new Date(t.resolved_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: textPrimary, fontWeight: 600 }}>
                        {t.bot_replies_count}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isResolvedByBot(t) ? (
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: isDark ? 'rgba(139,92,246,0.2)' : '#EDE9FE',
                              color: '#8B5CF6',
                            }}
                          >
                            Yes
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: textSecondary }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: textSecondary }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${borderColor}` }}>
              <span style={{ fontSize: '12px', color: textSecondary }}>
                Showing {page * take + 1}–{Math.min((page + 1) * take, total)} of {total}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${borderColor}`,
                    background: 'transparent',
                    color: textSecondary,
                    cursor: page === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={(page + 1) * take >= total}
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${borderColor}`,
                    background: 'transparent',
                    color: textSecondary,
                    cursor: (page + 1) * take >= total ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
