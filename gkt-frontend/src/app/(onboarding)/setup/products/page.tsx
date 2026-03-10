'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { onboardingApi } from '@/lib/api/onboarding.api';

export default function SetupProductsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string; description?: string | null; status: string }>>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    onboardingApi.getProducts().then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  }, [mounted]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setSaving(true);
    try {
      const created = await onboardingApi.createProduct({ name: name.trim(), description: description.trim() || undefined });
      setProducts((prev) => [...prev, created]);
      setName('');
      setDescription('');
    } catch {
      setError('Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      await onboardingApi.setStep('agents');
      router.push('/setup/agents');
    } catch {
      setError('Failed to update step');
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

  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: 13, color: '#FACC15', fontWeight: 600 }}>Step 1</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Add Products</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28 }}>
        Add the products or services you want to provide support for. Agents will be assigned to these later.
      </p>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#ef4444', marginBottom: 20 }}>{error}</div>
      )}

      <form onSubmit={handleAdd} style={{ marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Product Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rewire AI"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }}
            />
          </div>
        </div>
        <button type="submit" disabled={saving || !name.trim()} style={{ padding: '10px 20px', borderRadius: 8, background: accentBrand, color: '#000', border: 'none', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          Add Product
        </button>
      </form>

      {loading ? (
        <p style={{ color: textSecondary }}>Loading...</p>
      ) : products.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 10 }}>Your products</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {products.map((p) => (
              <li key={p.id} style={{ padding: '12px 14px', border: `1px solid ${borderColor}`, borderRadius: 10, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  {p.description && <span style={{ color: textSecondary, fontSize: 13, marginLeft: 8 }}>{p.description}</span>}
                </div>
                <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7', color: '#16a34a' }}>{p.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div style={{ padding: 24, border: `1px dashed ${borderColor}`, borderRadius: 12, marginBottom: 28, textAlign: 'center', color: textSecondary }}>
          No products yet. Add at least one to continue.
        </div>
      )}

      <button onClick={handleContinue} disabled={saving || products.length === 0} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: products.length === 0 ? 'not-allowed' : 'pointer', opacity: products.length === 0 ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Continue to Invite Agents'}
      </button>
    </div>
  );
}
