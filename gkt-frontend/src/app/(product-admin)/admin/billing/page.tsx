'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { billingApi } from '@/lib/api/billing.api';

type Plan = {
  id: string;
  name: string;
  max_agents: number;
  max_tickets_per_month: number;
  max_products: number;
  price_usd: number;
  price_inr: number;
};

type Invoice = {
  id: string;
  payment_id: string;
  order_id: string;
  plan_name: string;
  amount_inr: number;
  currency: string;
  status: string;
  payment_provider: string;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
};

type Subscription = {
  plan: {
    id: string;
    name: string;
    max_agents: number;
    max_tickets_per_month: number;
    price_inr: number;
    price_usd: number;
  } | null;
  subscription: {
    status: string;
    current_period_start: string;
    current_period_end: string;
    payment_provider: string;
    external_subscription_id: string;
  } | null;
};

function downloadInvoicePDF(inv: Invoice) {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  const fmtDT = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const invoiceNumber = `INV-${inv.payment_id.slice(-8).toUpperCase()}`;
  const amountFormatted = `₹${inv.amount_inr.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
  })}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #111; padding: 48px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand { font-size: 22px; font-weight: 800; color: #1a1a1a; }
    .brand span { color: #FACC15; }
    .invoice-label { text-align: right; }
    .invoice-label h2 { font-size: 28px; font-weight: 800; color: #111; letter-spacing: -0.5px; }
    .invoice-label p { font-size: 13px; color: #666; margin-top: 4px; }
    .divider { border: none; border-top: 1.5px solid #e5e7eb; margin: 28px 0; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .meta-group label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 4px; }
    .meta-group p { font-size: 14px; font-weight: 600; color: #111; }
    .meta-group .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; color: #374151; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #f9fafb; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; padding: 10px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    td { padding: 14px; font-size: 13px; color: #111; border-bottom: 1px solid #f3f4f6; }
    .amount-row { font-weight: 700; }
    .total-section { display: flex; justify-content: flex-end; }
    .total-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px 28px; min-width: 260px; }
    .total-box .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: #374151; }
    .total-box .total { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; margin-top: 12px; padding-top: 12px; border-top: 1.5px solid #e5e7eb; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #d1fae5; color: #065f46; }
    .footer { margin-top: 48px; text-align: center; font-size: 12px; color: #9ca3af; }
    @media print {
      body { padding: 32px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">GKT<span>.</span>app</div>
    <div class="invoice-label">
      <h2>INVOICE</h2>
      <p>${invoiceNumber}</p>
    </div>
  </div>

  <hr class="divider" />

  <div class="meta">
    <div class="meta-group">
      <label>Date Issued</label>
      <p>${fmtDT(inv.paid_at)}</p>
    </div>
    <div class="meta-group">
      <label>Status</label>
      <span class="badge">${inv.status.toUpperCase()}</span>
    </div>
    <div class="meta-group">
      <label>Payment ID</label>
      <p class="mono">${inv.payment_id}</p>
    </div>
    <div class="meta-group">
      <label>Order ID</label>
      <p class="mono">${inv.order_id}</p>
    </div>
    <div class="meta-group">
      <label>Billing Period</label>
      <p>${fmt(inv.period_start)} — ${fmt(inv.period_end)}</p>
    </div>
    <div class="meta-group">
      <label>Payment Method</label>
      <p style="text-transform:capitalize">${inv.payment_provider}</p>
    </div>
  </div>

  <hr class="divider" />

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th>Period</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td class="amount-row">${inv.plan_name} Plan — Monthly Subscription</td>
        <td>${fmt(inv.period_start)} – ${fmt(inv.period_end)}</td>
        <td style="text-align:right" class="amount-row">${amountFormatted}</td>
      </tr>
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-box">
      <div class="row"><span>Subtotal</span><span>${amountFormatted}</span></div>
      <div class="row"><span>Tax (0%)</span><span>₹0.00</span></div>
      <div class="total"><span>Total</span><span>${amountFormatted}</span></div>
    </div>
  </div>

  <div class="footer">
    <p>GKT Ticketing — gkt.app &nbsp;|&nbsp; Thank you for your business.</p>
    <p style="margin-top:6px">This is a computer-generated invoice and does not require a signature.</p>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export default function BillingPage() {
  const { resolvedTheme } = useTheme();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingReceipt, setViewingReceipt] = useState<Invoice | null>(null);

  // Plans modal state
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [plansSaving, setPlansSaving] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<{
    payment_id: string;
    order_id: string;
    plan_name: string;
    amount_inr: number;
    paid_at: string;
    valid_until: string;
  } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [subRes, invRes] = await Promise.all([
        billingApi.getSubscription().catch(() => null),
        billingApi.listInvoices(50).catch(() => null),
      ]);
      setSubscription(subRes?.data ?? null);
      setInvoices(Array.isArray(invRes?.data) ? invRes.data : []);
    } catch {
      setError('Failed to load billing data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError('');
    try {
      const res = await billingApi.listPlans();
      setPlans(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPlansError('Failed to load plans. Please try again.');
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const openPlansModal = () => {
    setShowPlansModal(true);
    if (plans.length === 0) loadPlans();
  };

  useEffect(() => { if (mounted) load(); }, [mounted, load]);

  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';
  const pageBg = isDark
    ? 'linear-gradient(160deg, #020617 0%, #020617 35%, #020617 100%)'
    : 'linear-gradient(160deg, #EFF6FF 0%, #DBEAFE 30%, #F8FAFC 60%, #F1F5F9 100%)';
  const surface = isDark ? '#0f172a' : '#ffffff';
  const textPrimary = isDark ? '#F1F5F9' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const border = isDark ? '#1e293b' : '#E2E8F0';
  const accentBrand = isDark ? '#FACC15' : '#CA8A04';
  const accentSoft = isDark ? 'rgba(250,204,21,0.08)' : 'rgba(202,138,4,0.07)';
  const accentBorder = isDark ? 'rgba(250,204,21,0.25)' : 'rgba(202,138,4,0.25)';
  const accentBrandSoft = isDark ? 'rgba(250,204,21,0.06)' : 'rgba(202,138,4,0.06)';
  const accentBrandBorder = isDark ? 'rgba(250,204,21,0.3)' : 'rgba(202,138,4,0.3)';
  const accentChipBg = isDark ? 'rgba(250,204,21,0.12)' : 'rgba(202,138,4,0.12)';
  const accentChipText = isDark ? '#FACC15' : '#92400E';

  const cardBg = isDark ? 'rgba(15,23,42,0.96)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(148,163,184,0.38)' : 'rgba(148,163,184,0.35)';
  const glassCard: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    borderRadius: 18,
    boxShadow: isDark
      ? '0 26px 80px rgba(15,23,42,0.85)'
      : '0 24px 70px rgba(15,23,42,0.12)',
  };

  const sub = subscription?.subscription;
  const plan = subscription?.plan;
  const isActive = sub?.status === 'active';
  const renewalDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null;

  const statusColor = (s: string) =>
    s === 'paid' || s === 'active' ? '#22c55e' : s === 'pending' ? '#f59e0b' : '#ef4444';
  const statusBg = (s: string) =>
    s === 'paid' || s === 'active'
      ? 'rgba(34,197,94,0.12)'
      : s === 'pending'
      ? 'rgba(245,158,11,0.12)'
      : 'rgba(239,68,68,0.12)';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: pageBg,
        padding: '32px 16px 40px',
        fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif',
        color: textPrimary,
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Link
            href="/admin/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: textSecondary,
              textDecoration: 'none',
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${border}`,
              background: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
            }}
          >
            ← Dashboard
          </Link>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: textPrimary, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
              Billing &amp; Invoices
            </h1>
            <p style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}>
              {(user as any)?.tenant_name || 'Your workspace'} · manage your subscription and download invoices
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 12,
              padding: '10px 14px',
              color: '#fecaca',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: textSecondary, fontSize: 13, padding: 24 }}>Loading billing data…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Current Plan Card */}
            <div
              style={{
                ...glassCard,
                border: `1px solid ${plan ? accentBorder : cardBorder}`,
                padding: '24px 24px',
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Current Plan</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: textPrimary }}>
                    {plan?.name ?? 'No plan selected'}
                  </span>
                  {isActive && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                      ACTIVE
                    </span>
                  )}
                  {!plan && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: statusBg('none'), color: '#94a3b8' }}>
                      NONE
                    </span>
                  )}
                </div>
                {plan && (
                  <span style={{ fontSize: 13, color: textSecondary }}>
                    {plan.max_agents === -1 ? 'Unlimited agents' : `${plan.max_agents} agents`}
                    {' · '}
                    {plan.max_tickets_per_month === -1 ? 'unlimited tickets/mo' : `${plan.max_tickets_per_month.toLocaleString()} tickets/mo`}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                {plan && (
                  <>
                    <div style={{ fontSize: 28, fontWeight: 800, color: textPrimary }}>
                      ₹{Number(plan.price_inr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: 13, fontWeight: 500, color: textSecondary }}>/mo</span>
                    </div>
                    {renewalDate && (
                      <span style={{ fontSize: 12, color: textSecondary }}>Renews {renewalDate}</span>
                    )}
                    <button
                      type="button"
                      onClick={openPlansModal}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 14px',
                        borderRadius: 8,
                        border: `1px solid ${border}`,
                        background: 'transparent',
                        color: textSecondary,
                        cursor: 'pointer',
                        marginTop: 2,
                      }}
                    >
                      Change plan
                    </button>
                  </>
                )}
                {!plan && (
                  <button
                    type="button"
                    onClick={openPlansModal}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '9px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: accentBrand,
                      color: '#0B1120',
                      cursor: 'pointer',
                    }}
                  >
                    Choose a plan →
                  </button>
                )}
              </div>
            </div>

            {/* Sub-details */}
            {sub && (
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: `1px solid ${border}`,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 16,
                }}
              >
                {[
                  {
                    label: 'Provider',
                    value: sub.payment_provider.charAt(0).toUpperCase() + sub.payment_provider.slice(1),
                  },
                  {
                    label: 'Billing start',
                    value: new Date(sub.current_period_start).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    }),
                  },
                  {
                    label: 'Next renewal',
                    value: renewalDate ?? '—',
                  },
                  {
                    label: 'Last payment ref.',
                    value: sub.external_subscription_id.slice(0, 20) + (sub.external_subscription_id.length > 20 ? '…' : ''),
                    mono: true,
                  },
                ].map(({ label, value, mono }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 10, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
            </div>

            {/* Invoice History */}
            <div style={{ ...glassCard, border: `1px solid ${border}`, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>Invoice History</h2>
                <p style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                  {invoices.length} {invoices.length === 1 ? 'transaction' : 'transactions'} found
                </p>
              </div>
            </div>

            {invoices.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: textSecondary, fontSize: 13 }}>
                No invoices yet. Your payment history will appear here after your first transaction.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: isDark ? '#0a1628' : '#F8FAFC' }}>
                      {['Invoice', 'Date', 'Plan', 'Amount', 'Period', 'Status', 'Actions'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 16px',
                            fontSize: 11,
                            fontWeight: 600,
                            color: textSecondary,
                            textAlign: 'left',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            borderBottom: `1px solid ${border}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, idx) => {
                      const invoiceNum = `INV-${inv.payment_id.slice(-8).toUpperCase()}`;
                      return (
                        <tr
                          key={inv.id}
                          style={{
                            background: idx % 2 === 0 ? 'transparent' : isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.012)',
                            transition: 'background 0.15s',
                          }}
                        >
                          {/* Invoice # */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: accentBrand }}>
                              {invoiceNum}
                            </span>
                          </td>

                          {/* Date */}
                          <td style={{ padding: '14px 16px', fontSize: 13, color: textPrimary, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {inv.paid_at
                              ? new Date(inv.paid_at).toLocaleDateString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })
                              : '—'}
                          </td>

                          {/* Plan */}
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: textPrimary, verticalAlign: 'middle' }}>
                            {inv.plan_name}
                          </td>

                          {/* Amount */}
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: textPrimary, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            ₹{inv.amount_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Period */}
                          <td style={{ padding: '14px 16px', fontSize: 12, color: textSecondary, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {inv.period_start && inv.period_end
                              ? `${new Date(inv.period_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(inv.period_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                              : '—'}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '3px 9px',
                                borderRadius: 999,
                                background: statusBg(inv.status),
                                color: statusColor(inv.status),
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {inv.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setViewingReceipt(inv)}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '5px 10px',
                                  borderRadius: 7,
                                  border: `1px solid ${border}`,
                                  background: 'transparent',
                                  color: textSecondary,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadInvoicePDF(inv)}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '5px 10px',
                                  borderRadius: 7,
                                  border: 'none',
                                  background: accentSoft,
                                  color: accentBrand,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                ↓ Download
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        )}

      {/* Plans Modal */}
      {showPlansModal && (
        <div
          onClick={() => setShowPlansModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${border}`,
              borderRadius: 20,
              padding: '28px 24px',
              width: '100%',
              maxWidth: 720,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>Workspace plans</div>
                <div style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}>
                  Choose a plan below. Your current plan is highlighted. Click &quot;Select plan&quot; to switch.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlansModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: textSecondary,
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {plansError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, color: '#ef4444', fontSize: 12 }}>
                {plansError}
              </div>
            )}

            {plansLoading ? (
              <div style={{ fontSize: 13, color: textSecondary, padding: '24px 0', textAlign: 'center' }}>
                Loading plans…
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                {plans.map((p) => {
                  const isSelected = p.id === subscription?.plan?.id;
                  const priceUsd = Number(p.price_usd);
                  const isUnlimited = p.max_agents === -1 || p.max_tickets_per_month === -1;
                  return (
                    <div
                      key={p.id}
                      style={{
                        borderRadius: 14,
                        border: isSelected
                          ? `2px solid ${accentBrandBorder}`
                          : `1px solid ${border}`,
                        background: isSelected ? accentBrandSoft : isDark ? '#020617' : '#ffffff',
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>{p.name}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: textPrimary }}>
                        {isNaN(priceUsd) ? '—' : `$${priceUsd}`}
                        <span style={{ fontSize: 12, fontWeight: 500, color: textSecondary }}> /mo</span>
                      </div>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 12, color: textSecondary, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <li>
                          {isUnlimited
                            ? 'Unlimited agents & tickets'
                            : `${p.max_agents === -1 ? 'Unlimited' : p.max_agents} agents`}
                        </li>
                        {p.max_tickets_per_month !== -1 && (
                          <li>{p.max_tickets_per_month.toLocaleString()} tickets/mo</li>
                        )}
                      </ul>

                      {isSelected ? (
                        <div
                          style={{
                            marginTop: 'auto',
                            fontSize: 11,
                            fontWeight: 700,
                            color: accentChipText,
                            background: accentChipBg,
                            borderRadius: 999,
                            padding: '6px 10px',
                            alignSelf: 'flex-start',
                          }}
                        >
                          Current plan
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={plansSaving}
                          onClick={async () => {
                            setPlansError('');
                            setPlansSaving(true);
                            try {
                              const res = await billingApi.createOrder(p.id);
                              const { order_id, amount, currency, key_id } = res.data;

                              const RazorpayCheckout = (window as any).Razorpay;
                              if (!RazorpayCheckout) {
                                setPlansError('Payment gateway failed to load. Please refresh and try again.');
                                setPlansSaving(false);
                                return;
                              }

                              const options = {
                                key: key_id,
                                amount,
                                currency,
                                name: 'GKT Ticketing',
                                description: `Subscribe to ${p.name}`,
                                order_id,
                                handler: async (response: any) => {
                                  try {
                                    const verifyRes = await billingApi.verifyPayment({
                                      razorpay_order_id: response.razorpay_order_id,
                                      razorpay_payment_id: response.razorpay_payment_id,
                                      razorpay_signature: response.razorpay_signature,
                                      plan_id: p.id,
                                    });
                                    setShowPlansModal(false);
                                    setPaymentReceipt(verifyRes.data?.transaction ?? {
                                      payment_id: response.razorpay_payment_id,
                                      order_id: response.razorpay_order_id,
                                      plan_name: p.name,
                                      amount_inr: Math.round(amount / 100),
                                      paid_at: new Date().toISOString(),
                                      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                                    });
                                    // Refresh billing data
                                    await load();
                                  } catch {
                                    setPlansError('Payment succeeded but activation failed. Contact support.');
                                  } finally {
                                    setPlansSaving(false);
                                  }
                                },
                                modal: {
                                  ondismiss: () => setPlansSaving(false),
                                },
                                theme: { color: accentBrand },
                              };

                              const rzp = new RazorpayCheckout(options);
                              rzp.on('payment.failed', (r: any) => {
                                setPlansError(r?.error?.description || 'Payment failed. Please try again.');
                                setPlansSaving(false);
                              });
                              rzp.open();
                            } catch (err: any) {
                              setPlansError(
                                err?.response?.data?.error || err?.message || 'Failed to initiate payment',
                              );
                              setPlansSaving(false);
                            }
                          }}
                          style={{
                            marginTop: 'auto',
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 10,
                            border: 'none',
                            background: accentBrand,
                            color: '#0B1120',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: plansSaving ? 'not-allowed' : 'pointer',
                            opacity: plansSaving ? 0.8 : 1,
                          }}
                        >
                          {plansSaving ? 'Opening payment…' : 'Select plan'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Receipt Modal (shown after successful payment) */}
      {paymentReceipt && (
        <div
          onClick={() => setPaymentReceipt(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${border}`,
              borderRadius: 20,
              padding: '32px 28px',
              width: '100%',
              maxWidth: 420,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>✓</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary }}>Payment Successful</div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#22c55e', letterSpacing: 0.5 }}>PAID</span>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 24, padding: '16px 0', borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}>
              <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4 }}>Amount Paid</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: textPrimary }}>₹{paymentReceipt.amount_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>INR</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 24 }}>
              {[
                { label: 'Plan', value: paymentReceipt.plan_name, bold: true },
                { label: 'Date & Time', value: new Date(paymentReceipt.paid_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                { label: 'Valid Until', value: new Date(paymentReceipt.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Payment ID', value: paymentReceipt.payment_id, mono: true },
                { label: 'Order ID', value: paymentReceipt.order_id, mono: true },
                { label: 'Payment Method', value: 'Razorpay' },
              ].map(({ label, value, bold, mono }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 12, color: textSecondary, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: bold ? 700 : 500, color: bold ? accentBrand : textPrimary, fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPaymentReceipt(null)}
              style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: 'none', background: accentBrand, color: '#0B1120', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Receipt Detail Modal */}
      {viewingReceipt && (
        <div
          onClick={() => setViewingReceipt(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${border}`,
              borderRadius: 20,
              padding: '32px 28px',
              width: '100%',
              maxWidth: 440,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {/* Receipt header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Receipt</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: textPrimary, fontFamily: 'monospace' }}>
                  INV-{viewingReceipt.payment_id.slice(-8).toUpperCase()}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: statusBg(viewingReceipt.status),
                  color: statusColor(viewingReceipt.status),
                  textTransform: 'uppercase',
                }}
              >
                {viewingReceipt.status}
              </span>
            </div>

            {/* Amount */}
            <div
              style={{
                textAlign: 'center',
                padding: '20px 0',
                borderTop: `1px solid ${border}`,
                borderBottom: `1px solid ${border}`,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 11, color: textSecondary, marginBottom: 6 }}>Amount Paid</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: textPrimary }}>
                ₹{viewingReceipt.amount_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>INR</div>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 24 }}>
              {[
                { label: 'Plan', value: viewingReceipt.plan_name, bold: true },
                {
                  label: 'Date & Time',
                  value: viewingReceipt.paid_at
                    ? new Date(viewingReceipt.paid_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })
                    : '—',
                },
                {
                  label: 'Billing Period',
                  value: viewingReceipt.period_start && viewingReceipt.period_end
                    ? `${new Date(viewingReceipt.period_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(viewingReceipt.period_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    : '—',
                },
                { label: 'Payment ID', value: viewingReceipt.payment_id, mono: true },
                { label: 'Order ID', value: viewingReceipt.order_id, mono: true },
                { label: 'Payment Method', value: viewingReceipt.payment_provider.charAt(0).toUpperCase() + viewingReceipt.payment_provider.slice(1) },
              ].map(({ label, value, bold, mono }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 12, color: textSecondary, flexShrink: 0 }}>{label}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: bold ? 700 : 500,
                      color: bold ? accentBrand : textPrimary,
                      fontFamily: mono ? 'monospace' : undefined,
                      wordBreak: 'break-all',
                      textAlign: 'right',
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => downloadInvoicePDF(viewingReceipt)}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: accentBrand,
                  color: '#0B1120',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ↓ Download PDF
              </button>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 12,
                  border: `1px solid ${border}`,
                  background: 'transparent',
                  color: textSecondary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
