'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';

export default function SetupCompletePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, hydrate } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  const handleGoDashboard = () => {
    if (user?.role === 'tenant_admin') router.push('/admin/dashboard');
    else if (user?.role === 'l1_agent' || user?.role === 'l2_agent') router.push('/agent/queue');
    else router.push('/portal/dashboard');
  };

  const isDark = mounted && theme === 'dark';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentBrand = '#FACC15';
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : '#E2E8F0';

  if (!mounted) return null;

  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Your support system is ready</h1>
      <p style={{ fontSize: 16, color: textSecondary, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
        Products, agents, ticket settings, SLA, and channels are configured. You can refine everything from the Admin dashboard.
      </p>
      <div style={{ display: 'inline-flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32, padding: 20, border: `1px solid ${borderColor}`, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
        <span style={{ fontSize: 14, color: textSecondary }}>✓ Products</span>
        <span style={{ fontSize: 14, color: textSecondary }}>✓ Agents</span>
        <span style={{ fontSize: 14, color: textSecondary }}>✓ Ticket settings</span>
        <span style={{ fontSize: 14, color: textSecondary }}>✓ SLA & Escalation</span>
        <span style={{ fontSize: 14, color: textSecondary }}>✓ Channels</span>
      </div>
      <button
        onClick={handleGoDashboard}
        style={{
          padding: '14px 32px',
          borderRadius: 12,
          background: accentBrand,
          color: '#000',
          border: 'none',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(250,204,21,0.35)',
        }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
