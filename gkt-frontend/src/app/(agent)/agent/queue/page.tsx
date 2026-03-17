'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ticketApi } from '@/lib/api/ticket.api';
import { agentApi } from '@/lib/api/agent.api';
import { useAuthStore } from '@/store/auth.store';
import { ListTree, RefreshCw, UserPlus, ExternalLink } from 'lucide-react';

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
  next_escalation_at?: string | null;
};

type ProductInfo = { id: string; name: string; support_level: string };

export default function AgentQueuePage() {
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Load agent's assigned products
  useEffect(() => {
    agentApi.myProducts()
      .then((res) => {
        const list = (res.data?.items as any[]) || [];
        setProducts(list.filter(x => x && typeof x.id === 'string').map(x => ({
          id: String(x.id), name: String(x.name || 'Product'), support_level: String(x.support_level || '')
        })));
      })
      .catch(() => setProducts([]));
  }, []);

  // Fetch unassigned tickets across all assigned products
  const fetchTickets = async () => {
    setLoading(true);
    try {
      if (products.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      const results = await Promise.all(
        products.map(p =>
          ticketApi.list({ assigned: 'unassigned', tenant_product_id: p.id, take: 100 })
        )
      );
      const all: TicketListItem[] = [];
      for (const res of results) {
        const list = (res.data?.items as TicketListItem[]) || [];
        all.push(...list);
      }
      // Sort by most recent
      all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setItems(all);
    } catch (e) {
      console.error('Failed to load queue', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (products.length > 0) fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

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

  const productName = (tpId: string | null) => {
    if (!tpId) return '—';
    const p = products.find(x => x.id === tpId);
    return p ? p.name : tpId.slice(0, 8) + '…';
  };

  if (!mounted) return null;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: textSecondary, marginBottom: 8 }}>
          <Link href="/agent/dashboard" style={{ color: textSecondary, textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ fontWeight: 600, color: textPrimary }}>Ticket Queue</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 950, letterSpacing: '-0.02em', color: textPrimary, margin: 0 }}>
              Unassigned Queue
            </h1>
            <p style={{ fontSize: 13, color: textSecondary, marginTop: 4 }}>
              Showing tickets across your products ({items.length})
            </p>
          </div>
          <button
            onClick={fetchTickets}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              border: `1px solid ${cardBorder}`,
              background: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(219,234,254,0.5)',
              color: accentBlue, fontSize: 12, fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ ...glassCard, padding: '60px', textAlign: 'center', color: textSecondary }}>
          Loading unassigned tickets…
        </div>
      ) : items.length === 0 ? (
        <div style={{ ...glassCard, padding: '60px', textAlign: 'center', color: textSecondary }}>
          No unassigned tickets in the queue.
        </div>
      ) : (
        <div style={{ ...glassCard, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(219,234,254,0.3)' }}>
                {['Ticket', 'Subject', 'Product', 'Tier', 'Priority', 'SLA', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${cardBorder}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/agent/tickets/${t.id}`} style={{ color: accentBlue, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                      {t.ticket_number}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: textPrimary, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.subject}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: textSecondary }}>
                    {productName(t.tenant_product_id)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{
                        width: 'fit-content',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        background: t.escalation_level > 0 ? (isDark ? 'rgba(168,85,247,0.15)' : '#F3E8FF') : (isDark ? 'rgba(148,163,184,0.1)' : '#F1F5F9'),
                        color: t.escalation_level > 0 ? '#A855F7' : textSecondary,
                        border: `1px solid ${t.escalation_level > 0 ? 'rgba(168,85,247,0.3)' : cardBorder}`
                      }}>
                        L{t.escalation_level + 1}
                      </span>
                      {t.next_escalation_at && (
                        <span style={{ fontSize: 9, color: (Math.floor((new Date(t.next_escalation_at).getTime() - Date.now()) / 60000) < 30) ? '#F87171' : textSecondary, fontWeight: 700 }}>
                          Jump @ {new Date(t.next_escalation_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: priorityColor(t.priority), textTransform: 'uppercase' }}>
                    {t.priority}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.sla_breached ? (
                      <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2', color: '#EF4444' }}>Breached</span>
                    ) : t.sla_deadline ? (
                      <span style={{ fontSize: 11, color: textSecondary }}>{new Date(t.sla_deadline).toLocaleString()}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: textSecondary }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={async () => {
                          setAssigningId(t.id);
                          try {
                            await ticketApi.assign(t.id, user?.id || '');
                            setItems(prev => prev.filter(x => x.id !== t.id));
                            router.push(`/agent/tickets/${t.id}`);
                          } catch (e: any) {
                            alert(e?.response?.data?.error || 'Failed to assign');
                          } finally {
                            setAssigningId(null);
                          }
                        }}
                        disabled={assigningId === t.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '5px 10px', borderRadius: 6,
                          border: 'none',
                          background: isDark ? 'rgba(74,222,128,0.12)' : '#DCFCE7',
                          color: '#16A34A', fontSize: 11, fontWeight: 700,
                          cursor: assigningId === t.id ? 'not-allowed' : 'pointer',
                          opacity: assigningId === t.id ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <UserPlus size={12} />
                        {assigningId === t.id ? 'Assigning…' : 'Assign to Me'}
                      </button>
                      <Link href={`/agent/tickets/${t.id}`} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '5px 10px', borderRadius: 6,
                        border: `1px solid ${cardBorder}`,
                        background: 'transparent',
                        color: accentBlue, fontSize: 11, fontWeight: 600,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}>
                        <ExternalLink size={12} />
                        Open
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
