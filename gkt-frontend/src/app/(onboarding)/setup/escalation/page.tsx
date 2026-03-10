'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { onboardingApi } from '@/lib/api/onboarding.api';

type TriggerType = 'sla_breach' | 'sentiment' | 'complexity' | 'vip' | 'bot_handoff' | 'user_unsatisfied';

export default function SetupEscalationPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rules, setRules] = useState<Array<{
    id?: string;
    level: number;
    trigger_type: TriggerType;
    trigger_threshold_mins?: number | null;
    action_assign_role: string;
    is_active: boolean;
  }>>([
    { level: 1, trigger_type: 'sla_breach', trigger_threshold_mins: 30, action_assign_role: 'l2_agent', is_active: true },
    { level: 2, trigger_type: 'sla_breach', trigger_threshold_mins: 120, action_assign_role: 'l3_agent', is_active: true },
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    onboardingApi.getEscalation()
      .then((data: any[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        setRules(
          data.map((r) => ({
            id: r.id,
            level: Number(r.level) || 1,
            trigger_type: r.trigger_type as TriggerType,
            trigger_threshold_mins: r.trigger_threshold_mins ?? null,
            action_assign_role: String(r.action_assign_role || 'l2_agent'),
            is_active: r.is_active !== false,
          }))
        );
      })
      .catch(() => { /* ignore */ });
  }, [mounted]);

  const handleContinue = async () => {
    setSaving(true);
    setError('');
    try {
      await onboardingApi.putEscalation(rules);
      await onboardingApi.setStep('kb');
      router.push('/setup/knowledge-base');
    } catch (e: any) {
      setError(e?.message || 'Failed to save escalation rules');
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
      <div style={{ marginBottom: 8, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 5</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Escalation Rules</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28 }}>
        Configure when tickets automatically escalate to higher support levels (L1 → L2 → L3).
      </p>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#ef4444', marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{ padding: 24, border: `1px solid ${borderColor}`, borderRadius: 12, marginBottom: 18, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
              <th style={{ textAlign: 'left', padding: '12px 8px', color: textSecondary }}>Level</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', color: textSecondary }}>Trigger</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', color: textSecondary }}>Threshold (mins)</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', color: textSecondary }}>Escalate to</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', color: textSecondary }}>Active</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rules.map((r, idx) => (
              <tr key={r.id || idx} style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td style={{ padding: '10px 8px', fontWeight: 700 }}>{r.level}</td>
                <td style={{ padding: '10px 8px' }}>
                  <select
                    value={r.trigger_type}
                    onChange={(e) => {
                      const v = e.target.value as TriggerType;
                      setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, trigger_type: v } : x)));
                    }}
                    style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary }}
                  >
                    <option value="sla_breach">SLA breach</option>
                    <option value="bot_handoff">Bot handoff</option>
                    <option value="sentiment">Sentiment</option>
                    <option value="complexity">Complexity</option>
                    <option value="vip">VIP</option>
                    <option value="user_unsatisfied">User unsatisfied</option>
                  </select>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <input
                    type="number"
                    min={1}
                    value={r.trigger_threshold_mins ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, trigger_threshold_mins: v } : x)));
                    }}
                    style={{ width: 150, padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary }}
                  />
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <select
                    value={r.action_assign_role}
                    onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, action_assign_role: e.target.value } : x)))}
                    style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary }}
                  >
                    <option value="l2_agent">L2 Agent</option>
                    <option value="l3_agent">L3 Agent</option>
                    <option value="tenant_admin">Admin</option>
                  </select>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <input
                    type="checkbox"
                    checked={r.is_active}
                    onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, is_active: e.target.checked } : x)))}
                  />
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <button
                    type="button"
                    onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                    style={{ border: 'none', background: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: 16 }}
                    aria-label="Delete rule"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => setRules((prev) => [...prev, { level: prev.length + 1, trigger_type: 'sla_breach', trigger_threshold_mins: 60, action_assign_role: 'l2_agent', is_active: true }])}
        style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${borderColor}`, background: 'transparent', color: textSecondary, fontWeight: 700, cursor: 'pointer', marginBottom: 22 }}
      >
        + Add rule
      </button>

      <button onClick={handleContinue} disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Save & Continue to Knowledge Base'}
      </button>
    </div>
  );
}
