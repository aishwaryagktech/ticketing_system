'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type Plan = {
  id: string;
  name: string;
  max_agents: number;
  max_tickets_per_month: number;
  price_usd: number;
  price_inr?: number;
};

const POPULAR_INDEX = 1; // mark the middle plan as "Popular"

export default function PublicPricingPage() {
  const { theme, setTheme } = useTheme();
  const { user, hydrate } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!mounted) return;
    fetch(`${API_BASE}/api/billing/plans/public`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [mounted]);

  const isDark = !mounted || theme !== 'light';
  const navyBg = isDark ? '#020617' : '#F9FAFB';
  const textPrimary = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const electricBlue = '#0EA5E9';
  const accentYellow = '#FACC15';
  const subtleBlue = isDark ? '#1D4ED8' : '#DBEAFE';
  const mutedBorder = isDark ? 'rgba(30,64,175,0.55)' : '#E0F2FE';
  const cardBg = isDark ? '#0F172A' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : '#E5E7EB';

  const featuresByTier: Record<string, string[]> = {
    starter: ['Up to 5 agents', 'Basic AI bot', 'Email ticketing', 'Standard SLA', 'Community support'],
    growth: ['Up to 20 agents', 'Advanced AI bot', 'Email + Widget', 'Custom SLA rules', 'Escalation workflows', 'Priority support'],
    enterprise: ['Unlimited agents', 'Full AI suite', 'All channels', 'Custom SLA & analytics', 'Advanced escalation', 'Dedicated support', 'SSO & audit logs'],
  };

  const getFeatures = (plan: Plan, idx: number): string[] => {
    const nameKey = plan.name.toLowerCase();
    for (const key of Object.keys(featuresByTier)) {
      if (nameKey.includes(key)) return featuresByTier[key];
    }
    const tierKeys = Object.keys(featuresByTier);
    return featuresByTier[tierKeys[Math.min(idx, tierKeys.length - 1)]];
  };

  if (!mounted) return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: isDark
          ? `radial-gradient(circle at top left, #1D4ED8 0, ${navyBg} 45%, #020617 100%)`
          : `radial-gradient(circle at top left, #FFFFFF 0, #F3F4F6 40%, #E5E7EB 100%)`,
        color: textPrimary,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      }}
    >
      {/* Nav */}
      <header
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: `1px solid ${mutedBorder}`,
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: subtleBlue, border: `1px solid ${mutedBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ width: 16, height: 16, borderRadius: 999, background: electricBlue }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>GKT AI Ticketing</span>
            <span style={{ fontSize: 11, color: textSecondary }}>Modern AI workspace for education teams</span>
          </div>
        </Link>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{ background: 'none', border: `1px solid ${borderColor}`, borderRadius: 8, padding: '6px 10px', color: textSecondary, cursor: 'pointer', fontSize: 14 }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          {user ? (
            <Link href="/admin/dashboard"
              style={{ padding: '8px 18px', borderRadius: 8, background: accentYellow, color: '#000', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login"
                style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${borderColor}`, color: textPrimary, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                Sign in
              </Link>
              <Link href="/signup"
                style={{ padding: '8px 18px', borderRadius: 8, background: accentYellow, color: '#000', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '64px 24px 48px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', marginBottom: 20, padding: '5px 14px',
          borderRadius: 999, background: isDark ? 'rgba(14,165,233,0.12)' : '#EFF6FF',
          border: `1px solid ${isDark ? 'rgba(14,165,233,0.3)' : '#BFDBFE'}`,
          fontSize: 12, fontWeight: 600, color: electricBlue, letterSpacing: '0.04em',
        }}>
          SIMPLE, TRANSPARENT PRICING
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, margin: '0 0 16px', lineHeight: 1.15 }}>
          Choose the plan that fits<br />
          <span style={{ color: accentYellow }}>your team</span>
        </h1>
        <p style={{ fontSize: 16, color: textSecondary, maxWidth: 520, margin: '0 auto' }}>
          All plans include the core AI ticketing engine. Scale up as your team grows — no hidden fees.
        </p>
      </div>

      {/* Plans grid */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: textSecondary, fontSize: 14 }}>Loading plans…</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: textSecondary, fontSize: 14 }}>No plans available right now.</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)`,
            gap: 24,
          }}>
            {plans.map((plan, idx) => {
              const price = Number(plan.price_usd);
              const isUnlimited = plan.max_agents === -1 || plan.max_tickets_per_month === -1;
              const isPopular = idx === POPULAR_INDEX && plans.length > 1;
              const features = getFeatures(plan, idx);

              return (
                <div
                  key={plan.id}
                  style={{
                    position: 'relative',
                    background: isPopular
                      ? isDark ? 'rgba(250,204,21,0.06)' : '#FFFBEB'
                      : cardBg,
                    borderRadius: 20,
                    border: `2px solid ${isPopular ? accentYellow : borderColor}`,
                    padding: '32px 28px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: isPopular
                      ? `0 8px 32px rgba(250,204,21,0.15)`
                      : `0 2px 12px rgba(0,0,0,0.08)`,
                  }}
                >
                  {isPopular && (
                    <div style={{
                      position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                      background: accentYellow, color: '#000', fontSize: 11, fontWeight: 800,
                      padding: '4px 14px', borderRadius: 999, letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                    }}>
                      MOST POPULAR
                    </div>
                  )}

                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{plan.name}</div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 6 }}>
                    <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>
                      ${isNaN(price) ? '—' : price}
                    </span>
                    <span style={{ fontSize: 13, color: textSecondary, marginBottom: 6 }}>/month</span>
                  </div>

                  <div style={{ fontSize: 12, color: textSecondary, marginBottom: 24 }}>
                    {isUnlimited ? 'Unlimited agents & tickets' : `${plan.max_agents} agents · ${plan.max_tickets_per_month.toLocaleString()} tickets/mo`}
                  </div>

                  <ul style={{ listStyle: 'none', margin: '0 0 28px', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    {features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: textSecondary }}>
                        <span style={{ color: accentYellow, fontSize: 14, flexShrink: 0 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={user ? '/admin/dashboard' : '/signup'}
                    style={{
                      display: 'block', textAlign: 'center', textDecoration: 'none',
                      padding: '13px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                      background: isPopular ? accentYellow : isDark ? 'rgba(14,165,233,0.15)' : '#EFF6FF',
                      color: isPopular ? '#000' : electricBlue,
                      border: isPopular ? 'none' : `1px solid ${isDark ? 'rgba(14,165,233,0.3)' : '#BFDBFE'}`,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {user ? 'Go to dashboard' : 'Get started free'}
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom note */}
        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: textSecondary }}>
          All plans come with a free trial period. No credit card required to get started.{' '}
          <Link href="/support" style={{ color: electricBlue, textDecoration: 'none' }}>Contact us</Link> for enterprise pricing.
        </p>
      </div>
    </div>
  );
}
