'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';

const STEPS = [
  'Choose Plan',
  'Add Products',
  'Invite Support Agents',
  'Configure Support Channels',
  'Configure AI Bot',
  'Configure SLA & Escalation',
];

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, hydrate } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (mounted && !user) {
      router.push('/login?next=/onboarding');
    }
  }, [mounted, user, router]);

  const isDark = mounted && theme === 'dark';
  const bgPrimary = isDark ? '#0F172A' : '#F8FAFC';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentBrand = '#FACC15';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : '#E2E8F0';

  if (!mounted || !user) return null;

  const displayName = user.name?.split(' ')[0] || 'there';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: bgPrimary,
        color: textPrimary,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Ambient gradient */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '900px',
          height: '500px',
          background: `radial-gradient(ellipse at top, ${isDark ? 'rgba(250,204,21,0.08)' : 'rgba(250,204,21,0.12)'} 0%, transparent 65%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        {/* Welcome card */}
        <div
          style={{
            background: cardBg,
            borderRadius: 20,
            border: `1px solid ${borderColor}`,
            padding: '40px 36px',
            marginBottom: 32,
            boxShadow: isDark ? '0 25px 50px -12px rgba(0,0,0,0.4)' : '0 25px 50px -12px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
            Welcome, {displayName}
          </h1>
          <p style={{ fontSize: 16, color: textSecondary, lineHeight: 1.6, marginBottom: 28 }}>
            Your support workspace is ready. Complete these steps to activate your support system.
          </p>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Checklist
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {STEPS.map((label, i) => (
                <li
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: i < STEPS.length - 1 ? `1px solid ${borderColor}` : 'none',
                    fontSize: 15,
                    color: textPrimary,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: isDark ? 'rgba(250,204,21,0.15)' : 'rgba(250,204,21,0.2)',
                      color: accentBrand,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/pricing"
            style={{
              display: 'inline-block',
              padding: '14px 28px',
              borderRadius: 12,
              background: accentBrand,
              color: '#000',
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(250,204,21,0.35)',
            }}
          >
            Start Setup
          </Link>
        </div>

        <p style={{ fontSize: 13, color: textSecondary, textAlign: 'center' }}>
          You can complete setup in one go or come back later from your dashboard.
        </p>
      </div>
    </div>
  );
}
