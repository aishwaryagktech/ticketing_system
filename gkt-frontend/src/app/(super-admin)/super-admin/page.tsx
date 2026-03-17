'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { superAdminApi } from '@/lib/api/super-admin.api';
import { LayoutDashboard, Boxes, Ticket, AlertTriangle, Users } from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, CartesianGrid, XAxis, YAxis
} from 'recharts';

type PlatformStats = {
  total_products: number;
  active_products: number;
  total_agents: number;
  total_tickets: number;
};

type TenantProductStats = {
  total_tenant_products: number;
  active_tenant_products: number;
  total_agents: number;
  total_tickets: number;
  total_tenants: number;
};

type TicketStats = {
  total_tickets: number;
  by_status: Record<string, number>;
  sla_breached_count: number;
  resolved_or_closed_count: number;
  bot_replies_total: number;
};

type TenantProductRow = {
  id: string;
  name: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  product_name: string | null;
  agents_count: number;
  tickets_count: number;
  kb_articles_count: number;
};

export default function SuperAdminOverviewPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [tenantStats, setTenantStats] = useState<TenantProductStats | null>(null);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [tenantProducts, setTenantProducts] = useState<TenantProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      setIsLoading(true);
      try {
        const [platRes, tenStatsRes, tickStatsRes, tpRes] = await Promise.all([
          superAdminApi.getPlatformStats(),
          superAdminApi.getTenantProductStats(),
          superAdminApi.getTicketStats(),
          superAdminApi.getTenantProducts(),
        ]);
        
        setPlatformStats(platRes.data);
        setTenantStats(tenStatsRes.data);
        setTicketStats(tickStatsRes.data);
        
        // Sort for top products by volume
        const sorted = (Array.isArray(tpRes.data) ? tpRes.data : [])
          .sort((a, b) => b.tickets_count - a.tickets_count)
          .slice(0, 5);
        setTenantProducts(sorted);
        
      } catch (err) {
        console.error('Failed to fetch overview data', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const isDark = mounted && theme === 'dark';

  // ── Design tokens
  const textPrimary   = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#334155';
  const cardBg        = isDark ? 'rgba(15,23,42,0.85)'    : 'rgba(255,255,255,0.85)';
  const cardBorder    = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(147,197,253,0.55)';
  const accentBlue    = '#0EA5E9';
  const accentIndigo  = '#6366F1';
  const accentGreen   = '#4ADE80';
  const accentRed     = '#F87171';
  const accentAmber   = '#F59E0B';

  const glassCard: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    borderRadius: 14,
    backdropFilter: 'blur(12px)',
  };

  if (!mounted) return null;

  // Chart data
  const statusData = ticketStats ? Object.entries(ticketStats.by_status).map(([k, v]) => {
    let color = textSecondary;
    if (k === 'open') color = accentBlue;
    else if (k === 'resolved' || k === 'closed') color = accentGreen;
    else if (k === 'in_progress') color = accentAmber;
    return { name: k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' '), value: v, color };
  }) : [];

  const ttStyle: React.CSSProperties = { background: isDark ? '#0f172a' : '#fff', border: `1px solid ${cardBorder}`, borderRadius: 8, fontSize: 12, color: textPrimary };
  const gridColor = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(147,197,253,0.3)';
  const axisColor = isDark ? '#64748B' : '#94A3B8';

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: textPrimary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <LayoutDashboard size={24} color={accentBlue} />
          Platform Overview
        </h1>
        <p style={{ fontSize: 13, color: textSecondary }}>
          Monitor complete application, tenants, and products
        </p>
      </div>

      {isLoading ? (
        <div style={{ ...glassCard, padding: '60px', textAlign: 'center', color: textSecondary }}>
          Loading platform metrics…
        </div>
      ) : (
        <>
          {/* ── Key Metrics Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 28 }}>
            {[
              { label:'Total Products', value: tenantStats?.total_tenant_products, color:accentIndigo, icon: <Boxes size={24} /> },
              { label:'Total Tenants',  value: tenantStats?.total_tenants, color:accentGreen, icon: <LayoutDashboard size={24} /> },
              { label:'Total Tickets',  value: ticketStats?.total_tickets, color:accentBlue, icon: <Ticket size={24} /> },
              { label:'Total Agents',   value: platformStats?.total_agents, color:accentAmber, icon: <Users size={24} /> },
              { label:'AI Bot Replies', value: ticketStats?.bot_replies_total, color:textPrimary, icon: <LayoutDashboard size={24} /> }, // using LayoutDashboard as generic since lucide doesn't have a specific bot one in standard import easily visible here, let's stick to LayoutDashboard
            ].map((s, i) => (
              <div key={i} style={{ ...glassCard, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: textPrimary, lineHeight: 1 }}>
                    {s.value ?? '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
            {/* ── Top Products By Volume ── */}
            <div style={{ ...glassCard, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${cardBorder}` }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Top Products By Volume
                </h2>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(219,234,254,0.3)' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: textSecondary, textTransform: 'uppercase' }}>Product</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: textSecondary, textTransform: 'uppercase' }}>Tickets</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: textSecondary, textTransform: 'uppercase' }}>Agents</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantProducts.length > 0 ? (
                    tenantProducts.map((p) => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: textSecondary }}>{p.tenant_name ?? p.tenant_slug}</div>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: accentBlue }}>
                          {p.tickets_count.toLocaleString()}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, color: textSecondary }}>
                          {p.agents_count.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ padding: '30px', textAlign: 'center', color: textSecondary, fontSize: 13 }}>
                        No product data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Analytics Column ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Tickets By Status */}
              <div style={{ ...glassCard, padding: '20px' }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Tickets by Status
                </h2>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                        {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={ttStyle} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: textSecondary }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* SLA Alerts Map (Simplified version for quick view) */}
              <div style={{ ...glassCard, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `4px solid ${accentRed}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AlertTriangle size={16} color={accentRed} />
                    SLA Breaches
                  </div>
                  <div style={{ fontSize: 12, color: textSecondary }}>Tickets currently over SLA limits</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: accentRed }}>
                  {ticketStats?.sla_breached_count ?? 0}
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
