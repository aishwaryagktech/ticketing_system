'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { onboardingApi } from '@/lib/api/onboarding.api';

export default function SetupTicketSettingsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [prefix, setPrefix] = useState('TKT');
  const [defaultPriority, setDefaultPriority] = useState('p2');
  const [categories, setCategories] = useState('Billing, Technical, Account, Bug');
  const [assignmentRule, setAssignmentRule] = useState('round_robin');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const list = categories.split(',').map((s) => s.trim()).filter(Boolean);
      await onboardingApi.putTicketSettings({
        ticket_prefix: prefix.slice(0, 20),
        default_priority: defaultPriority,
        categories: list.length ? list : ['Billing', 'Technical', 'Account'],
        assignment_rule: assignmentRule,
      });
      await onboardingApi.setStep('sla');
      router.push('/setup/sla');
    } catch {
      setError('Failed to save');
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

  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 3</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Ticket Settings</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28 }}>
        Configure how tickets are created and assigned.
      </p>

      {error && <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#ef4444', marginBottom: 20 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Ticket ID Prefix</label>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="TKT" style={{ width: '100%', maxWidth: 120, padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Default Priority</label>
          <select value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value)} style={{ width: '100%', maxWidth: 200, padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }}>
            <option value="p1">P1 - Critical</option>
            <option value="p2">P2 - High</option>
            <option value="p3">P3 - Medium</option>
            <option value="p4">P4 - Low</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Categories (comma-separated)</label>
          <input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Billing, Technical, Account, Bug" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Assignment Rule</label>
          <select value={assignmentRule} onChange={(e) => setAssignmentRule(e.target.value)} style={{ width: '100%', maxWidth: 260, padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 14 }}>
            <option value="round_robin">Round Robin</option>
            <option value="manual">Manual Assignment</option>
            <option value="skill_based">Skill Based</option>
          </select>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Save & Continue to SLA'}
      </button>
    </div>
  );
}
