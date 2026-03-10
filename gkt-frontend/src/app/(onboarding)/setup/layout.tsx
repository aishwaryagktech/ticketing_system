'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { onboardingApi } from '@/lib/api/onboarding.api';

const SETUP_STEPS: { path: string; label: string; short: string }[] = [
  { path: '/setup/products', label: 'Add Products', short: 'Products' },
  { path: '/setup/agents', label: 'Invite Agents', short: 'Agents' },
  { path: '/setup/ticket-settings', label: 'Ticket Settings', short: 'Tickets' },
  { path: '/setup/sla', label: 'SLA Configuration', short: 'SLA' },
  { path: '/setup/escalation', label: 'Escalation Rules', short: 'Escalation' },
  { path: '/setup/knowledge-base', label: 'Knowledge Base', short: 'KB' },
  { path: '/setup/ai-bot', label: 'AI Bot', short: 'AI Bot' },
  { path: '/setup/channels', label: 'Support Channels', short: 'Channels' },
  { path: '/setup/branding', label: 'Branding', short: 'Branding' },
  { path: '/setup/notifications', label: 'Notifications', short: 'Notifications' },
  { path: '/setup/integrations', label: 'API & Integrations', short: 'Integrations' },
  { path: '/setup/complete', label: 'Complete', short: 'Complete' },
];

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { user, hydrate, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(true);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!mounted || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await onboardingApi.getState().catch(() => null);
        const hasPlan = !!(state && state.tenant && state.tenant.plan_id);
        if (!hasPlan && !cancelled) {
          router.push('/pricing');
        } else if (!cancelled) {
          setCheckingPlan(false);
        }
      } catch {
        if (!cancelled) setCheckingPlan(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, user, router]);

  useEffect(() => {
    if (mounted && !user) router.push('/login?next=' + encodeURIComponent(pathname || '/setup/products'));
  }, [mounted, user, router, pathname]);

  const isDark = mounted && theme === 'dark';
  const bgPrimary = isDark ? '#0F172A' : '#F8FAFC';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentBrand = '#FACC15';
  const sidebarBg = isDark ? '#0F172A' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(148,163,184,0.15)' : '#E2E8F0';

  if (!mounted || !user || checkingPlan) return null;

  const currentIndex = SETUP_STEPS.findIndex((s) => pathname === s.path || pathname?.startsWith(s.path + '/'));

  return (
    <div style={{ minHeight: '100vh', background: bgPrimary, color: textPrimary, fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <header style={{ height: 64, borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', padding: '0 24px', background: sidebarBg }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: textPrimary }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: accentBrand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#000' }}>G</div>
          <span style={{ fontSize: 15, fontWeight: 700 }}>GKT Ticketing</span>
        </Link>
        <div style={{ marginLeft: 24, fontSize: 13, color: textSecondary }}>Configuration</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              clearAuth();
              localStorage.removeItem('gkt_refresh_token');
              router.push('/login');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${borderColor}`,
              background: 'transparent',
              color: textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 260, borderRight: `1px solid ${borderColor}`, background: sidebarBg, padding: '20px 0', overflowY: 'auto' }}>
          <nav style={{ padding: '0 12px' }}>
            {SETUP_STEPS.map((step, i) => {
              const isActive = currentIndex === i;
              const isPast = currentIndex > i;
              return (
                <Link
                  key={step.path}
                  href={step.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    marginBottom: 2,
                    borderRadius: 10,
                    textDecoration: 'none',
                    color: isActive ? '#000' : textSecondary,
                    background: isActive ? accentBrand : isPast ? (isDark ? 'rgba(250,204,21,0.08)' : 'rgba(250,204,21,0.12)') : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: 14,
                  }}
                >
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: isActive ? 'rgba(0,0,0,0.1)' : (isPast ? accentBrand : 'transparent'), border: isPast && !isActive ? `2px solid ${accentBrand}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                    {isPast && !isActive ? '✓' : i + 1}
                  </span>
                  {step.short}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
