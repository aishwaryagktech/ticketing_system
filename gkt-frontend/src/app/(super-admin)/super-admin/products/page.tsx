'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { superAdminApi } from '@/lib/api/super-admin.api';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from 'recharts';

type TenantProductRow = {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  status: string;
  l0_model: string | null;
  l0_provider: string | null;
  created_at: string;
  created_by: string | null;
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  product_id: string | null;
  product_name: string | null;
  product_slug: string | null;
  plan_name: string | null;
  agents_count: number;
  tickets_count: number;
  sla_count: number;
  escalation_count: number;
  kb_articles_count: number;
};

type TenantProductStats = {
  total_tenant_products: number;
  active_tenant_products: number;
  total_agents: number;
  total_tickets: number;
  total_tenants: number;
};

export default function ProductsPage() {
  const { theme } = useTheme();
  const [mounted, setMounted]             = useState(false);
  const [tenantProducts, setTenantProducts] = useState<TenantProductRow[]>([]);
  const [stats, setStats]                 = useState<TenantProductStats | null>(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [view, setView]                   = useState<'cards' | 'table'>('cards');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [listRes, statsRes] = await Promise.all([
          superAdminApi.getTenantProducts(),
          superAdminApi.getTenantProductStats(),
        ]);
        setTenantProducts(Array.isArray(listRes.data) ? listRes.data : []);
        setStats(statsRes.data ?? null);
      } catch (err) {
        console.error('Failed to fetch tenant products', err);
        setTenantProducts([]); setStats(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const isDark = mounted && theme === 'dark';

  // ── Design tokens (matches landing page) ──
  const textPrimary   = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#334155';
  const cardBg        = isDark ? 'rgba(15,23,42,0.85)'    : 'rgba(255,255,255,0.85)';
  const cardBorder    = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(147,197,253,0.55)';
  const insetBg       = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(239,246,255,0.7)';
  const accentBlue    = '#0EA5E9';
  const accentIndigo  = '#6366F1';

  const glassCard: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    borderRadius: 14,
    backdropFilter: 'blur(12px)',
  };

  const getConfigStatus = (p: TenantProductRow) => {
    const checks = {
      SLA:          (p.sla_count        ?? 0) > 0,
      Escalation:   (p.escalation_count ?? 0) > 0,
      'KB Articles':(p.kb_articles_count?? 0) > 0,
      'AI Bot':     !!(p.l0_model && p.l0_provider),
    };
    const done  = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { checks, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  };

  if (!mounted) return null;

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: textPrimary, marginBottom: 4 }}>
            Tenant Products Dashboard
          </h1>
          <p style={{ fontSize: 13, color: textSecondary }}>
            All tenant products across the platform — agents, tickets, and configuration
          </p>
        </div>
        {/* View toggle */}
        <div style={{ display: 'flex', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(219,234,254,0.6)', border: `1px solid ${cardBorder}`, borderRadius: 10, padding: 3, gap: 2 }}>
          {(['cards', 'table'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: view === v ? `linear-gradient(90deg,${accentBlue},${accentIndigo})` : 'transparent',
              color: view === v ? '#fff' : textSecondary,
              boxShadow: view === v ? '0 2px 8px rgba(14,165,233,0.3)' : 'none',
              transition: 'all 0.15s',
            }}>
              {v === 'cards' ? '⊞ Cards' : '☰ Table'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label:'Tenant Products', value: stats?.total_tenant_products,  color:'#0EA5E9', icon:'🏢' },
          { label:'Active',          value: stats?.active_tenant_products, color:'#4ADE80', icon:'✅' },
          { label:'Total Tenants',   value: stats?.total_tenants,          color:'#6366F1', icon:'🏠' },
          { label:'Total Agents',    value: stats?.total_agents,           color:'#A78BFA', icon:'👥' },
          { label:'Total Tickets',   value: stats?.total_tickets,          color:'#F472B6', icon:'🎫' },
        ].map(s => (
          <div key={s.label} style={{ ...glassCard, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 26 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                {isLoading ? '…' : (s.value ?? '—')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Insights charts ── */}
      {!isLoading && tenantProducts.length > 0 && (() => {
        // Derived chart data
        const ticketData  = tenantProducts.slice(0, 10).map(p => ({ name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name, Tickets: p.tickets_count, Agents: p.agents_count, KB: p.kb_articles_count }));
        const statusData  = [
          { name: 'Active',   value: tenantProducts.filter(p => p.status === 'active').length,   color: '#4ADE80' },
          { name: 'Inactive', value: tenantProducts.filter(p => p.status !== 'active').length,   color: '#F87171' },
        ].filter(d => d.value > 0);
        const cfgBuckets: Record<string, number> = { '0%': 0, '25%': 0, '50%': 0, '75%': 0, '100%': 0 };
        tenantProducts.forEach(p => {
          const cfg = (() => { const checks = { SLA:(p.sla_count??0)>0, Esc:(p.escalation_count??0)>0, KB:(p.kb_articles_count??0)>0, AI:!!(p.l0_model&&p.l0_provider) }; const d=Object.values(checks).filter(Boolean).length; return Math.round((d/4)*100); })();
          if (cfg === 100) cfgBuckets['100%']++;
          else if (cfg >= 75) cfgBuckets['75%']++;
          else if (cfg >= 50) cfgBuckets['50%']++;
          else if (cfg >= 25) cfgBuckets['25%']++;
          else cfgBuckets['0%']++;
        });
        const cfgData = Object.entries(cfgBuckets).filter(([,v])=>v>0).map(([k,v])=>({ name: k, value: v, fill: k==='100%'?'#4ADE80':k==='75%'?'#0EA5E9':k==='50%'?'#6366F1':k==='25%'?'#F59E0B':'#F87171' }));
        const planData = Object.entries(tenantProducts.reduce<Record<string,number>>((acc,p) => { const k = p.plan_name||'No plan'; acc[k]=(acc[k]||0)+1; return acc; }, {})).map(([k,v])=>({ name: k, Products: v }));

        const ttStyle: React.CSSProperties = { background: isDark ? '#0f172a' : '#fff', border: `1px solid ${cardBorder}`, borderRadius: 8, fontSize: 12, color: textPrimary };
        const gridColor = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(147,197,253,0.3)';
        const axisColor = isDark ? '#64748B' : '#94A3B8';

        return (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14 }}>Platform Insights</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

              {/* Tickets & Agents per product */}
              <div style={{ ...glassCard, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 14 }}>Tickets & Agents by Product</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ticketData} barCategoryGap="30%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="Tickets" fill="#6366F1" radius={[4,4,0,0]} />
                    <Bar dataKey="Agents"  fill="#0EA5E9" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* KB Articles per product */}
              <div style={{ ...glassCard, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 14 }}>KB Articles by Product</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ticketData} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="KB" fill="#A78BFA" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

              {/* Active vs Inactive */}
              <div style={{ ...glassCard, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>Active vs Inactive</div>
                <div style={{ fontSize: 11, color: textSecondary, marginBottom: 10 }}>{tenantProducts.length} total products</div>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={ttStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: textSecondary }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Config completion distribution */}
              <div style={{ ...glassCard, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>Config Completion</div>
                <div style={{ fontSize: 11, color: textSecondary, marginBottom: 10 }}>SLA · Escalation · KB · AI Bot</div>
                <ResponsiveContainer width="100%" height={170}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius={18} outerRadius={72} data={cfgData} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={4} label={{ position: 'insideStart', fill: isDark ? '#E5E7EB' : '#0F172A', fontSize: 9 }} />
                    <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v} products`]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: textSecondary }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>

              {/* Plans distribution */}
              <div style={{ ...glassCard, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>Products by Plan</div>
                <div style={{ fontSize: 11, color: textSecondary, marginBottom: 10 }}>{planData.length} plan{planData.length !== 1 ? 's' : ''} in use</div>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={planData} layout="vertical" barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="Products" radius={[0,4,4,0]} fill="url(#blueGrad)" />
                    <defs>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#0EA5E9" />
                        <stop offset="100%" stopColor="#6366F1" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Content ── */}
      {isLoading ? (
        <div style={{ ...glassCard, padding: '60px', textAlign: 'center', color: textSecondary }}>
          Loading tenant products…
        </div>
      ) : tenantProducts.length === 0 ? (
        <div style={{ ...glassCard, padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
          <p style={{ fontSize: 20, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>No tenant products yet</p>
          <p style={{ fontSize: 14, color: textSecondary, maxWidth: 420, margin: '0 auto' }}>
            Tenant products are created by tenant admins in their workspace. They will appear here with agents, tickets, and configuration status.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(370px,1fr))', gap: 18 }}>
          {tenantProducts.map(p => {
            const cfg = getConfigStatus(p);
            const isActive = p.status === 'active';
            return (
              <div key={p.id} style={{ ...glassCard, overflow: 'hidden' }}>
                {/* Status bar */}
                <div style={{ height: 4, background: isActive ? `linear-gradient(90deg,${accentBlue},${accentIndigo})` : '#EF4444' }} />

                <div style={{ padding: 20 }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg,${accentBlue},${accentIndigo})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: textSecondary }}>{p.tenant_name ?? p.tenant_slug ?? '—'} · {p.product_name ?? p.product_slug ?? '—'}</div>
                      </div>
                    </div>
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: isActive ? (isDark ? 'rgba(74,222,128,0.12)' : '#DCFCE7') : (isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2'), color: isActive ? '#4ADE80' : '#EF4444' }}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {p.description && (
                    <p style={{ fontSize: 12, color: textSecondary, marginBottom: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>
                  )}

                  {/* Stats mini-grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
                    {[
                      { v: p.agents_count,      l: 'Agents',  c: accentBlue },
                      { v: p.tickets_count,     l: 'Tickets', c: accentIndigo },
                      { v: p.kb_articles_count, l: 'KB',      c: '#A78BFA' },
                      { v: p.plan_name || '—',  l: 'Plan',    c: textPrimary, small: true },
                    ].map(s => (
                      <div key={s.l} style={{ background: insetBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: '10px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: s.small ? 11 : 17, fontWeight: 700, color: s.c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.v}</div>
                        <div style={{ fontSize: 10, color: textSecondary, marginTop: 2 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Config progress */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: textSecondary }}>Configuration</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.pct === 100 ? '#4ADE80' : accentBlue }}>{cfg.pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: 5, borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(147,197,253,0.25)' }}>
                      <div style={{ width: `${cfg.pct}%`, height: '100%', borderRadius: 999, background: cfg.pct === 100 ? '#4ADE80' : `linear-gradient(90deg,${accentBlue},${accentIndigo})`, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                      {Object.entries(cfg.checks).map(([key, val]) => (
                        <span key={key} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: val ? (isDark ? 'rgba(74,222,128,0.1)' : '#DCFCE7') : (isDark ? 'rgba(14,165,233,0.08)' : 'rgba(219,234,254,0.8)'), color: val ? '#4ADE80' : (isDark ? '#94A3B8' : '#64748B') }}>
                          {val ? '✓' : '○'} {key}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${cardBorder}`, paddingTop: 14 }}>
                    <span style={{ fontSize: 11, color: textSecondary }}>Created {new Date(p.created_at).toLocaleDateString()}</span>
                    <Link href="/super-admin/feature-flags" style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${cardBorder}`, background: isDark ? 'rgba(14,165,233,0.08)' : 'rgba(219,234,254,0.7)', color: accentBlue, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      Platform →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table view ── */
        <div style={{ ...glassCard, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(219,234,254,0.4)' }}>
                {['Product','Tenant','Plan','Agents','Tickets','KB','Config','Status','Created'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${cardBorder}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenantProducts.map(p => {
                const cfg = getConfigStatus(p);
                const isActive = p.status === 'active';
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${accentBlue},${accentIndigo})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: textSecondary }}>{p.product_name ?? p.product_slug ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: textSecondary }}>{p.tenant_name ?? p.tenant_slug ?? '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: textSecondary }}>{p.plan_name ?? '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: accentBlue }}>{p.agents_count}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: accentIndigo }}>{p.tickets_count}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>{p.kb_articles_count}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 52, height: 5, borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(147,197,253,0.25)', overflow: 'hidden' }}>
                          <div style={{ width: `${cfg.pct}%`, height: '100%', background: cfg.pct === 100 ? '#4ADE80' : `linear-gradient(90deg,${accentBlue},${accentIndigo})` }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.pct === 100 ? '#4ADE80' : accentBlue }}>{cfg.pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: isActive ? (isDark ? 'rgba(74,222,128,0.12)' : '#DCFCE7') : (isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2'), color: isActive ? '#4ADE80' : '#EF4444' }}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: textSecondary }}>{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
