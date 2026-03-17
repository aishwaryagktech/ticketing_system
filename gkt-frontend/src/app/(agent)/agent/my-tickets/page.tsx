'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { ticketApi } from '@/lib/api/ticket.api';
import { useAuthStore } from '@/store/auth.store';
import { UserRound } from 'lucide-react';

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
  tenant_product?: { name: string } | null;
  updated_at: string;
  next_escalation_at?: string | null;
};

export default function MyTicketsPage() {
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const res = await ticketApi.list({ assigned: 'me', take: 100 });
        setItems((res.data?.items as TicketListItem[]) || []);
      } catch (e) {
        console.error('Failed to load my tickets', e);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const isDark = mounted && theme === 'dark';
  const textPrimary = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#334155';
  const cardBg = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)';
  const cardBorder = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(147,197,253,0.55)';
  const accentBlue = '#0EA5E9';

  const glassCard: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    borderRadius: 16,
    boxShadow: isDark ? '0 4px 6px -1px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
  };

  const priorityColor = (p: string) => {
    if (p === 'p1') return '#F87171';
    if (p === 'p2') return '#F59E0B';
    if (p === 'p3') return accentBlue;
    return textSecondary;
  };
  const statusColor = (s: string) => {
    if (s === 'open') return accentBlue;
    if (s === 'in_progress') return '#F59E0B';
    if (s === 'resolved' || s === 'closed') return '#4ADE80';
    return textSecondary;
  };

  if (!mounted) return null;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: textSecondary, marginBottom: 8 }}>
          <Link href="/agent/dashboard" style={{ color: textSecondary, textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ fontWeight: 600, color: textPrimary }}>My Tickets</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 950, letterSpacing: '-0.02em', color: textPrimary, margin: 0 }}>
          My Workspace
        </h1>
        <p style={{ fontSize: 13, color: textSecondary, marginTop: 4 }}>
          All tickets currently assigned to you ({items.length})
        </p>
      </div>

      {loading ? (
        <div style={{ ...glassCard, padding: '60px', textAlign: 'center', color: textSecondary }}>
          Loading your tickets…
        </div>
      ) : items.length === 0 ? (
        <div style={{ ...glassCard, padding: '60px', textAlign: 'center', color: textSecondary }}>
          No tickets assigned to you.
        </div>
      ) : (
        <div style={{ ...glassCard, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(219,234,254,0.3)' }}>
                {['Ticket', 'Product', 'Involvement', 'Subject', 'Status', 'Priority', 'SLA', 'Updated'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${cardBorder}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(t => {
                const isAssigned = t.assigned_to === user?.id;
                const statusNorm = String(t.status || '').toLowerCase().replace(/-/g, '_');
                const isClosedState = statusNorm === 'resolved' || statusNorm === 'closed';
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/agent/tickets/${t.id}`} style={{ color: accentBlue, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                        {t.ticket_number}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: textSecondary, fontWeight: 700 }}>
                      {t.tenant_product?.name || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{
                          width: 'fit-content',
                          padding: '3px 9px',
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          background: isAssigned ? (isDark ? 'rgba(59,130,246,0.1)' : 'rgba(219,234,254,1)') : (isDark ? 'rgba(168,85,247,0.1)' : 'rgba(243,232,255,1)'),
                          color: isAssigned ? '#60A5FA' : '#A855F7',
                          border: `1px solid ${isAssigned ? 'rgba(96,165,250,0.3)' : 'rgba(168,85,247,0.3)'}`
                        }}>
                          {isAssigned ? 'Assigned' : 'Escalated'}
                        </span>
                        {t.next_escalation_at && !isClosedState && (
                          <span style={{ fontSize: 9, color: (Math.floor((new Date(t.next_escalation_at).getTime() - Date.now()) / 60000) < 30) ? '#F87171' : textSecondary, fontWeight: 700 }}>
                            Jump @ {new Date(t.next_escalation_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: textPrimary, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: isDark ? `${statusColor(t.status)}20` : `${statusColor(t.status)}18`, color: statusColor(t.status) }}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: priorityColor(t.priority), textTransform: 'uppercase' }}>
                      {t.priority}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {t.sla_deadline ? (
                        <span style={{ fontSize: 11, color: textSecondary }}>{new Date(t.sla_deadline).toLocaleString()}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: textSecondary }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: textSecondary }}>
                      {new Date(t.updated_at).toLocaleDateString()}
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
