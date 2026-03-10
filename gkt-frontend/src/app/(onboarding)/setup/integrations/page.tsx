'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { onboardingApi } from '@/lib/api/onboarding.api';

export default function SetupIntegrationsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleContinue = async () => {
    setSaving(true);
    try {
      await onboardingApi.setStep('complete');
      router.push('/setup/complete');
    } finally {
      setSaving(false);
    }
  };

  const isDark = mounted && theme === 'dark';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentBrand = '#FACC15';

  if (!mounted) return null;

  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 11</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>API & Integrations</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28 }}>
        API keys and webhooks. Generate and configure in Admin after setup.
      </p>
      <button onClick={handleContinue} disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Continue to Complete'}
      </button>
    </div>
  );
}
