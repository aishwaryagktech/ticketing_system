'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { onboardingApi } from '@/lib/api/onboarding.api';

export default function SetupBrandingPage() {
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
      await onboardingApi.setStep('notifications');
      router.push('/setup/notifications');
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
      <div style={{ marginBottom: 8, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 9</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Branding / White Label</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28 }}>
        Logo, primary color, custom domain. Configure in Admin → Branding after setup.
      </p>
      <button onClick={handleContinue} disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Continue to Notifications'}
      </button>
    </div>
  );
}
