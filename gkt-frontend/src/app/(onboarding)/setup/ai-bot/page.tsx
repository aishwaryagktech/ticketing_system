'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { onboardingApi } from '@/lib/api/onboarding.api';

export default function SetupAiBotPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tenantProducts, setTenantProducts] = useState<Array<{ id: string; name: string; l0_provider?: string | null; l0_model?: string | null }>>([]);
  const [tenantProductId, setTenantProductId] = useState<string>('');
  const [providers, setProviders] = useState<Array<{ provider_name: string; available_models: any; default_model?: string | null }>>([]);
  const [providerName, setProviderName] = useState<string>('');
  const [model, setModel] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setLoading(true);
    Promise.all([onboardingApi.getProducts(), onboardingApi.aiModels()])
      .then(([p, m]) => {
        const prodList = Array.isArray(p) ? p : [];
        setTenantProducts(prodList);
        const firstId = prodList[0]?.id || '';
        setTenantProductId(firstId);

        const prov = Array.isArray(m?.providers) ? m.providers : [];
        setProviders(prov);
        const firstProvider = prov[0]?.provider_name || '';
        setProviderName(firstProvider);
        const firstModel = Array.isArray(prov[0]?.available_models) ? String(prov[0].available_models[0] ?? '') : '';
        setModel(firstModel);
      })
      .catch(() => setError('Failed to load AI models'))
      .finally(() => setLoading(false));
  }, [mounted]);

  useEffect(() => {
    if (!tenantProductId) return;
    const tp = tenantProducts.find((x) => x.id === tenantProductId);
    if (tp?.l0_provider) setProviderName(tp.l0_provider);
    if (tp?.l0_model) setModel(tp.l0_model);
  }, [tenantProductId, tenantProducts]);

  const handleContinue = async () => {
    setSaving(true);
    setError('');
    try {
      if (tenantProductId && providerName && model) {
        await onboardingApi.setL0Model(tenantProductId, providerName, model);
      }
      await onboardingApi.setStep('channels');
      router.push('/setup/channels');
    } catch (e: any) {
      setError(e?.message || 'Failed to save AI bot settings');
    } finally {
      setSaving(false);
    }
  };

  const isDark = mounted && theme === 'dark';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentBrand = '#FACC15';
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : '#E2E8F0';
  const inputBg = isDark ? '#1E293B' : '#FFFFFF';

  if (!mounted) return null;

  const currentProvider = providers.find((p) => p.provider_name === providerName) || providers[0];
  const models = currentProvider && Array.isArray(currentProvider.available_models) ? currentProvider.available_models.map(String) : [];

  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 7</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>AI Bot (L0)</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28 }}>
        Choose which AI model powers your L0 bot for this product. Models are configured by Super Admin.
      </p>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#ef4444', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: textSecondary }}>Loading models…</div>
      ) : (
        <div style={{ padding: 18, border: `1px solid ${borderColor}`, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', marginBottom: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: textSecondary, marginBottom: 6 }}>Product</label>
              <select
                value={tenantProductId}
                onChange={(e) => setTenantProductId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontWeight: 700 }}
              >
                {tenantProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: textSecondary, marginBottom: 6 }}>Provider</label>
              <select
                value={providerName}
                onChange={(e) => {
                  const next = e.target.value;
                  setProviderName(next);
                  const p = providers.find((x) => x.provider_name === next);
                  const first = p && Array.isArray(p.available_models) ? String(p.available_models[0] ?? '') : '';
                  setModel(first);
                }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontWeight: 700 }}
              >
                {providers.map((p) => (
                  <option key={p.provider_name} value={p.provider_name}>{p.provider_name}</option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: textSecondary, marginBottom: 6 }}>Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontWeight: 700 }}
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div style={{ marginTop: 8, fontSize: 12, color: textSecondary }}>
                Saved per product. L0 bot will use this model for answers, summaries, and deflection.
              </div>
            </div>
          </div>
        </div>
      )}

      <button onClick={handleContinue} disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Continue to Channels'}
      </button>
    </div>
  );
}
