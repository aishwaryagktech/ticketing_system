'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { onboardingApi } from '@/lib/api/onboarding.api';

export default function SetupAgentsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [agents, setAgents] = useState<unknown[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('l1_agent');
  const [supportLevel, setSupportLevel] = useState('L1');
  const [assignedProducts, setAssignedProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    Promise.all([onboardingApi.getProducts(), onboardingApi.getAgents()])
      .then(([p, a]) => {
        setProducts(p);
        setAgents(Array.isArray(a) ? a : []);
      })
      .catch(() => { setProducts([]); setAgents([]); })
      .finally(() => setLoading(false));
  }, [mounted]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setError('');
    setSaving(true);
    try {
      await onboardingApi.inviteAgent({
        name: name.trim(),
        email: email.trim(),
        role: role === 'tenant_admin' ? 'tenant_admin' : role === 'l2_agent' ? 'l2_agent' : role === 'l3_agent' ? 'l3_agent' : 'l1_agent',
        assigned_products: assignedProducts,
        support_level: supportLevel,
      });
      const list = await onboardingApi.getAgents();
      setAgents(Array.isArray(list) ? list : []);
      setName('');
      setEmail('');
      setAssignedProducts([]);
    } catch {
      setError('Failed to invite agent');
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (id: string) => {
    setAssignedProducts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      await onboardingApi.setStep('ticket_settings');
      router.push('/setup/ticket-settings');
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
      <div style={{ marginBottom: 8, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 2</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Invite Support Agents</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28 }}>
        Add team members who will handle tickets. Assign them to products and support levels (L1 / L2 / L3).
      </p>

      {error && <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#ef4444', marginBottom: 20 }}>{error}</div>}

      <form onSubmit={handleInvite} style={{ marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Rahul" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="rahul@company.com" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }}>
              <option value="l1_agent">Agent</option>
              <option value="tenant_admin">Admin</option>
              <option value="l2_agent">L2 Agent</option>
              <option value="l3_agent">L3 Agent</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Support Level</label>
            <select value={supportLevel} onChange={(e) => setSupportLevel(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }}>
              <option value="L1">L1</option>
              <option value="L2">L2</option>
              <option value="L3">L3</option>
            </select>
          </div>
        </div>
        {products.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Assigned Products</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {products.map((p) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={assignedProducts.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <button type="submit" disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, background: accentBrand, color: '#000', border: 'none', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          Invite Agent
        </button>
      </form>

      {loading ? <p style={{ color: textSecondary }}>Loading...</p> : agents.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 10 }}>Invited agents ({agents.length})</div>
        </div>
      ) : null}

      <button onClick={handleContinue} disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Continue to Ticket Settings'}
      </button>
    </div>
  );
}
