'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { superAdminApi } from '@/lib/api/super-admin.api';

export default function FeatureFlagsPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [flags, setFlags] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    superAdminApi.getProducts()
      .then(res => {
        setProducts(res.data);
        if (res.data.length > 0) setSelectedProductId(res.data[0].id);
        setIsLoading(false);
      })
      .catch(err => { console.error(err); setIsLoading(false); });
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;
    setIsLoading(true);
    superAdminApi.getFlags(selectedProductId)
      .then(res => { setFlags(res.data); setIsLoading(false); })
      .catch(err => { console.error(err); setFlags(null); setIsLoading(false); });
  }, [selectedProductId]);

  const isDark = mounted && theme === 'dark';
  const textPrimary = isDark ? '#F8FAFC' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const surfaceBg = isDark ? '#1E293B' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';
  const accentBrand = '#FACC15';

  const flagFields = [
    { key: 'chatbot_enabled', label: 'Chatbot Widget', desc: 'Allow embedded chatbot on client websites' },
    { key: 'webform_enabled', label: 'Web Form Intake', desc: 'Enable ticket creation via web forms' },
    { key: 'email_intake_enabled', label: 'Email Intake', desc: 'Create tickets from incoming emails' },
    { key: 'rest_api_enabled', label: 'REST API', desc: 'Allow third-party integrations via API' },
    { key: 'sms_alerts_enabled', label: 'SMS Alerts', desc: 'Send SMS notifications for critical escalations' },
    { key: 'white_label_enabled', label: 'White Label', desc: 'Remove GKT branding from the product' },
    { key: 'billing_enforced', label: 'Billing Enforced', desc: 'Enforce ticket and agent limits based on plan' },
    { key: 'ai_suggestions_enabled', label: 'AI Suggestions', desc: 'Enable AI-powered reply suggestions' },
    { key: 'kb_public_enabled', label: 'Public KB', desc: 'Make knowledge base articles publicly accessible' },
  ];

  const toggleFlag = async (key: string) => {
    if (!flags) return;
    const newValue = !flags[key];
    setFlags((prev: any) => ({ ...prev, [key]: newValue }));
    setIsSaving(true);
    try {
      await superAdminApi.updateFlags(selectedProductId, { [key]: newValue });
    } catch (err) {
      console.error(err);
      setFlags((prev: any) => ({ ...prev, [key]: !newValue })); // revert
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: textPrimary, marginBottom: '4px' }}>Feature Flags</h1>
          <p style={{ fontSize: '14px', color: textSecondary }}>Toggle features per product</p>
        </div>
        <select
          value={selectedProductId}
          onChange={e => setSelectedProductId(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: '8px', border: `1px solid ${borderColor}`,
            background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', color: textPrimary,
            fontSize: '14px', cursor: 'pointer', outline: 'none',
          }}
        >
          {products.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: textSecondary }}>Loading flags...</div>
      ) : !flags ? (
        <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <p style={{ fontSize: '18px', fontWeight: 600, color: textPrimary }}>No feature flags found</p>
          <p style={{ fontSize: '14px', color: textSecondary }}>This product may not have been created with feature flags</p>
        </div>
      ) : (
        <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '12px', overflow: 'hidden' }}>
          {flagFields.map((f, i) => (
            <div key={f.key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '20px 24px', borderBottom: i < flagFields.length - 1 ? `1px solid ${borderColor}` : 'none',
            }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: textPrimary, marginBottom: '2px' }}>{f.label}</p>
                <p style={{ fontSize: '13px', color: textSecondary }}>{f.desc}</p>
              </div>
              <button
                onClick={() => toggleFlag(f.key)}
                disabled={isSaving}
                style={{
                  width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                  background: flags[f.key] ? accentBrand : (isDark ? 'rgba(255,255,255,0.1)' : '#D1D5DB'),
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: flags[f.key] ? '#000' : '#fff', position: 'absolute', top: '3px',
                  left: flags[f.key] ? '25px' : '3px', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
