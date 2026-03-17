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
  features?: string[] | null;
};

const POPULAR_INDEX = 1;

export default function PublicPricingPage() {
  const { theme, setTheme } = useTheme();
  const { user, hydrate } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!mounted) return;
    fetch(`${API_BASE}/api/billing/plans/public`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [mounted]);

  const isDark = !mounted || theme !== 'light';

  // ── Design tokens (matches landing page) ──
  const pageBg = isDark
    ? 'linear-gradient(160deg,#020617 0%,#0a1628 40%,#060d1f 100%)'
    : 'linear-gradient(160deg,#EFF6FF 0%,#DBEAFE 30%,#F0F9FF 65%,#E0F2FE 100%)';
  const textPrimary   = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#334155';
  const accentBlue    = '#0EA5E9';
  const accentIndigo  = '#6366F1';
  const cardBg        = isDark ? 'rgba(15,23,42,0.85)'    : 'rgba(255,255,255,0.85)';
  const cardBorder    = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(147,197,253,0.6)';
  const pillBg        = isDark ? 'rgba(14,165,233,0.12)'  : 'rgba(219,234,254,0.9)';
  const pillBorder    = isDark ? 'rgba(14,165,233,0.3)'   : 'rgba(147,197,253,0.8)';
  const sectionBorder = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(147,197,253,0.4)';

  if (!mounted) return null;

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: textPrimary, fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif', overflowX: 'hidden' }}>

      {/* Blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, left: -80, width: 500, height: 500, borderRadius: '50%', background: isDark ? 'rgba(29,78,216,0.15)' : 'rgba(147,197,253,0.35)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', top: 200, right: -100, width: 400, height: 400, borderRadius: '50%', background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(199,210,254,0.4)', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: '40%', width: 300, height: 300, borderRadius: '50%', background: isDark ? 'rgba(14,165,233,0.07)' : 'rgba(186,230,253,0.35)', filter: 'blur(60px)' }} />
      </div>

      {/* ── Nav ── */}
      <header style={{ position: 'relative', zIndex: 10, maxWidth: 1140, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: isDark ? 'rgba(14,165,233,0.2)' : '#BFDBFE', border: `1px solid ${pillBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: 999, background: accentBlue }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>GKT AI Ticketing</div>
            <div style={{ fontSize: 10, color: textSecondary }}>Modern AI workspace for education teams</div>
          </div>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 13, color: textSecondary }}>
          {[['Docs', '/dev-hub'], ['Support', '/support']].map(([l, h]) => (
            <Link key={l} href={h} style={{ textDecoration: 'none', color: textSecondary, fontWeight: 500 }}>{l}</Link>
          ))}
        </nav>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} style={{ padding: '5px 12px', borderRadius: 999, border: `1px solid ${cardBorder}`, background: pillBg, color: textSecondary, fontSize: 11, cursor: 'pointer' }}>
            {isDark ? '☀ Light' : '🌙 Dark'}
          </button>
          {user ? (
            <Link href="/admin/dashboard" style={{ padding: '8px 18px', borderRadius: 999, background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Dashboard</Link>
          ) : (
            <>
              <Link href="/login" style={{ padding: '7px 16px', borderRadius: 999, border: `1px solid ${cardBorder}`, color: textSecondary, fontSize: 13, fontWeight: 600, textDecoration: 'none', background: isDark ? 'transparent' : 'rgba(255,255,255,0.7)' }}>Log in</Link>
              <Link href="/signup" style={{ padding: '8px 18px', borderRadius: 999, background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(14,165,233,0.4)' }}>Get started →</Link>
            </>
          )}
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── Hero ── */}
        <section style={{ textAlign: 'center', padding: '60px 0 52px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 999, background: pillBg, border: `1px solid ${pillBorder}`, fontSize: 11, color: accentBlue, fontWeight: 700, marginBottom: 20 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: accentBlue, display: 'inline-block' }} />
            SIMPLE, TRANSPARENT PRICING
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 16 }}>
            Choose the plan that fits{' '}
            <span style={{ background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>your team</span>
          </h1>
          <p style={{ fontSize: 16, color: textSecondary, maxWidth: 500, margin: '0 auto 10px' }}>
            All plans include the core AI ticketing engine. Scale as you grow — no hidden fees.
          </p>
          <p style={{ fontSize: 13, color: textSecondary }}>Free trial on all plans · No credit card required</p>
        </section>

        {/* ── Plans grid ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: textSecondary }}>Loading plans…</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: textSecondary }}>No plans available right now.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(plans.length, 3)},1fr)`, gap: 20, marginBottom: 56 }}>
            {plans.map((plan, idx) => {
              const price = Number(plan.price_usd);
              const isUnlimited = plan.max_agents === -1 || plan.max_tickets_per_month === -1;
              const isPopular = idx === POPULAR_INDEX && plans.length > 1;
              const features: string[] = Array.isArray(plan.features) ? plan.features : [];

              return (
                <div key={plan.id} style={{ position: 'relative', background: isPopular ? (isDark ? 'linear-gradient(135deg,rgba(14,165,233,0.14),rgba(99,102,241,0.12))' : 'linear-gradient(135deg,rgba(219,234,254,0.95),rgba(224,231,255,0.9))') : cardBg, borderRadius: 20, border: `2px solid ${isPopular ? accentBlue : cardBorder}`, padding: '36px 26px 28px', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(12px)', boxShadow: isPopular ? `0 8px 40px rgba(14,165,233,0.25)` : isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 16px rgba(14,165,233,0.1)' }}>
                  {isPopular && (
                    <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 16px', borderRadius: 999, letterSpacing: '0.08em', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(14,165,233,0.4)' }}>
                      ✦ MOST POPULAR
                    </div>
                  )}

                  <div style={{ fontSize: 11, fontWeight: 700, color: isPopular ? accentBlue : textSecondary, letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>{plan.name}</div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 44, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', color: textPrimary }}>
                      ${isNaN(price) ? '—' : price}
                    </span>
                    <span style={{ fontSize: 13, color: textSecondary, marginBottom: 8 }}>/month</span>
                  </div>

                  <div style={{ fontSize: 12, color: textSecondary, marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${sectionBorder}` }}>
                    {isUnlimited ? 'Unlimited agents & tickets' : `${plan.max_agents} agents · ${plan.max_tickets_per_month.toLocaleString()} tickets/mo`}
                  </div>

                  <ul style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    {features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: textSecondary }}>
                        <span style={{ color: isPopular ? accentBlue : '#4ADE80', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={user ? '/admin/dashboard' : '/signup'}
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '13px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: isPopular ? `linear-gradient(90deg,${accentBlue},${accentIndigo})` : isDark ? 'rgba(14,165,233,0.12)' : 'rgba(219,234,254,0.9)', color: isPopular ? '#fff' : accentBlue, border: isPopular ? 'none' : `1px solid ${pillBorder}`, boxShadow: isPopular ? '0 4px 16px rgba(14,165,233,0.35)' : 'none' }}
                  >
                    {user ? 'Go to dashboard' : 'Get started free'}
                  </Link>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: `1px solid ${sectionBorder}`, padding: '24px', maxWidth: 1140, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 12, color: textSecondary }}>
        <span>© 2026 GKT AI Ticketing. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[['Home','/'],['Docs','/dev-hub'],['Login','/login'],['Sign up','/signup']].map(([l,h]) => (
            <Link key={l} href={h} style={{ color: textSecondary, textDecoration: 'none', fontWeight: 500 }}>{l}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
