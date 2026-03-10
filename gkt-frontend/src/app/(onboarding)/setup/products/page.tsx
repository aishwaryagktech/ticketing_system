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
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
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
    setAdding(true);
    try {
      await onboardingApi.createProduct({
        name: name.trim(),
        description: description.trim() || undefined,
        website: website.trim() || undefined,
      });
      const refreshed = await onboardingApi.getProducts();
      setProducts(refreshed);
      setName('');
      setDescription('');
      setWebsite('');
      setShowAddModal(false);
    } catch {
      setError('Failed to add product');
    } finally {
      setAdding(false);
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
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Products</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 20 }}>
        List of products and services you provide support for. Agents will be assigned to these later.
      </p>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#ef4444', marginBottom: 20 }}>{error}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: textSecondary }}>
          {products.length > 0 ? `${products.length} product${products.length > 1 ? 's' : ''}` : 'No products yet'}
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setShowAddModal(true);
          }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: accentBrand,
            color: '#000',
            border: 'none',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Add Product
        </button>
      </div>

      {loading ? (
        <p style={{ color: textSecondary }}>Loading...</p>
      ) : products.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 10 }}>Your products</div>
          <div
            style={{
              borderRadius: 10,
              border: `1px solid ${borderColor}`,
              overflow: 'hidden',
              fontSize: 13,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2.2fr 2fr 2.6fr 1.2fr',
                padding: '8px 12px',
                background: isDark ? '#020617' : '#F3F4F6',
                fontWeight: 600,
                color: textSecondary,
              }}
            >
              <span>Product</span>
              <span>Website</span>
              <span>Description</span>
              <span style={{ textAlign: 'right' }}>Status</span>
            </div>
            {products.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.2fr 2fr 2.6fr 1.2fr',
                  padding: '10px 12px',
                  borderTop: `1px solid ${borderColor}`,
                  alignItems: 'center',
                  background: isDark ? '#020617' : '#FFFFFF',
                }}
              >
                <div style={{ fontWeight: 600, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>
                <div style={{ color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(p as any).website || '—'}
                </div>
                <div style={{ color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.description || '—'}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: 12,
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: p.status === 'inactive'
                        ? isDark ? 'rgba(148,163,184,0.2)' : '#E5E7EB'
                        : isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7',
                      color: p.status === 'inactive' ? textSecondary : '#16a34a',
                    }}
                  >
                    {p.status === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: 24, border: `1px dashed ${borderColor}`, borderRadius: 12, marginBottom: 28, textAlign: 'center', color: textSecondary }}>
          No products yet. Add at least one to continue.
        </div>
      )}

      <button onClick={handleContinue} disabled={saving || products.length === 0} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: products.length === 0 ? 'not-allowed' : 'pointer', opacity: products.length === 0 ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Continue to Invite Agents'}
      </button>

      {showAddModal && (
        <div
          onClick={() => {
            if (!adding) setShowAddModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(480px, 96vw)',
              background: inputBg,
              borderRadius: 16,
              border: `1px solid ${borderColor}`,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>Add product</div>
                <div style={{ fontSize: 13, color: textSecondary }}>Create a product or service for this tenant.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!adding) setShowAddModal(false);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: textSecondary,
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAdd}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>
                    Product Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rewire AI"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${borderColor}`,
                      background: '#020617',
                      color: textPrimary,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>
                    Description (optional)
                  </label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${borderColor}`,
                      background: '#020617',
                      color: textPrimary,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>
                    Website (optional)
                  </label>
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.edu/product"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${borderColor}`,
                      background: '#020617',
                      color: textPrimary,
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!adding) setShowAddModal(false);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid ${borderColor}`,
                    background: 'transparent',
                    color: textSecondary,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !name.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: accentBrand,
                    color: '#000',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: adding || !name.trim() ? 'not-allowed' : 'pointer',
                    opacity: adding || !name.trim() ? 0.7 : 1,
                  }}
                >
                  {adding ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
