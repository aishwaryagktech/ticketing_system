'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { superAdminApi } from '@/lib/api/super-admin.api';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';

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
  { value: '',               label: 'All statuses' },
  { value: 'new_ticket',    label: 'New' },
  { value: 'open',          label: 'Open' },
  { value: 'in_progress',   label: 'In progress' },
  { value: 'pending_user',  label: 'Pending user' },
  { value: 'resolved',      label: 'Resolved' },
  { value: 'closed',        label: 'Closed' },
];

const STATUS_COLORS: Record<string, string> = {
  new_ticket:   '#0EA5E9',
  open:         '#6366F1',
  in_progress:  '#F59E0B',
  pending_user: '#F472B6',
  resolved:     '#4ADE80',
  closed:       '#94A3B8',
};

const PRIORITY_COLORS: Record<string, string> = {
  p1: '#EF4444', p2: '#F59E0B', p3: '#0EA5E9', p4: '#4ADE80',
};

const SOURCE_COLORS = ['#0EA5E9','#6366F1','#A78BFA','#F472B6','#4ADE80','#F59E0B'];

export default function SuperAdminTicketsPage() {
  const { theme } = useTheme();
  const [mounted, setMounted]               = useState(false);
  const [tickets, setTickets]               = useState<TicketItem[]>([]);
  const [total, setTotal]                   = useState(0);
  const [stats, setStats]                   = useState<TicketStats | null>(null);
  const [tenantProducts, setTenantProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [filters, setFilters]               = useState({ status: '', tenant_product_id: '', sla_breached: '' });
  const [page, setPage]                     = useState(0);
  const take = 30;

  useEffect(() => { setMounted(true); }, []);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { take, skip: page * take };
      if (filters.status)            params.status            = filters.status;
      if (filters.tenant_product_id) params.tenant_product_id = filters.tenant_product_id;
      if (filters.sla_breached)      params.sla_breached      = filters.sla_breached;
      const res = await superAdminApi.getTickets(params);
      setTickets(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch {
      setTickets([]); setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [filters.status, filters.tenant_product_id, filters.sla_breached, page]);

  useEffect(() => { if (!mounted) return; fetchTickets(); }, [mounted, fetchTickets]);

  useEffect(() => {
    if (!mounted) return;
    Promise.all([superAdminApi.getTicketStats(), superAdminApi.getTenantProducts()])
      .then(([sRes, lRes]) => {
        setStats(sRes.data ?? null);
        const list = Array.isArray(lRes.data) ? lRes.data : [];
        setTenantProducts(list.map((tp: { id: string; name: string }) => ({ id: tp.id, name: tp.name })));
      }).catch(() => {});
  }, [mounted]);

  const isDark = mounted && theme === 'dark';

  // ── Design tokens ──
  const textPrimary    = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary  = isDark ? '#94A3B8' : '#334155';
  const cardBg         = isDark ? 'rgba(15,23,42,0.85)'    : 'rgba(255,255,255,0.85)';
  const cardBorder     = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(147,197,253,0.55)';
  const insetBg        = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(239,246,255,0.6)';
  const accentBlue     = '#0EA5E9';
  const accentIndigo   = '#6366F1';
  const gridColor      = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(147,197,253,0.3)';
  const axisColor      = isDark ? '#64748B' : '#94A3B8';
  const ttStyle: React.CSSProperties = { background: isDark ? '#0f172a' : '#fff', border: `1px solid ${cardBorder}`, borderRadius: 8, fontSize: 12, color: textPrimary };

  const glassCard: React.CSSProperties = { background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, backdropFilter: 'blur(12px)' };
  const selectStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: 9, border: `1px solid ${cardBorder}`, background: isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.9)', color: textPrimary, fontSize: 13, outline: 'none' };

  const isResolvedByBot = (t: TicketItem) =>
    (t.status === 'resolved' || t.status === 'closed') && t.bot_replies_count > 0;

  // ── Chart data derived from API ──
  const statusChartData = stats?.by_status
    ? Object.entries(stats.by_status).map(([s, v]) => ({ name: s.replace('_', ' '), value: v, color: STATUS_COLORS[s] ?? '#94A3B8' }))
    : [];

  const slaChartData = stats
    ? [
        { name: 'Within SLA', value: (stats.total_tickets - stats.sla_breached_count), color: '#4ADE80' },
        { name: 'SLA Breached', value: stats.sla_breached_count, color: '#EF4444' },
      ].filter(d => d.value > 0)
    : [];

  const priorityMap: Record<string, number> = {};
  tickets.forEach(t => { priorityMap[t.priority] = (priorityMap[t.priority] || 0) + 1; });
  const priorityData = Object.entries(priorityMap).sort(([a],[b])=>a.localeCompare(b))
    .map(([p, v]) => ({ name: p.toUpperCase(), Tickets: v, color: PRIORITY_COLORS[p] ?? '#94A3B8' }));

  const sourceMap: Record<string, number> = {};
  tickets.forEach(t => { const s = t.source || 'unknown'; sourceMap[s] = (sourceMap[s] || 0) + 1; });
  const sourceData = Object.entries(sourceMap).map(([s, v], i) => ({ name: s.replace('_', ' '), value: v, color: SOURCE_COLORS[i % SOURCE_COLORS.length] }));

  // Tickets created per day (from current page)
  const dayMap: Record<string, number> = {};
  tickets.forEach(t => { const d = new Date(t.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }); dayMap[d] = (dayMap[d] || 0) + 1; });
  const trendData = Object.entries(dayMap).slice(-14).map(([d, v]) => ({ date: d, Tickets: v }));

  const botSolvedCount = tickets.filter(isResolvedByBot).length;
  const botRate = tickets.length > 0 ? Math.round((botSolvedCount / tickets.length) * 100) : 0;

  if (!mounted) return null;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: textPrimary, marginBottom: 4 }}>Tickets Dashboard</h1>
        <p style={{ fontSize: 13, color: textSecondary }}>All tickets across tenant products — status, SLA, AI deflection</p>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label:'Total Tickets',      value: stats?.total_tickets             ?? '—', color: accentBlue,   icon:'🎫' },
          { label:'Resolved / Closed',  value: stats?.resolved_or_closed_count  ?? '—', color:'#4ADE80',    icon:'✅' },
          { label:'SLA Breached',        value: stats?.sla_breached_count        ?? '—', color:'#EF4444',    icon:'⚠️' },
          { label:'Total Bot Replies',   value: stats?.bot_replies_total         ?? '—', color:'#A78BFA',    icon:'🤖' },
        ].map(s => (
          <div key={s.label} style={{ ...glassCard, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 26 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Insight charts ── */}
      {stats && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14 }}>Platform Insights</div>

          {/* Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Tickets by Status – Pie */}
            <div style={{ ...glassCard, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>Tickets by Status</div>
              <div style={{ fontSize: 11, color: textSecondary, marginBottom: 12 }}>{stats.total_tickets} total across all tenants</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusChartData} dataKey="value" nameKey="name" cx="45%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {statusChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={ttStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: textSecondary }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* SLA Health – Donut */}
            <div style={{ ...glassCard, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>SLA Health</div>
              <div style={{ fontSize: 11, color: textSecondary, marginBottom: 12 }}>
                {stats.sla_breached_count} breached · {stats.total_tickets - stats.sla_breached_count} within SLA
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <ResponsiveContainer width="55%" height={190}>
                  <PieChart>
                    <Pie data={slaChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={76} paddingAngle={3}>
                      {slaChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={ttStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {slaChartData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: d.color, display: 'inline-block', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>{d.value}</div>
                        <div style={{ fontSize: 10, color: textSecondary }}>{d.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Ticket creation trend */}
            <div style={{ ...glassCard, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>Creation Trend</div>
              <div style={{ fontSize: 11, color: textSecondary, marginBottom: 12 }}>Tickets created (current page, by date)</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={accentBlue}  stopOpacity={0.3} />
                      <stop offset="95%" stopColor={accentBlue}  stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: axisColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Area type="monotone" dataKey="Tickets" stroke={accentBlue} fill="url(#trendGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Priority distribution */}
            <div style={{ ...glassCard, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>By Priority</div>
              <div style={{ fontSize: 11, color: textSecondary, marginBottom: 12 }}>Current page</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={priorityData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="Tickets" radius={[4,4,0,0]}>
                    {priorityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* AI deflection + source */}
            <div style={{ ...glassCard, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Bot rate gauge */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>AI Deflection</div>
                <div style={{ fontSize: 11, color: textSecondary, marginBottom: 10 }}>Bot-resolved on this page</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(147,197,253,0.25)', overflow: 'hidden' }}>
                    <div style={{ width: `${botRate}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#0EA5E9,#6366F1)', transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: 17, fontWeight: 800, color: accentBlue, minWidth: 40, textAlign: 'right' }}>{botRate}%</span>
                </div>
                <div style={{ fontSize: 11, color: textSecondary, marginTop: 6 }}>{botSolvedCount} of {tickets.length} resolved by bot</div>
              </div>
              {/* Source breakdown */}
              {sourceData.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>By Source</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sourceData.map(s => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: textSecondary, flex: 1, textTransform: 'capitalize' }}>{s.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: textPrimary }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 3 — status bar breakdown */}
          <div style={{ ...glassCard, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 14 }}>Status Breakdown</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {statusChartData.map(s => (
                <div key={s.name} style={{ flex: '1 1 120px', background: insetBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, display: 'inline-block' }} />
                    <span style={{ fontSize: 11, color: textSecondary, textTransform: 'capitalize' }}>{s.name}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(147,197,253,0.2)', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.total_tickets > 0 ? Math.round((s.value / stats.total_tickets) * 100) : 0}%`, height: '100%', background: s.color, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 10, color: textSecondary, marginTop: 4 }}>
                    {stats.total_tickets > 0 ? Math.round((s.value / stats.total_tickets) * 100) : 0}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ ...glassCard, padding: '14px 18px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: textSecondary }}>Filters:</span>
        <select value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(0); }} style={selectStyle}>
          {STATUS_OPTIONS.map(o => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filters.tenant_product_id} onChange={e => { setFilters(f => ({ ...f, tenant_product_id: e.target.value })); setPage(0); }} style={{ ...selectStyle, minWidth: 180 }}>
          <option value="">All tenant products</option>
          {tenantProducts.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </select>
        <select value={filters.sla_breached} onChange={e => { setFilters(f => ({ ...f, sla_breached: e.target.value })); setPage(0); }} style={selectStyle}>
          <option value="">All SLA</option>
          <option value="true">SLA breached only</option>
          <option value="false">Not breached</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div style={{ ...glassCard, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: textSecondary }}>Loading tickets…</div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: textSecondary }}>No tickets match the filters.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(219,234,254,0.4)' }}>
                    {['Ticket','Subject','Tenant product','Tenant','Status','SLA','Resolved','Bot','AI solved','Created'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${cardBorder}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: accentBlue, whiteSpace: 'nowrap' }}>{t.ticket_number}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: textPrimary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.subject}>{t.subject}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: textSecondary, whiteSpace: 'nowrap' }}>{t.tenant_product_name ?? '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: textSecondary, whiteSpace: 'nowrap' }}>{t.tenant_name ?? t.tenant_slug ?? '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: `${STATUS_COLORS[t.status] ?? '#94A3B8'}22`, color: STATUS_COLORS[t.status] ?? '#94A3B8' }}>
                          {t.status.replace('_',' ')}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {t.sla_breached
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: 999 }}>Breached</span>
                          : <span style={{ fontSize: 11, color: '#4ADE80' }}>✓ OK</span>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: textSecondary, whiteSpace: 'nowrap' }}>{t.resolved_at ? new Date(t.resolved_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>{t.bot_replies_count}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {isResolvedByBot(t)
                          ? <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(167,139,250,0.15)', color: '#A78BFA' }}>🤖 Yes</span>
                          : <span style={{ fontSize: 12, color: textSecondary }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: textSecondary, whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${cardBorder}` }}>
              <span style={{ fontSize: 12, color: textSecondary }}>
                Showing {page * take + 1}–{Math.min((page + 1) * take, total)} of {total}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['← Prev', page === 0, () => setPage(p => p - 1)], ['Next →', (page + 1) * take >= total, () => setPage(p => p + 1)]].map(([label, disabled, onClick]) => (
                  <button key={label as string} disabled={disabled as boolean} onClick={onClick as () => void} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${cardBorder}`, background: 'transparent', color: disabled ? textSecondary : accentBlue, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: disabled ? 0.5 : 1 }}>
                    {label as string}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
