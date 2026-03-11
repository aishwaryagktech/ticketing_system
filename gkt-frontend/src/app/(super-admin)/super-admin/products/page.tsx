'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { superAdminApi } from '@/lib/api/super-admin.api';

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
  const [mounted, setMounted] = useState(false);
  const [tenantProducts, setTenantProducts] = useState<TenantProductRow[]>([]);
  const [stats, setStats] = useState<TenantProductStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    setMounted(true);
  }, []);

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
        setTenantProducts([]);
        setStats(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

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
    {
      label: 'Tenant Products',
      value: stats?.total_tenant_products ?? '—',
      color: accentBrand,
      icon: '🏢',
    },
    {
      label: 'Active',
      value: stats?.active_tenant_products ?? '—',
      color: '#22C55E',
      icon: '✅',
    },
    {
      label: 'Total Tenants',
      value: stats?.total_tenants ?? '—',
      color: '#3B82F6',
      icon: '🏠',
    },
    {
      label: 'Total Agents',
      value: stats?.total_agents ?? '—',
      color: '#8B5CF6',
      icon: '👥',
    },
    {
      label: 'Total Tickets',
      value: stats?.total_tickets ?? '—',
      color: '#EC4899',
      icon: '🎫',
    },
  ];

  const getConfigStatus = (p: TenantProductRow) => {
    const checks = {
      SLA: (p.sla_count ?? 0) > 0,
      Escalation: (p.escalation_count ?? 0) > 0,
      'KB Articles': (p.kb_articles_count ?? 0) > 0,
      'AI Bot': !!(p.l0_model && p.l0_provider),
    };
    const done = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { checks, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  };

  if (!mounted) return null;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: textPrimary,
              marginBottom: '4px',
            }}
          >
            Tenant Products Dashboard
          </h1>
          <p style={{ fontSize: '14px', color: textSecondary }}>
            All tenant products across the platform — agents, tickets, and configuration
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              border: `1px solid ${borderColor}`,
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setView('cards')}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: view === 'cards' ? accentBrand : 'transparent',
                color: view === 'cards' ? '#000' : textSecondary,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Cards
            </button>
            <button
              onClick={() => setView('table')}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: view === 'table' ? accentBrand : 'transparent',
                color: view === 'table' ? '#000' : textSecondary,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {statCards.map((s) => (
          <div
            key={s.label}
            style={{
              ...cardStyle,
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ fontSize: '28px' }}>{s.icon}</div>
            <div>
              <p
                style={{
                  fontSize: '13px',
                  color: textSecondary,
                  marginBottom: '4px',
                  fontWeight: 500,
                }}
              >
                {s.label}
              </p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: s.color }}>
                {isLoading ? '...' : s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div
          style={{
            padding: '60px',
            textAlign: 'center',
            color: textSecondary,
          }}
        >
          Loading tenant products...
        </div>
      ) : tenantProducts.length === 0 ? (
        <div style={{ ...cardStyle, padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
          <p
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: textPrimary,
              marginBottom: '8px',
            }}
          >
            No tenant products yet
          </p>
          <p
            style={{
              fontSize: '14px',
              color: textSecondary,
              maxWidth: '420px',
              margin: '0 auto',
            }}
          >
            Tenant products are created by tenant admins in their workspace. When they add
            products or services, they will appear here with agents, tickets, and configuration
            status.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '20px',
          }}
        >
          {tenantProducts.map((p) => {
            const config = getConfigStatus(p);
            return (
              <div
                key={p.id}
                style={{
                  ...cardStyle,
                  padding: 0,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '4px',
                    background: p.status === 'active' ? accentBrand : '#EF4444',
                  }}
                />
                <div style={{ padding: '24px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: accentBrand,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#000',
                          fontSize: '16px',
                          fontWeight: 800,
                        }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3
                          style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: textPrimary,
                            margin: 0,
                          }}
                        >
                          {p.name}
                        </h3>
                        <p style={{ fontSize: '12px', color: textSecondary, margin: 0 }}>
                          {p.tenant_name ?? p.tenant_slug ?? '—'} · {p.product_name ?? p.product_slug ?? '—'}
                        </p>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background:
                          p.status === 'active'
                            ? isDark
                              ? 'rgba(34,197,94,0.1)'
                              : '#DCFCE7'
                            : isDark
                              ? 'rgba(239,68,68,0.1)'
                              : '#FEE2E2',
                        color:
                          p.status === 'active'
                            ? isDark
                              ? '#4ADE80'
                              : '#15803D'
                            : isDark
                              ? '#F87171'
                              : '#DC2626',
                      }}
                    >
                      {p.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {p.description ? (
                    <p
                      style={{
                        fontSize: '12px',
                        color: textSecondary,
                        marginBottom: '12px',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {p.description}
                    </p>
                  ) : null}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB',
                        borderRadius: '8px',
                        padding: '12px',
                        textAlign: 'center',
                      }}
                    >
                      <p style={{ fontSize: '18px', fontWeight: 700, color: '#3B82F6' }}>
                        {p.agents_count}
                      </p>
                      <p style={{ fontSize: '11px', color: textSecondary, fontWeight: 500 }}>
                        Agents
                      </p>
                    </div>
                    <div
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB',
                        borderRadius: '8px',
                        padding: '12px',
                        textAlign: 'center',
                      }}
                    >
                      <p style={{ fontSize: '18px', fontWeight: 700, color: '#8B5CF6' }}>
                        {p.tickets_count}
                      </p>
                      <p style={{ fontSize: '11px', color: textSecondary, fontWeight: 500 }}>
                        Tickets
                      </p>
                    </div>
                    <div
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB',
                        borderRadius: '8px',
                        padding: '12px',
                        textAlign: 'center',
                      }}
                    >
                      <p style={{ fontSize: '18px', fontWeight: 700, color: '#EC4899' }}>
                        {p.kb_articles_count}
                      </p>
                      <p style={{ fontSize: '11px', color: textSecondary, fontWeight: 500 }}>
                        KB
                      </p>
                    </div>
                    <div
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB',
                        borderRadius: '8px',
                        padding: '12px',
                        textAlign: 'center',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.plan_name || '—'}
                      </p>
                      <p style={{ fontSize: '11px', color: textSecondary, fontWeight: 500 }}>
                        Plan
                      </p>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: textSecondary,
                        }}
                      >
                        Configuration
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color:
                            config.pct === 100 ? '#22C55E' : accentBrand,
                        }}
                      >
                        {config.pct}%
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '6px',
                        borderRadius: '3px',
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
                      }}
                    >
                      <div
                        style={{
                          width: `${config.pct}%`,
                          height: '100%',
                          borderRadius: '3px',
                          background:
                            config.pct === 100 ? '#22C55E' : accentBrand,
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginTop: '10px',
                      }}
                    >
                      {Object.entries(config.checks).map(([key, val]) => (
                        <span
                          key={key}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            background: val
                              ? isDark
                                ? 'rgba(34,197,94,0.1)'
                                : '#DCFCE7'
                              : isDark
                                ? 'rgba(234,179,8,0.1)'
                                : '#FEF9C3',
                            color: val
                              ? isDark
                                ? '#4ADE80'
                                : '#15803D'
                              : isDark
                                ? '#FBBF24'
                                : '#A16207',
                          }}
                        >
                          {val ? '✓' : '○'} {key}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: `1px solid ${borderColor}`,
                      paddingTop: '16px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: textSecondary }}>
                      Created {new Date(p.created_at).toLocaleDateString()}
                    </span>
                    <Link
                      href="/super-admin/feature-flags"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${borderColor}`,
                        background: 'transparent',
                        color: isDark ? '#60A5FA' : '#2563EB',
                        fontSize: '12px',
                        fontWeight: 500,
                        textDecoration: 'none',
                      }}
                    >
                      Platform
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isDark ? '#1E293B' : '#F9FAFB' }}>
                {[
                  'Product',
                  'Tenant',
                  'Plan',
                  'Agents',
                  'Tickets',
                  'KB',
                  'Config',
                  'Status',
                  'Created',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
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
              {tenantProducts.map((p) => {
                const config = getConfigStatus(p);
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: accentBrand,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#000',
                            fontSize: '12px',
                            fontWeight: 800,
                          }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: textPrimary,
                              margin: 0,
                            }}
                          >
                            {p.name}
                          </p>
                          <p
                            style={{
                              fontSize: '11px',
                              color: textSecondary,
                              margin: 0,
                            }}
                          >
                            {p.product_name ?? p.product_slug ?? '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: textSecondary }}>
                      {p.tenant_name ?? p.tenant_slug ?? '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: textSecondary }}>
                      {p.plan_name ?? '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: textPrimary, fontWeight: 600 }}>
                      {p.agents_count}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: textPrimary, fontWeight: 600 }}>
                      {p.tickets_count}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: textPrimary, fontWeight: 600 }}>
                      {p.kb_articles_count}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <div
                          style={{
                            width: '48px',
                            height: '6px',
                            borderRadius: '3px',
                            background: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
                          }}
                        >
                          <div
                            style={{
                              width: `${config.pct}%`,
                              height: '100%',
                              borderRadius: '3px',
                              background:
                                config.pct === 100 ? '#22C55E' : accentBrand,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color:
                              config.pct === 100 ? '#22C55E' : accentBrand,
                          }}
                        >
                          {config.pct}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background:
                            p.status === 'active'
                              ? isDark
                                ? 'rgba(34,197,94,0.1)'
                                : '#DCFCE7'
                              : isDark
                                ? 'rgba(239,68,68,0.1)'
                                : '#FEE2E2',
                          color:
                            p.status === 'active'
                              ? isDark
                                ? '#4ADE80'
                                : '#15803D'
                              : isDark
                                ? '#F87171'
                                : '#DC2626',
                        }}
                      >
                        {p.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: textSecondary }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
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
