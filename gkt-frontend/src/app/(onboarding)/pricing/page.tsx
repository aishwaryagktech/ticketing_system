'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { onboardingApi } from '@/lib/api/onboarding.api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function PricingPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, hydrate } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState<Array<{ id: string; name: string; max_agents: number; max_tickets_per_month: number; price_usd: unknown }>>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!mounted || !user) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('gkt_token') : null;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`${API_BASE}/api/billing/plans`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => (Array.isArray(data) ? setPlans(data) : setPlans([])))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [mounted, user]);

  useEffect(() => {
    if (mounted && !user) router.push('/login?next=/pricing');
  }, [mounted, user, router]);

  const handleSelect = async (planId: string) => {
    setError('');
    setSelecting(planId);
    try {
      await onboardingApi.setPlan(planId);
      router.push('/setup/products');
    } catch (e) {
      setError('Failed to select plan. Please try again.');
      setSelecting(null);
    }
  };

  const isDark = mounted && theme === 'dark';
  const bgPrimary = isDark ? '#0F172A' : '#F8FAFC';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentBrand = '#FACC15';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : '#E2E8F0';

  if (!mounted || !user) return null;

  return (
    <div style={{ minHeight: '100vh', background: bgPrimary, color: textPrimary, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '800px', height: '400px', background: `radial-gradient(ellipse at top, ${isDark ? 'rgba(250,204,21,0.06)' : 'rgba(250,204,21,0.1)'} 0%, transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Choose your plan</h1>
          <p style={{ fontSize: 16, color: textSecondary }}>Select a plan to continue setup. Payment can be configured later.</p>
        </div>

        {error && (
          <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#ef4444', marginBottom: 24, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: textSecondary }}>Loading plans...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {plans.map((plan) => {
              const price = Number(plan.price_usd);
              const isUnlimited = plan.max_agents === -1 || plan.max_tickets_per_month === -1;
              return (
                <div
                  key={plan.id}
                  style={{
                    background: cardBg,
                    borderRadius: 16,
                    border: `2px solid ${borderColor}`,
                    padding: 28,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{plan.name}</div>
                  <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>
                    ${isNaN(price) ? '—' : price}
                    <span style={{ fontSize: 14, fontWeight: 500, color: textSecondary }}>/mo</span>
                  </div>
                  <ul style={{ listStyle: 'none', margin: '16px 0 24px', padding: 0, fontSize: 14, color: textSecondary }}>
                    <li>{isUnlimited ? 'Unlimited' : plan.max_agents} agents</li>
                    <li>{isUnlimited ? 'Unlimited' : plan.max_tickets_per_month.toLocaleString()} tickets/mo</li>
                  </ul>
                  <button
                    onClick={() => handleSelect(plan.id)}
                    disabled={!!selecting}
                    style={{
                      padding: '12px 24px',
                      borderRadius: 10,
                      background: accentBrand,
                      color: '#000',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: selecting ? 'not-allowed' : 'pointer',
                      opacity: selecting === plan.id ? 0.8 : 1,
                    }}
                  >
                    {selecting === plan.id ? 'Selecting...' : 'Select'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: textSecondary }}>
          Payment processing will be available soon. Your selection will be saved.
        </p>
      </div>
    </div>
  );
}
