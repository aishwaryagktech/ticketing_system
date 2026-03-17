'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { agentApi } from '@/lib/api/agent.api';
import { LayoutDashboard, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

type AgentDashboardStats = {
  total_assigned: number;
  open_tickets: number;
  resolved_tickets: number;
  sla_breaches: number;
  status_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
  daily_resolutions: Record<string, number>;
};

export default function AgentDashboardPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<AgentDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const res = await agentApi.getDashboardStats();
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch agent dashboard stats', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const isDark = mounted && theme === 'dark';

  // ── Design tokens ──
  const textPrimary = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#334155';
  const cardBg = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)';
  const cardBorder = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(147,197,253,0.55)';
  const accentBlue = '#0EA5E9';
  const accentIndigo = '#6366F1';
  const accentGreen = '#4ADE80';
  const accentAmber = '#F59E0B';
  const accentRed = '#F87171';

  const glassCard: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    borderRadius: 14,
    backdropFilter: 'blur(12px)',
  };

  if (!mounted) return null;

  // Chart data formatting
  const resolutionData = (() => {
    if (!stats?.daily_resolutions) return [];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      const shortDate = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({ name: shortDate, Resolutions: stats.daily_resolutions[str] || 0 });
    }
    return days;
  })();

  const statusData = stats?.status_distribution ? Object.entries(stats.status_distribution).map(([k, v]) => {
    let color = textSecondary;
    if (k === 'open') color = accentBlue;
    else if (k === 'resolved' || k === 'closed') color = accentGreen;
    else if (k === 'in_progress') color = accentAmber;
    return { name: k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' '), value: v, color };
  }) : [];

  const priorityData = stats?.priority_distribution ? Object.entries(stats.priority_distribution).map(([k, v]) => {
    let color = textSecondary;
    if (k === 'p1') color = accentRed;
    else if (k === 'p2') color = accentAmber;
    else if (k === 'p3') color = accentBlue;
    else if (k === 'p4') color = textSecondary;
    return { name: k.toUpperCase(), value: v, color };
  }) : [];

  const ttStyle: React.CSSProperties = { background: isDark ? '#0f172a' : '#fff', border: `1px solid ${cardBorder}`, borderRadius: 8, fontSize: 12, color: textPrimary };
  const gridColor = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(147,197,253,0.3)';
  const axisColor = isDark ? '#64748B' : '#94A3B8';

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: textPrimary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <LayoutDashboard size={24} color={accentBlue} />
          My Dashboard
        </h1>
        <p style={{ fontSize: 13, color: textSecondary }}>
          Your performance metrics and assigned tickets overview
        </p>
      </div>

      {isLoading ? (
        <div style={{ ...glassCard, padding: '60px', textAlign: 'center', color: textSecondary }}>
          Loading dashboard metrics…
        </div>
      ) : (
        <>
          {/* ── Key Metrics Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
            {[
              { label: 'My Open Tickets', value: stats?.open_tickets, color: accentBlue, icon: <Clock size={24} /> },
              { label: 'Total Resolved', value: stats?.resolved_tickets, color: accentGreen, icon: <CheckCircle size={24} /> },
              { label: 'Total Assigned', value: stats?.total_assigned, color: accentIndigo, icon: <LayoutDashboard size={24} /> },
              { label: 'SLA Breaches', value: stats?.sla_breaches, color: accentRed, icon: <AlertTriangle size={24} /> },
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

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
            {/* ── Daily Resolutions Chart ── */}
            <div style={{ ...glassCard, padding: '20px' }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>Resolution Trend (Last 7 Days)</h2>
              <p style={{ fontSize: 11, color: textSecondary, marginBottom: 16 }}>Number of tickets resolved daily</p>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resolutionData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={ttStyle} cursor={{ fill: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }} />
                    <Bar dataKey="Resolutions" radius={[4, 4, 0, 0]}>
                      {
                        resolutionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`url(#colorRes${index})`} />
                        ))
                      }
                    </Bar>
                    <defs>
                      {resolutionData.map((e, index) => (
                        <linearGradient key={`grad-${index}`} id={`colorRes${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={accentBlue} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={accentIndigo} stopOpacity={0.8} />
                        </linearGradient>
                      ))}
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Status & Priority Breakdown ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ ...glassCard, padding: '20px' }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
                  My Tickets By Status
                </h2>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4}>
                        {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={ttStyle} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: textSecondary }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ ...glassCard, padding: '20px' }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
                  My Tickets By Priority
                </h2>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={0} outerRadius={65}>
                        {priorityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={ttStyle} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: textSecondary }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
