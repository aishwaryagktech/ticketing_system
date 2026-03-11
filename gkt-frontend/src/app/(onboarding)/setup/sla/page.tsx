'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { onboardingApi } from '@/lib/api/onboarding.api';

export default function SetupSlaPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Array<{ priority: 'p1' | 'p2' | 'p3' | 'p4'; response: number; resolution: number }>>([
    { priority: 'p1', response: 15, resolution: 120 },
    { priority: 'p2', response: 60, resolution: 480 },
    { priority: 'p3', response: 240, resolution: 1440 },
    { priority: 'p4', response: 1440, resolution: 4320 },
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    onboardingApi.getSla()
      .then((data: any[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const map = new Map<string, { response: number; resolution: number }>();
        for (const row of data) {
          if (!row?.priority) continue;
          map.set(String(row.priority).toLowerCase(), {
            response: Number(row.response_time_mins),
            resolution: Number(row.resolution_time_mins),
          });
        }
        setRows((prev) =>
          prev.map((r) => {
            const v = map.get(r.priority);
            return v && Number.isFinite(v.response) && Number.isFinite(v.resolution)
              ? { ...r, response: v.response, resolution: v.resolution }
              : r;
          })
        );
      })
      .catch(() => {
        // ignore load errors; defaults remain
      });
  }, [mounted]);

  const handleContinue = async () => {
    setSaving(true);
    setError('');
    try {
      // Product-scoped SLA: choose first product if available (or require selection in a follow-up iteration)
      const products = await onboardingApi.getProducts().catch(() => []);
      const tenantProductId = Array.isArray(products) && products[0]?.id ? String(products[0].id) : '';
      if (!tenantProductId) throw new Error('No product found. Create a product first.');

      await onboardingApi.putSla(
        tenantProductId,
        rows.map((r) => ({
          priority: r.priority,
          response_time_mins: Number(r.response),
          resolution_time_mins: Number(r.resolution),
        }))
      );
      await onboardingApi.setStep('escalation');
      router.push('/setup/escalation');
    } catch (e: any) {
      setError(e?.message || 'Failed to save SLA. Please check values and try again.');
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
      <div style={{ marginBottom: 8, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 4</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>SLA Configuration</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28 }}>
        Define response and resolution times by priority.
      </p>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#ef4444', marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{ padding: 24, border: `1px solid ${borderColor}`, borderRadius: 12, marginBottom: 28, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
              <th style={{ textAlign: 'left', padding: '12px 8px', color: textSecondary }}>Priority</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', color: textSecondary }}>First Response (mins)</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', color: textSecondary }}>Resolution (mins)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.priority} style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td style={{ padding: '12px 8px', fontWeight: 700, textTransform: 'uppercase' }}>{r.priority}</td>
                <td style={{ padding: '12px 8px' }}>
                  <input
                    type="number"
                    min={1}
                    value={r.response}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRows((prev) => prev.map((x) => (x.priority === r.priority ? { ...x, response: val } : x)));
                    }}
                    style={{ width: '140px', padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary }}
                  />
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <input
                    type="number"
                    min={1}
                    value={r.resolution}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRows((prev) => prev.map((x) => (x.priority === r.priority ? { ...x, resolution: val } : x)));
                    }}
                    style={{ width: '140px', padding: '10px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: textSecondary, marginTop: 12 }}>
          Tip: enter values in minutes (e.g. 60 = 1 hour).
        </p>
      </div>
      <button onClick={handleContinue} disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Save & Continue to Escalation'}
      </button>
    </div>
  );
}
