'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { onboardingApi, type ConfigurationStatus } from '@/lib/api/onboarding.api';
import { billingApi } from '@/lib/api/billing.api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type ConfigSection =
  | 'overview'
  | 'products'
  | 'people'
  | 'configuration-hub'
  | 'agents'
  | 'ticket-settings'
  | 'sla'
  | 'escalation'
  | 'kb'
  | 'ai-bot'
  | 'channels'
  | 'branding';

type TenantProduct = {
  id: string;
  tenant_id?: string;
  name: string;
  description?: string | null;
  status: string;
  website?: string | null;
  created_by?: string | null;
  created_by_email?: string | null;
};

type Agent = any;

interface TicketSettingsInlineProps {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  inputBg: string;
  accentBrand: string;
  onNext: () => void;
}

function TicketSettingsInline(props: TicketSettingsInlineProps) {
  const { isDark, textPrimary, textSecondary, borderSubtle, inputBg, accentBrand, onNext } = props;
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

  useEffect(() => {
    if (!mounted) return;
    onboardingApi
      .getTicketSettings()
      .then((data: any) => {
        if (!data) return;
        if (typeof data.ticket_prefix === 'string') setPrefix(data.ticket_prefix);
        if (typeof data.default_priority === 'string') setDefaultPriority(data.default_priority);
        if (Array.isArray(data.categories)) setCategories(data.categories.join(', '));
        else if (typeof data.categories === 'string') setCategories(data.categories);
        if (typeof data.assignment_rule === 'string') setAssignmentRule(data.assignment_rule);
      })
      .catch(() => { /* keep defaults */ });
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      {error && (
        <div
          style={{
            padding: 10,
            background: 'rgba(239,68,68,0.08)',
            borderRadius: 10,
            color: '#ef4444',
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: textSecondary,
              marginBottom: 4,
            }}
          >
            Ticket ID Prefix
          </label>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="TKT"
            style={{
              width: '100%',
              maxWidth: 120,
              padding: '9px 10px',
              borderRadius: 8,
              border: `1px solid ${borderSubtle}`,
              background: inputBg,
              color: textPrimary,
              fontSize: 13,
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: textSecondary,
              marginBottom: 4,
            }}
          >
            Default Priority
          </label>
          <select
            value={defaultPriority}
            onChange={(e) => setDefaultPriority(e.target.value)}
            style={{
              width: '100%',
              maxWidth: 220,
              padding: '9px 10px',
              borderRadius: 8,
              border: `1px solid ${borderSubtle}`,
              background: inputBg,
              color: textPrimary,
              fontSize: 13,
            }}
          >
            <option value="p1">P1 - Critical</option>
            <option value="p2">P2 - High</option>
            <option value="p3">P3 - Medium</option>
            <option value="p4">P4 - Low</option>
          </select>
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: textSecondary,
              marginBottom: 4,
            }}
          >
            Categories (comma-separated)
          </label>
          <input
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="Billing, Technical, Account, Bug"
            style={{
              width: '100%',
              padding: '9px 10px',
              borderRadius: 8,
              border: `1px solid ${borderSubtle}`,
              background: inputBg,
              color: textPrimary,
              fontSize: 13,
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: textSecondary,
              marginBottom: 4,
            }}
          >
            Assignment Rule
          </label>
          <select
            value={assignmentRule}
            onChange={(e) => setAssignmentRule(e.target.value)}
            style={{
              width: '100%',
              maxWidth: 260,
              padding: '9px 10px',
              borderRadius: 8,
              border: `1px solid ${borderSubtle}`,
              background: inputBg,
              color: textPrimary,
              fontSize: 13,
            }}
          >
            <option value="round_robin">Round Robin</option>
            <option value="manual">Manual Assignment</option>
            <option value="skill_based">Skill Based</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setError('');
          setSaving(true);
          try {
            const list = categories
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            await onboardingApi.putTicketSettings({
              ticket_prefix: prefix.slice(0, 20),
              default_priority: defaultPriority,
              categories: list.length ? list : ['Billing', 'Technical', 'Account'],
              assignment_rule: assignmentRule,
            });
            await onboardingApi.setStep('sla');
            onNext();
          } catch (e: any) {
            setError(e?.message || 'Failed to save ticket settings');
          } finally {
            setSaving(false);
          }
        }}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          background: accentBrand,
          color: '#000',
          border: 'none',
          fontWeight: 700,
          fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Saving...' : 'Save & Continue to SLA'}
      </button>
    </>
  );
}

interface SlaInlineProps {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  inputBg: string;
  accentBrand: string;
  onNext: () => void;
  products: Array<{ id: string; name: string }>;
  initialTenantProductId?: string;
}

function SlaInline(props: SlaInlineProps) {
  const { isDark, textPrimary, textSecondary, borderSubtle, inputBg, accentBrand, onNext, products, initialTenantProductId } = props;
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tenantProductId, setTenantProductId] = useState<string>(initialTenantProductId || '');
  const [rows, setRows] = useState<
    Array<{ priority: 'p1' | 'p2' | 'p3' | 'p4'; response: number; resolution: number }>
  >([
    { priority: 'p1', response: 15, resolution: 120 },
    { priority: 'p2', response: 60, resolution: 480 },
    { priority: 'p3', response: 240, resolution: 1440 },
    { priority: 'p4', response: 1440, resolution: 4320 },
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialTenantProductId && products.some((p) => p.id === initialTenantProductId)) {
      setTenantProductId(initialTenantProductId);
    } else if (!tenantProductId && products[0]?.id) {
      setTenantProductId(products[0].id);
    }
  }, [initialTenantProductId, products]);

  useEffect(() => {
    if (!mounted || !tenantProductId) return;
    onboardingApi
      .getSla(tenantProductId)
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
        // keep defaults
      });
  }, [mounted, tenantProductId]);

  if (!mounted) return null;

  const safeProducts = products || [];

  return (
    <>
      {error && (
        <div
          style={{
            padding: 10,
            background: 'rgba(239,68,68,0.08)',
            borderRadius: 10,
            color: '#ef4444',
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {safeProducts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Product</label>
          <select
            value={tenantProductId}
            onChange={(e) => setTenantProductId(e.target.value)}
            style={{
              minWidth: 220,
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${borderSubtle}`,
              background: inputBg,
              color: textPrimary,
              fontSize: 13,
            }}
          >
            {safeProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      <div
        style={{
          padding: 18,
          border: `1px solid ${borderSubtle}`,
          borderRadius: 14,
          marginBottom: 18,
          background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${borderSubtle}` }}>
              <th style={{ textAlign: 'left', padding: '10px 6px', color: textSecondary }}>Priority</th>
              <th style={{ textAlign: 'left', padding: '10px 6px', color: textSecondary }}>
                First Response (mins)
              </th>
              <th style={{ textAlign: 'left', padding: '10px 6px', color: textSecondary }}>
                Resolution (mins)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.priority} style={{ borderBottom: `1px solid ${borderSubtle}` }}>
                <td style={{ padding: '10px 6px', fontWeight: 700, textTransform: 'uppercase', color: textPrimary }}>
                  {r.priority}
                </td>
                <td style={{ padding: '10px 6px' }}>
                  <input
                    type="number"
                    min={1}
                    value={r.response}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRows((prev) =>
                        prev.map((x) => (x.priority === r.priority ? { ...x, response: val } : x))
                      );
                    }}
                    style={{
                      width: 130,
                      padding: '9px 10px',
                      borderRadius: 8,
                      border: `1px solid ${borderSubtle}`,
                      background: inputBg,
                      color: textPrimary,
                      fontSize: 13,
                    }}
                  />
                </td>
                <td style={{ padding: '10px 6px' }}>
                  <input
                    type="number"
                    min={1}
                    value={r.resolution}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRows((prev) =>
                        prev.map((x) => (x.priority === r.priority ? { ...x, resolution: val } : x))
                      );
                    }}
                    style={{
                      width: 130,
                      padding: '9px 10px',
                      borderRadius: 8,
                      border: `1px solid ${borderSubtle}`,
                      background: inputBg,
                      color: textPrimary,
                      fontSize: 13,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: textSecondary, marginTop: 10 }}>
          Tip: enter values in minutes (e.g. 60 = 1 hour). These targets drive SLA breach alerts and escalation.
        </p>
      </div>

      <button
        type="button"
        disabled={saving || (safeProducts.length > 0 && !tenantProductId)}
        onClick={async () => {
          if (!tenantProductId && safeProducts.length > 0) {
            setError('Select a product first');
            return;
          }
          setSaving(true);
          setError('');
          try {
            await onboardingApi.putSla(
              tenantProductId,
              rows.map((r) => ({
                priority: r.priority,
                response_time_mins: Number(r.response),
                resolution_time_mins: Number(r.resolution),
              }))
            );
            await onboardingApi.setStep('escalation');
            onNext();
          } catch (e: any) {
            setError(e?.message || 'Failed to save SLA. Please check values and try again.');
          } finally {
            setSaving(false);
          }
        }}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          background: accentBrand,
          color: '#000',
          border: 'none',
          fontWeight: 700,
          fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Saving...' : 'Save & Continue to Escalation'}
      </button>
    </>
  );
}

type EscalationTriggerType =
  | 'sla_breach'
  | 'sentiment'
  | 'complexity'
  | 'vip'
  | 'bot_handoff'
  | 'user_unsatisfied';

interface EscalationInlineProps {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  inputBg: string;
  accentBrand: string;
  onNext: () => void;
  products?: Array<{ id: string; name: string }>;
  initialTenantProductId?: string;
}

function EscalationInline(props: EscalationInlineProps) {
  const { isDark, textPrimary, textSecondary, borderSubtle, inputBg, accentBrand, onNext, products = [], initialTenantProductId } = props;
  const [mounted, setMounted] = useState(false);
  const [tenantProductId, setTenantProductId] = useState<string>(initialTenantProductId || (products[0]?.id ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rules, setRules] = useState<
    Array<{
      id?: string;
      level: number;
      trigger_type: EscalationTriggerType;
      trigger_threshold_mins?: number | null;
      action_assign_role: string;
      is_active: boolean;
    }>
  >([
    { level: 1, trigger_type: 'sla_breach', trigger_threshold_mins: 30, action_assign_role: 'l2_agent', is_active: true },
    { level: 2, trigger_type: 'sla_breach', trigger_threshold_mins: 120, action_assign_role: 'l3_agent', is_active: true },
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialTenantProductId && products.some((p) => p.id === initialTenantProductId)) {
      setTenantProductId(initialTenantProductId);
    } else if (!tenantProductId && products[0]?.id) {
      setTenantProductId(products[0].id);
    }
  }, [initialTenantProductId, products]);

  useEffect(() => {
    if (!mounted || !tenantProductId) return;
    onboardingApi
      .getEscalation(tenantProductId)
      .then((data: any[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        setRules(
          data.map((r) => ({
            id: r.id,
            level: Number(r.level) || 1,
            trigger_type: r.trigger_type as EscalationTriggerType,
            trigger_threshold_mins: r.trigger_threshold_mins ?? null,
            action_assign_role: String(r.action_assign_role || 'l2_agent'),
            is_active: r.is_active !== false,
          }))
        );
      })
      .catch(() => {
        // keep defaults
      });
  }, [mounted, tenantProductId]);

  if (!mounted) return null;

  return (
    <>
      {error && (
        <div
          style={{
            padding: 10,
            background: 'rgba(239,68,68,0.08)',
            borderRadius: 10,
            color: '#ef4444',
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {products.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Product</span>
          <select
            value={tenantProductId}
            onChange={(e) => setTenantProductId(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: `1px solid ${borderSubtle}`,
              background: inputBg,
              color: textPrimary,
              fontWeight: 700,
              fontSize: 12,
              minWidth: 200,
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      <div
        style={{
          padding: 18,
          border: `1px solid ${borderSubtle}`,
          borderRadius: 14,
          marginBottom: 16,
          background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${borderSubtle}` }}>
              <th style={{ textAlign: 'left', padding: '10px 6px', color: textSecondary }}>Level</th>
              <th style={{ textAlign: 'left', padding: '10px 6px', color: textSecondary }}>Trigger</th>
              <th style={{ textAlign: 'left', padding: '10px 6px', color: textSecondary }}>Threshold (mins)</th>
              <th style={{ textAlign: 'left', padding: '10px 6px', color: textSecondary }}>Escalate to</th>
              <th style={{ textAlign: 'left', padding: '10px 6px', color: textSecondary }}>Active</th>
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {rules.map((r, idx) => (
              <tr key={r.id || idx} style={{ borderBottom: `1px solid ${borderSubtle}` }}>
                <td style={{ padding: '10px 6px', fontWeight: 700, color: textPrimary }}>{r.level}</td>
                <td style={{ padding: '10px 6px' }}>
                  <select
                    value={r.trigger_type}
                    onChange={(e) => {
                      const v = e.target.value as EscalationTriggerType;
                      setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, trigger_type: v } : x)));
                    }}
                    style={{
                      padding: '9px 10px',
                      borderRadius: 8,
                      border: `1px solid ${borderSubtle}`,
                      background: inputBg,
                      color: textPrimary,
                      fontSize: 13,
                    }}
                  >
                    <option value="sla_breach">SLA breach</option>
                    <option value="bot_handoff">Bot handoff</option>
                    <option value="sentiment">Sentiment</option>
                    <option value="complexity">Complexity</option>
                    <option value="vip">VIP</option>
                    <option value="user_unsatisfied">User unsatisfied</option>
                  </select>
                </td>
                <td style={{ padding: '10px 6px' }}>
                  <input
                    type="number"
                    min={1}
                    value={r.trigger_threshold_mins ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      setRules((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, trigger_threshold_mins: v } : x))
                      );
                    }}
                    style={{
                      width: 130,
                      padding: '9px 10px',
                      borderRadius: 8,
                      border: `1px solid ${borderSubtle}`,
                      background: inputBg,
                      color: textPrimary,
                      fontSize: 13,
                    }}
                  />
                </td>
                <td style={{ padding: '10px 6px' }}>
                  <select
                    value={r.action_assign_role}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, action_assign_role: e.target.value } : x))
                      )
                    }
                    style={{
                      padding: '9px 10px',
                      borderRadius: 8,
                      border: `1px solid ${borderSubtle}`,
                      background: inputBg,
                      color: textPrimary,
                      fontSize: 13,
                    }}
                  >
                    <option value="l2_agent">L2 Agent</option>
                    <option value="l3_agent">L3 Agent</option>
                    <option value="tenant_admin">Admin</option>
                  </select>
                </td>
                <td style={{ padding: '10px 6px' }}>
                  <input
                    type="checkbox"
                    checked={r.is_active}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, is_active: e.target.checked } : x))
                      )
                    }
                  />
                </td>
                <td style={{ padding: '10px 6px' }}>
                  <button
                    type="button"
                    onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: textSecondary,
                      cursor: 'pointer',
                      fontSize: 16,
                    }}
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
        onClick={() =>
          setRules((prev) => [
            ...prev,
            {
              level: prev.length + 1,
              trigger_type: 'sla_breach',
              trigger_threshold_mins: 60,
              action_assign_role: 'l2_agent',
              is_active: true,
            },
          ])
        }
        style={{
          padding: '9px 14px',
          borderRadius: 10,
          border: `1px solid ${borderSubtle}`,
          background: 'transparent',
          color: textSecondary,
          fontWeight: 700,
          fontSize: 12,
          cursor: 'pointer',
          marginBottom: 16,
        }}
      >
        + Add rule
      </button>

      <button
        type="button"
        disabled={saving || (products.length > 0 && !tenantProductId)}
        onClick={async () => {
          if (products.length > 0 && !tenantProductId) {
            setError('Select a product first.');
            return;
          }
          setSaving(true);
          setError('');
          try {
            await onboardingApi.putEscalation(tenantProductId || '', rules);
            await onboardingApi.setStep('kb');
            onNext();
          } catch (e: any) {
            setError(e?.message || 'Failed to save escalation rules');
          } finally {
            setSaving(false);
          }
        }}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          background: accentBrand,
          color: '#000',
          border: 'none',
          fontWeight: 700,
          fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Saving...' : 'Save & Continue to Knowledge Base'}
      </button>
    </>
  );
}

interface KbInlineProps {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  accentBrand: string;
  onNext: () => void;
  initialTenantProductId?: string;
}

function KbInline(props: KbInlineProps) {
  const { isDark, textPrimary, textSecondary, borderSubtle, accentBrand, onNext, initialTenantProductId } = props;
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [tenantProducts, setTenantProducts] = useState<any[]>([]);
  const [tenantProductId, setTenantProductId] = useState<string>(initialTenantProductId || '');
  const [uploading, setUploading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [creatingArticle, setCreatingArticle] = useState(false);

  const [crawl, setCrawl] = useState({
    url: '',
    title: '',
    category: '',
    audience: '',
    tags: '',
  });

  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [selectedCrawlId, setSelectedCrawlId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<any | null>(null);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setLoadingLists(true);
    onboardingApi
      .getProducts()
      .then((p) => {
        const list = Array.isArray(p) ? p : [];
        setTenantProducts(list);
        if (initialTenantProductId && list.some((x: any) => x.id === initialTenantProductId)) {
          setTenantProductId(initialTenantProductId);
        } else if (!tenantProductId && list[0]?.id) setTenantProductId(list[0].id);
      })
      .catch(() => setTenantProducts([]))
      .finally(() => setLoadingLists(false));
  }, [mounted, initialTenantProductId]);
  useEffect(() => {
    if (initialTenantProductId && tenantProducts.some((x: any) => x.id === initialTenantProductId)) {
      setTenantProductId(initialTenantProductId);
    }
  }, [initialTenantProductId, tenantProducts]);

  useEffect(() => {
    if (!mounted) return;
    setLoadingLists(true);
    onboardingApi
      .kbSources(tenantProductId || undefined)
      .then((s) => {
        setSources(Array.isArray(s) ? s : []);
      })
      .catch(() => setSources([]))
      .finally(() => setLoadingLists(false));
  }, [mounted, tenantProductId]);

  const cardBg = isDark ? 'rgba(15,23,42,0.95)' : '#FFFFFF';
  const pageBg = isDark ? 'rgba(2,6,23,0.6)' : 'rgba(15,23,42,0.03)';

  const fmt = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString();
  };

  const handleUpload = async (file: File) => {
    if (tenantProducts.length > 0 && !tenantProductId) {
      setError('Select a product above first.');
      return;
    }
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      await onboardingApi.kbUpload(file, tenantProductId || undefined);
      const s = await onboardingApi.kbSources(tenantProductId || undefined);
      setSources(Array.isArray(s) ? s : []);
      setSuccess('Document uploaded.');
    } catch (e: any) {
      setError(e?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  if (!mounted) return null;

  return (
    <>
      {error && (
        <div
          style={{
            padding: 10,
            background: 'rgba(239,68,68,0.08)',
            borderRadius: 10,
            color: '#ef4444',
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            padding: 10,
            background: isDark ? 'rgba(34,197,94,0.12)' : '#DCFCE7',
            borderRadius: 10,
            color: isDark ? '#4ADE80' : '#166534',
            marginBottom: 12,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {success}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Product
        </div>
        <select
          value={tenantProductId}
          onChange={(e) => setTenantProductId(e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            border: `1px solid ${borderSubtle}`,
            background: cardBg,
            color: textPrimary,
            fontWeight: 700,
            fontSize: 12,
            minWidth: 200,
          }}
        >
          {tenantProducts.length === 0 ? (
            <option value="">No products</option>
          ) : (
            tenantProducts.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          marginBottom: 16,
          alignItems: 'stretch',
        }}
      >
        {/* Upload docs */}
        <div
          style={{
            padding: 14,
            border: `1px solid ${borderSubtle}`,
            borderRadius: 14,
            background: cardBg,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>Upload docs</div>
              <div style={{ fontSize: 12, color: textSecondary }}>PDF/DOCX/TXT your team relies on.</div>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '7px 10px',
                borderRadius: 10,
                border: `1px solid ${borderSubtle}`,
                cursor: uploading || (tenantProducts.length > 0 && !tenantProductId) ? 'not-allowed' : 'pointer',
                opacity: uploading || (tenantProducts.length > 0 && !tenantProductId) ? 0.7 : 1,
                fontWeight: 700,
                fontSize: 11,
                color: textPrimary,
              }}
            >
              {uploading ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                style={{ display: 'none' }}
                disabled={uploading || (tenantProducts.length > 0 && !tenantProductId)}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          <div
            style={{
              border: `1px solid ${borderSubtle}`,
              borderRadius: 12,
              background: pageBg,
              padding: 10,
              height: 220,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              Uploaded docs
            </div>
            {loadingLists ? (
              <div style={{ color: textSecondary, fontSize: 12 }}>Loading…</div>
            ) : sources.filter(
                (s: any) => (s as any).source_type === 'upload' || String(s.url || '').startsWith('upload:')
              ).length === 0 ? (
              <div style={{ color: textSecondary, fontSize: 12 }}>
                No uploaded docs yet. Upload a PDF/DOCX/TXT to start building your library.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {sources
                  .filter(
                    (s: any) => (s as any).source_type === 'upload' || String(s.url || '').startsWith('upload:')
                  )
                  .map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={async () => {
                        setSelectedUploadId(s.id);
                        setSelectedCrawlId(null);
                        const full = await onboardingApi.kbSource(s.id).catch(() => s);
                        setSelectedSource(full);
                        setSourceModalOpen(true);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 10,
                        borderRadius: 10,
                        border: `1px solid ${borderSubtle}`,
                        background:
                          String(selectedUploadId) === String(s.id)
                            ? isDark
                              ? 'rgba(250,204,21,0.14)'
                              : 'rgba(250,204,21,0.20)'
                            : 'transparent',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: textPrimary,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title || 'Untitled'}
                      </div>
                      <div style={{ color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.url}
                      </div>
                      <div style={{ color: textSecondary, fontSize: 11, marginTop: 4 }}>
                        Updated {fmt(s.updated_at || s.created_at)}
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Crawl and preview */}
        <div
          style={{
            padding: 14,
            border: `1px solid ${borderSubtle}`,
            borderRadius: 14,
            background: cardBg,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>Allow web crawl</div>
          <div style={{ fontSize: 12, color: textSecondary }}>
            Extract text from public HTML pages and convert into KB articles.
          </div>

          {tenantProducts.length > 0 && !tenantProductId && (
            <div style={{ fontSize: 12, color: '#FACC15', marginBottom: 6 }}>Select a product above to upload or crawl.</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
            <input
              value={crawl.url}
              onChange={(e) => setCrawl((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://example.com/docs"
              style={{
                padding: '9px 10px',
                borderRadius: 10,
                border: `1px solid ${borderSubtle}`,
                background: cardBg,
                color: textPrimary,
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <button
              type="button"
              disabled={crawling || !crawl.url || (tenantProducts.length > 0 && !tenantProductId)}
              onClick={async () => {
                setError('');
                setSuccess('');
                setCrawling(true);
                try {
                  if (tenantProducts.length > 0 && !tenantProductId) {
                    setError('Select a product above first.');
                    return;
                  }
                  const src = await onboardingApi.kbCrawl(crawl.url, tenantProductId || undefined);
                  setSelectedCrawlId(src.id);
                  setSelectedUploadId(null);
                  setSelectedSource(src?.content_text != null ? src : await onboardingApi.kbSource(src.id).catch(() => src));
                  setSuccess('Page crawled. Preview below and create KB article if needed.');
                } catch (e: any) {
                  setError(e?.message || 'Failed to crawl URL');
                } finally {
                  setCrawling(false);
                }
              }}
              style={{
                padding: '9px 10px',
                borderRadius: 10,
                border: 'none',
                background: accentBrand,
                color: '#000',
                fontWeight: 800,
                fontSize: 12,
                cursor: crawling || !crawl.url || (tenantProducts.length > 0 && !tenantProductId) ? 'not-allowed' : 'pointer',
                opacity: crawling || !crawl.url || (tenantProducts.length > 0 && !tenantProductId) ? 0.7 : 1,
              }}
            >
              {crawling ? 'Crawling…' : 'Crawl'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              value={crawl.title}
              onChange={(e) => setCrawl((p) => ({ ...p, title: e.target.value }))}
              placeholder="Title"
              style={{
                padding: '9px 10px',
                borderRadius: 10,
                border: `1px solid ${borderSubtle}`,
                background: cardBg,
                color: textPrimary,
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <input
              value={crawl.category}
              onChange={(e) => setCrawl((p) => ({ ...p, category: e.target.value }))}
              placeholder="Category"
              style={{
                padding: '9px 10px',
                borderRadius: 10,
                border: `1px solid ${borderSubtle}`,
                background: cardBg,
                color: textPrimary,
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <input
              value={crawl.audience}
              onChange={(e) => setCrawl((p) => ({ ...p, audience: e.target.value }))}
              placeholder="Audience"
              style={{
                padding: '9px 10px',
                borderRadius: 10,
                border: `1px solid ${borderSubtle}`,
                background: cardBg,
                color: textPrimary,
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <input
              value={crawl.tags}
              onChange={(e) => setCrawl((p) => ({ ...p, tags: e.target.value }))}
              placeholder="Tags (comma-separated)"
              style={{
                padding: '9px 10px',
                borderRadius: 10,
                border: `1px solid ${borderSubtle}`,
                background: cardBg,
                color: textPrimary,
                fontSize: 12,
                fontWeight: 600,
              }}
            />
          </div>

          <div
            style={{
              border: `1px solid ${borderSubtle}`,
              borderRadius: 12,
              background: pageBg,
              padding: 10,
              height: 150,
              overflow: 'auto',
              fontSize: 12,
              color: textSecondary,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}
            >
              Extracted text
            </div>
            {selectedCrawlId && selectedSource?.id === selectedCrawlId
              ? selectedSource?.content_text || ''
              : 'Select a crawled link to preview extracted content.'}
          </div>

          <button
            type="button"
            disabled={!selectedCrawlId || creatingArticle}
            onClick={async () => {
              if (!selectedCrawlId) return;
              setError('');
              setSuccess('');
              setCreatingArticle(true);
              try {
                const src =
                  selectedSource?.id === selectedCrawlId
                    ? selectedSource
                    : await onboardingApi.kbSource(selectedCrawlId);
                const tags = String(crawl.tags || '')
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean);
                await onboardingApi.kbConvert(selectedCrawlId, {
                  title: (crawl.title || src?.title || 'Untitled').slice(0, 200),
                  body: String(src?.content_text || ''),
                  category: crawl.category || 'General',
                  audience: crawl.audience || 'general',
                  tags,
                  tenant_product_id: tenantProductId || null,
                });
                setSuccess('KB article created from extracted text.');
              } catch (e: any) {
                setError(e?.message || 'Failed to create KB article');
              } finally {
                setCreatingArticle(false);
              }
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 10,
              border: 'none',
              background: accentBrand,
              color: '#000',
              fontWeight: 800,
              fontSize: 12,
              cursor: !selectedCrawlId || creatingArticle ? 'not-allowed' : 'pointer',
              opacity: !selectedCrawlId || creatingArticle ? 0.7 : 1,
            }}
          >
            {creatingArticle ? 'Creating…' : 'Create KB article from extracted text'}
          </button>
        </div>
      </div>

      {sourceModalOpen && selectedSource && (
        <div
          onClick={() => setSourceModalOpen(false)}
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
              width: 'min(900px, 96vw)',
              maxHeight: '85vh',
              background: isDark ? '#020617' : '#FFFFFF',
              border: `1px solid ${borderSubtle}`,
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: `1px solid ${borderSubtle}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedSource.title || 'Untitled'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedSource.url}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSourceModalOpen(false)}
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
            <div
              style={{
                padding: 12,
                overflow: 'auto',
                fontSize: 12.5,
                color: textSecondary,
                lineHeight: 1.7,
              }}
            >
              <div style={{ marginBottom: 8, fontSize: 11 }}>Updated {fmt(selectedSource.updated_at || selectedSource.created_at)}</div>
              {selectedSource.content_text || ''}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onboardingApi.setStep('ai_bot');
            onNext();
          } finally {
            setSaving(false);
          }
        }}
        style={{
          marginTop: 6,
          padding: '10px 20px',
          borderRadius: 10,
          background: accentBrand,
          color: '#000',
          border: 'none',
          fontWeight: 700,
          fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Saving...' : 'Continue to AI Bot'}
      </button>
    </>
  );
}

interface AiBotInlineProps {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  inputBg: string;
  accentBrand: string;
  onNext: () => void;
  initialTenantProductId?: string;
}

function AiBotInline(props: AiBotInlineProps) {
  const { isDark, textPrimary, textSecondary, borderSubtle, inputBg, accentBrand, onNext, initialTenantProductId } = props;
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tenantProducts, setTenantProducts] = useState<
    Array<{ id: string; name: string; l0_provider?: string | null; l0_model?: string | null }>
  >([]);
  const [tenantProductId, setTenantProductId] = useState<string>(initialTenantProductId || '');
  const [providers, setProviders] = useState<
    Array<{ provider_name: string; available_models: any; default_model?: string | null }>
  >([]);
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
        const firstId = (initialTenantProductId && prodList.some((x: any) => x.id === initialTenantProductId))
          ? initialTenantProductId
          : (prodList[0]?.id || '');
        setTenantProductId(firstId);

        const prov = Array.isArray((m as any)?.providers) ? (m as any).providers : [];
        setProviders(prov);
        const firstProvider = prov[0]?.provider_name || '';
        setProviderName(firstProvider);
        const firstModel = Array.isArray(prov[0]?.available_models)
          ? String(prov[0].available_models[0] ?? '')
          : '';
        setModel(firstModel);
      })
      .catch(() => setError('Failed to load AI models'))
      .finally(() => setLoading(false));
  }, [mounted, initialTenantProductId]);
  useEffect(() => {
    if (initialTenantProductId && tenantProducts.some((x) => x.id === initialTenantProductId)) {
      setTenantProductId(initialTenantProductId);
    }
  }, [initialTenantProductId, tenantProducts]);

  useEffect(() => {
    if (!tenantProductId) return;
    const tp = tenantProducts.find((x) => x.id === tenantProductId);
    if (tp?.l0_provider) setProviderName(tp.l0_provider);
    if (tp?.l0_model) setModel(tp.l0_model);
  }, [tenantProductId, tenantProducts]);

  if (!mounted) return null;

  const currentProvider =
    providers.find((p) => p.provider_name === providerName) || providers[0];
  const models =
    currentProvider && Array.isArray(currentProvider.available_models)
      ? currentProvider.available_models.map(String)
      : [];

  return (
    <>
      {error && (
        <div
          style={{
            padding: 10,
            background: 'rgba(239,68,68,0.08)',
            borderRadius: 10,
            color: '#ef4444',
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: textSecondary, fontSize: 12 }}>Loading models…</div>
      ) : (
        <div
          style={{
            padding: 16,
            border: `1px solid ${borderSubtle}`,
            borderRadius: 14,
            background: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 12,
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 800,
                  color: textSecondary,
                  marginBottom: 4,
                }}
              >
                Product
              </label>
              <select
                value={tenantProductId}
                onChange={(e) => setTenantProductId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${borderSubtle}`,
                  background: inputBg,
                  color: textPrimary,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {tenantProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 800,
                  color: textSecondary,
                  marginBottom: 4,
                }}
              >
                Provider
              </label>
              <select
                value={providerName}
                onChange={(e) => {
                  const next = e.target.value;
                  setProviderName(next);
                  const p = providers.find((x) => x.provider_name === next);
                  const first =
                    p && Array.isArray(p.available_models)
                      ? String(p.available_models[0] ?? '')
                      : '';
                  setModel(first);
                }}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${borderSubtle}`,
                  background: inputBg,
                  color: textPrimary,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {providers.map((p) => (
                  <option key={p.provider_name} value={p.provider_name}>
                    {p.provider_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 800,
                  color: textSecondary,
                  marginBottom: 4,
                }}
              >
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${borderSubtle}`,
                  background: inputBg,
                  color: textPrimary,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6, fontSize: 11, color: textSecondary }}>
                Saved per product. L0 bot will use this model for answers, summaries, and deflection.
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError('');
          try {
            if (tenantProductId && providerName && model) {
              await onboardingApi.setL0Model(tenantProductId, providerName, model);
            }
            await onboardingApi.setStep('channels');
            onNext();
          } catch (e: any) {
            setError(e?.message || 'Failed to save AI bot settings');
          } finally {
            setSaving(false);
          }
        }}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          background: accentBrand,
          color: '#000',
          border: 'none',
          fontWeight: 700,
          fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Saving...' : 'Continue to Channels'}
      </button>
    </>
  );
}

interface ChannelsInlineProps {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  inputBg: string;
  accentBrand: string;
  products?: TenantProduct[];
  onNext: () => void;
}

function ChannelsInline(props: ChannelsInlineProps) {
  const { isDark, textPrimary, textSecondary, borderSubtle, inputBg, accentBrand, products, onNext } = props;
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatPosition, setChatPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [chatPrimaryColor, setChatPrimaryColor] = useState('#FACC15');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formPath, setFormPath] = useState('/support');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [supportEmail, setSupportEmail] = useState('support@example.com');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    onboardingApi
      .getChannels()
      .then((data: any) => {
        if (!data) return;
        if (typeof data.chat_enabled === 'boolean') setChatEnabled(data.chat_enabled);
        if (data.chat_position === 'bottom-left' || data.chat_position === 'bottom-right') {
          setChatPosition(data.chat_position);
        }
        if (typeof data.chat_primary_color === 'string') setChatPrimaryColor(data.chat_primary_color);
        if (typeof data.webform_enabled === 'boolean') setFormEnabled(data.webform_enabled);
        if (typeof data.webform_path === 'string') setFormPath(data.webform_path || '/support');
        if (typeof data.email_enabled === 'boolean') setEmailEnabled(data.email_enabled);
        if (typeof data.support_email === 'string') setSupportEmail(data.support_email || 'support@example.com');
        if (typeof data.default_product_id === 'string') setSelectedProductId(data.default_product_id);
      })
      .catch(() => {
        // ignore, keep defaults
      });
  }, [mounted]);

  if (!mounted) return null;

  const safeProducts = products || [];
  const tenantProductIdForSnippet =
    selectedProductId || user?.product_id || (safeProducts[0]?.id ?? 'PRODUCT_ID');
  const selectedTenantProduct = safeProducts.find((p) => p.id === tenantProductIdForSnippet);
  const tenantIdForSnippet = user?.tenant_id || selectedTenantProduct?.tenant_id || 'TENANT_ID';
  // NOTE: for product-scoped KB/SLA/escalation we treat "product" here as tenant_product_id.
  // Keep data-product for backward compatibility, but prefer data-tenant-product-id.
  const widgetScript =
    `<script src="http://localhost:3000/widget.js"` +
    ` data-tenant="${tenantIdForSnippet}"` +
    ` data-tenant-product-id="${tenantProductIdForSnippet}"` +
    ` data-product="${tenantProductIdForSnippet}"` +
    `></script>`;
  const formOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://your-support-domain.com';
  // For the hosted webform we still include `product_id` for backward compatibility,
  // but prefer `tenant_product_id` going forward (aligns with product-scoped setup).
  const qp =
    `?tenant_id=${encodeURIComponent(tenantIdForSnippet)}` +
    `&tenant_product_id=${encodeURIComponent(tenantProductIdForSnippet)}` +
    `&product_id=${encodeURIComponent(tenantProductIdForSnippet)}`;
  const formUrl = `${formOrigin}${formPath || '/support'}${qp}`;
  const iframeSnippet = `<iframe
  src="${formUrl}"
  width="100%"
  height="650"
  style="border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(15,23,42,0.35);"
  title="Support form"
></iframe>`;

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1.15fr)',
          gap: 14,
          marginBottom: 16,
        }}
      >
        {error && (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: 10,
              borderRadius: 10,
              border: `1px solid rgba(248,113,113,0.4)`,
              background: 'rgba(248,113,113,0.08)',
              color: '#FCA5A5',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
        {/* Chat widget */}
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${borderSubtle}`,
            background: isDark ? 'rgba(15,23,42,0.95)' : '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>Chat widget</div>
              <div style={{ fontSize: 12, color: textSecondary }}>
                Floating widget for on-site conversations and L0 bot.
              </div>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: textSecondary,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={chatEnabled}
                onChange={(e) => setChatEnabled(e.target.checked)}
              />
              Enabled
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: textSecondary,
                  marginBottom: 4,
                }}
              >
                Product for widget
              </label>
              <select
                value={tenantProductIdForSnippet}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${borderSubtle}`,
                  background: inputBg,
                  color: textPrimary,
                  fontSize: 12,
                }}
              >
                <option value="">Select product</option>
                {safeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: textSecondary,
                  marginBottom: 4,
                }}
              >
                Widget position
              </label>
              <select
                value={chatPosition}
                onChange={(e) => setChatPosition(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${borderSubtle}`,
                  background: inputBg,
                  color: textPrimary,
                  fontSize: 12,
                }}
              >
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: textSecondary,
                  marginBottom: 4,
                }}
              >
                Primary color
              </label>
              <input
                type="text"
                value={chatPrimaryColor}
                onChange={(e) => setChatPrimaryColor(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${borderSubtle}`,
                  background: inputBg,
                  color: textPrimary,
                  fontSize: 12,
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 6,
              borderRadius: 10,
              border: `1px solid ${borderSubtle}`,
              background: isDark ? '#020617' : '#0F172A',
              padding: 10,
              fontSize: 11,
              color: isDark ? '#E5E7EB' : '#E5E7EB',
              fontFamily: 'monospace',
              whiteSpace: 'pre',
            }}
          >
            {widgetScript}
          </div>
        </div>

        {/* Webform & email */}
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${borderSubtle}`,
            background: isDark ? 'rgba(15,23,42,0.95)' : '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>Hosted webform</div>
              <div style={{ fontSize: 12, color: textSecondary }}>
                Simple ticket form you can link from your site or emails.
              </div>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: textSecondary,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
              />
              Enabled
            </label>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: textSecondary,
                marginBottom: 4,
              }}
            >
              Form path
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: textSecondary }}>https://your-support-domain.com</span>
              <input
                type="text"
                value={formPath}
                onChange={(e) => setFormPath(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${borderSubtle}`,
                  background: inputBg,
                  color: textPrimary,
                }}
              />
            </div>
          </div>

          <div>
            <div
              style={{
                marginTop: 8,
                marginBottom: 4,
                fontSize: 11,
                color: textSecondary,
              }}
            >
              Embed code (copy into your site to show this form)
            </div>
            <div
              style={{
                borderRadius: 10,
                border: `1px solid ${borderSubtle}`,
                background: isDark ? '#020617' : '#0F172A',
                padding: 10,
                fontSize: 11,
                color: '#E5E7EB',
                fontFamily: 'monospace',
                whiteSpace: 'pre',
                overflowX: 'auto',
              }}
            >
              {iframeSnippet}
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${borderSubtle}`,
              fontSize: 12,
              color: textSecondary,
            }}
          >
            Email-to-ticket
          </div>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: textSecondary,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
            />
            Enabled
          </label>
          <input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="support@your-domain.com"
            style={{
              width: '100%',
              padding: '9px 10px',
              borderRadius: 10,
              border: `1px solid ${borderSubtle}`,
              background: inputBg,
              color: textPrimary,
              fontSize: 12,
            }}
          />
          <div style={{ fontSize: 11, color: textSecondary }}>
            Incoming emails to this address will be converted into tickets.
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError('');
          try {
            await onboardingApi.putChannels({
              chat_enabled: chatEnabled,
              chat_position: chatPosition,
              chat_primary_color: chatPrimaryColor,
              webform_enabled: formEnabled,
              webform_path: formPath || '/support',
              email_enabled: emailEnabled,
              support_email: supportEmail || null,
              default_product_id: tenantProductIdForSnippet !== 'PRODUCT_ID' ? tenantProductIdForSnippet : null,
            });
            await onboardingApi.setStep('branding');
            onNext();
          } catch (e: any) {
            setError(e?.message || 'Failed to save support channel settings');
          } finally {
            setSaving(false);
          }
        }}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          background: accentBrand,
          color: '#000',
          border: 'none',
          fontWeight: 700,
          fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Saving...' : 'Continue to Branding'}
      </button>
    </>
  );
}

interface BrandingInlineProps {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  inputBg: string;
  accentBrand: string;
  onNext: () => void;
}

function BrandingInline(props: BrandingInlineProps) {
  const { isDark, textPrimary, textSecondary, borderSubtle, inputBg, accentBrand, onNext } = props;
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#FACC15');
  const [customDomain, setCustomDomain] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    onboardingApi
      .getBranding()
      .then((data: any) => {
        if (!data) return;
        if (typeof data.logo_base64 === 'string') setLogoBase64(data.logo_base64);
        if (typeof data.primary_color === 'string') setPrimaryColor(data.primary_color || '#FACC15');
        if (typeof data.custom_domain === 'string') setCustomDomain(data.custom_domain || '');
      })
      .catch(() => {
        // ignore, keep defaults
      });
  }, [mounted]);

  if (!mounted) return null;

  const handleLogoChange = (file: File | null) => {
    if (!file) {
      setLogoBase64(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setLogoBase64(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {error && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            border: `1px solid rgba(248,113,113,0.4)`,
            background: 'rgba(248,113,113,0.08)',
            color: '#FCA5A5',
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            border: `1px solid rgba(34,197,94,0.4)`,
            background: 'rgba(22,163,74,0.08)',
            color: '#4ADE80',
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {success}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Logo upload + preview */}
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${borderSubtle}`,
            background: isDark ? 'rgba(15,23,42,0.95)' : '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>Portal logo</div>
            <div style={{ fontSize: 12, color: textSecondary }}>
              This logo appears in the portal header and support widget.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                border: `1px dashed ${borderSubtle}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: isDark ? '#020617' : '#F9FAFB',
              }}
            >
              {logoBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoBase64} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 10, color: textSecondary }}>No logo</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: accentBrand,
                  color: '#000',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Choose logo
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleLogoChange(e.target.files?.[0] || null)}
                />
              </label>
              <button
                type="button"
                onClick={() => handleLogoChange(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: textSecondary,
                  fontSize: 11,
                  textAlign: 'left',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                Remove logo
              </button>
            </div>
          </div>
        </div>

        {/* Colors + domain */}
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${borderSubtle}`,
            background: isDark ? 'rgba(15,23,42,0.95)' : '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>Colors & support domain</div>
            <div style={{ fontSize: 12, color: textSecondary }}>
              Match the portal accent color and domain to your brand.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: textSecondary,
                  marginBottom: 4,
                }}
              >
                Primary color (hex)
              </label>
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#FACC15"
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${borderSubtle}`,
                  background: inputBg,
                  color: textPrimary,
                  fontSize: 12,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: textSecondary,
                  marginBottom: 4,
                }}
              >
                Support domain
              </label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="support.yourdomain.edu"
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${borderSubtle}`,
                  background: inputBg,
                  color: textPrimary,
                  fontSize: 12,
                }}
              />
            </div>
          </div>
          <div style={{ fontSize: 11, color: textSecondary }}>
            Tip: configure DNS + SSL for the support domain in your infrastructure. This setting tells widgets and links
            which host to use.
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError('');
          setSuccess('');
          try {
            await onboardingApi.putBranding({
              logo_base64: logoBase64,
              primary_color: primaryColor,
              custom_domain: customDomain || null,
            });
            await onboardingApi.setStep('notifications');
            setSuccess('Branding saved.');
            onNext();
          } catch (e: any) {
            setError(e?.message || 'Failed to save branding');
          } finally {
            setSaving(false);
          }
        }}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          background: accentBrand,
          color: '#000',
          border: 'none',
          fontWeight: 700,
          fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Saving...' : 'Save & Continue to Notifications'}
      </button>
    </>
  );
}

export default function TenantDashboardPage() {
  const { theme, setTheme } = useTheme();
  const { user, hydrate, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [activeConfig, setActiveConfig] = useState<ConfigSection>('overview');

  // Products state (copied from setup products page)
  const [products, setProducts] = useState<TenantProduct[]>([]);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productWebsite, setProductWebsite] = useState('');
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsSaving, setProductsSaving] = useState(false);
  const [productsError, setProductsError] = useState('');

  // Agents state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentRole, setAgentRole] = useState('l1_agent');
  const [agentSupportLevel, setAgentSupportLevel] = useState('L1');
  const [agentProducts, setAgentProducts] = useState<string[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsSaving, setAgentsSaving] = useState(false);
  const [agentsError, setAgentsError] = useState('');
  const [showResetAgentPasswordModal, setShowResetAgentPasswordModal] = useState(false);
  const [resetAgentId, setResetAgentId] = useState<string | null>(null);
  const [resetAgentLabel, setResetAgentLabel] = useState<string>('');
  const [resetAgentPassword, setResetAgentPassword] = useState('');
  const [resetAgentInfo, setResetAgentInfo] = useState('');

  // Plan state
  const [plans, setPlans] = useState<Array<{ id: string; name: string; max_agents: number; max_tickets_per_month: number; max_products: number; price_usd: unknown; price_inr: unknown }>>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansSaving, setPlansSaving] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<{
    payment_id: string;
    order_id: string;
    plan_name: string;
    amount_inr: number;
    paid_at: string;
    valid_until: string;
  } | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [peopleFirstName, setPeopleFirstName] = useState('');
  const [peopleLastName, setPeopleLastName] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [peoplePassword, setPeoplePassword] = useState('');
  const [configurationStatus, setConfigurationStatus] = useState<ConfigurationStatus | null>(null);
  const [configStatusLoading, setConfigStatusLoading] = useState(false);
  const [configProductId, setConfigProductId] = useState<string | null>(null);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [agentFilterProductId, setAgentFilterProductId] = useState<string | null>(null);

  const fetchConfigurationStatus = () => {
    setConfigStatusLoading(true);
    onboardingApi
      .getConfigurationStatus()
      .then((data) => setConfigurationStatus(data))
      .catch(() => setConfigurationStatus(null))
      .finally(() => setConfigStatusLoading(false));
  };

  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  useEffect(() => {
    if (!mounted) return;
    // Load tenant products once dashboard is mounted
    const token = typeof window !== 'undefined' ? localStorage.getItem('gkt_token') : null;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) (headers as any).Authorization = `Bearer ${token}`;

    setPlansLoading(true);

    Promise.all([
      onboardingApi.getProducts(),
      onboardingApi.getAgents().catch(() => []),
      fetch(`${API_BASE}/api/billing/plans`, { headers })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      onboardingApi.getState().catch(() => null),
      onboardingApi.getConfigurationStatus().catch(() => null),
    ])
      .then(([p, a, planList, state, configStatus]) => {
        setProducts(Array.isArray(p) ? (p as TenantProduct[]) : []);
        setAgents(Array.isArray(a) ? a : []);
        const list = Array.isArray(planList) ? (planList as any[]) : [];
        setPlans(
          list.map((pl) => ({
            id: pl.id,
            name: pl.name,
            max_agents: pl.max_agents,
            max_tickets_per_month: pl.max_tickets_per_month,
            max_products: typeof pl.max_products === 'number' ? pl.max_products : 0,
            price_usd: pl.price_usd,
            price_inr: pl.price_inr,
          }))
        );
        const currentPlanId = state?.tenant?.plan_id || null;
        setSelectedPlanId(currentPlanId);
        if (configStatus && typeof configStatus === 'object' && 'products' in configStatus) {
          setConfigurationStatus(configStatus as ConfigurationStatus);
        }
      })
      .catch(() => {
        setProducts([]);
        setAgents([]);
        setPlans([]);
        setPlansError('Failed to load plans');
      })
      .finally(() => {
        setProductsLoading(false);
        setAgentsLoading(false);
        setPlansLoading(false);
      });
  }, [mounted]);

  useEffect(() => {
    if (activeConfig === 'agents' && configProductId) {
      setAgentFilterProductId(configProductId);
    }
  }, [activeConfig, configProductId]);

  useEffect(() => {
    if (mounted && activeConfig === 'configuration-hub') {
      fetchConfigurationStatus();
    }
  }, [mounted, activeConfig]);

  if (!mounted) return null;

  const isDark = theme === 'dark';

  const bgPrimary = isDark ? '#020617' : '#F3F4F6';
  const bgSurface = isDark ? '#020617' : '#FFFFFF';
  const bgSurfaceElevated = isDark ? '#020617' : '#FFFFFF';
  const textPrimary = isDark ? '#E5E7EB' : '#020617';
  const textSecondary = isDark ? '#9CA3AF' : '#4B5563';
  const borderSubtle = isDark ? 'rgba(148, 163, 184, 0.35)' : '#E5E7EB';
  const accentBrand = isDark ? '#0EA5E9' : '#2563EB';
  const accentBrandSoft = isDark ? 'rgba(59, 130, 246, 0.18)' : '#DBEAFE';
  const accentBrandBorder = isDark ? 'rgba(96, 165, 250, 0.7)' : '#93C5FD';
  const accentChipBg = isDark ? 'rgba(34, 197, 94, 0.14)' : '#DCFCE7';
  const accentChipText = isDark ? '#4ADE80' : '#166534';
  const inputBg = isDark ? '#020617' : '#FFFFFF';

  const currentPlan = selectedPlanId ? plans.find((p) => p.id === selectedPlanId) : null;
  const agentCount = agents.filter((a: any) =>
    a.role && ['l1_agent', 'l2_agent', 'l3_agent'].includes(String(a.role))
  ).length;
  const tenantAdminCount = agents.filter((a: any) => a.role === 'tenant_admin').length;
  const productLimitReached =
    !!currentPlan &&
    currentPlan.max_products > 0 &&
    products.length >= currentPlan.max_products;
  const agentLimitReached =
    !!currentPlan &&
    currentPlan.max_agents !== -1 &&
    agentCount >= currentPlan.max_agents;
  const peopleLimitReached =
    !!currentPlan &&
    tenantAdminCount >= 1 &&
    (currentPlan.max_agents === -1 ? false : agentCount >= currentPlan.max_agents);

  const tenantName = (user as any)?.tenant_name || 'Your workspace';
  const displayName = (user as any)?.first_name
    ? `${(user as any).first_name}`
    : user?.name || 'there';
  const avatarInitial = (displayName || 'U').charAt(0).toUpperCase();

  const handleLogout = () => {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const statCard = (opts: {
    label: string;
    value: string;
    change?: string;
    changeTone?: 'good' | 'bad' | 'neutral';
  }) => {
    const toneColor =
      opts.changeTone === 'good'
        ? (isDark ? '#22C55E' : '#15803D')
        : opts.changeTone === 'bad'
        ? (isDark ? '#F97373' : '#B91C1C')
        : textSecondary;

    return (
      <div
        style={{
          borderRadius: '18px',
          border: `1px solid ${borderSubtle}`,
          background: bgSurfaceElevated,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: isDark
            ? '0 18px 55px rgba(15,23,42,0.85)'
            : '0 18px 55px rgba(15,23,42,0.07)',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 500, color: textSecondary }}>{opts.label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: textPrimary }}>{opts.value}</span>
          {opts.change && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: toneColor,
                padding: '2px 8px',
                borderRadius: '999px',
                background:
                  opts.changeTone === 'good'
                    ? (isDark ? 'rgba(22, 163, 74, 0.16)' : 'rgba(74, 222, 128, 0.12)')
                    : opts.changeTone === 'bad'
                    ? (isDark ? 'rgba(220, 38, 38, 0.16)' : 'rgba(254, 202, 202, 0.75)')
                    : 'transparent',
              }}
            >
              {opts.change}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: bgPrimary,
        color: textPrimary,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      }}
    >
      {/* Left rail / navigation */}
      <aside
        style={{
          width: '260px',
          padding: '20px 18px',
          borderRight: `1px solid ${borderSubtle}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          background: isDark ? '#020617' : '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 6px 4px 4px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: accentBrandSoft,
              border: `1px solid ${accentBrandBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: accentBrand,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>GKT AI Ticketing</span>
            <span style={{ fontSize: 11, color: textSecondary }}>Modern AI workspace for education teams</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: textSecondary,
              padding: '0 8px',
            }}
          >
            Overview
          </span>
          <Link
            href="/admin/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 10px',
              borderRadius: '10px',
              textDecoration: 'none',
              color: textPrimary,
              background: accentBrandSoft,
              border: `1px solid ${accentBrandBorder}`,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>Tenant dashboard</span>
            <span style={{ fontSize: 11, color: textSecondary }}>Home</span>
          </Link>
        </div>

        {/* Primary entities directly under dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setActiveConfig('products')}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              borderRadius: '10px',
              border: 'none',
              background: activeConfig === 'products' ? accentBrandSoft : 'transparent',
              color: activeConfig === 'products' ? textPrimary : textSecondary,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Products
          </button>
          <button
            type="button"
            onClick={() => setActiveConfig('people')}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              borderRadius: '10px',
              border: 'none',
              background: activeConfig === 'people' ? accentBrandSoft : 'transparent',
              color: activeConfig === 'people' ? textPrimary : textSecondary,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            People
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: textSecondary,
              padding: '0 8px',
            }}
          >
            Configuration
          </span>
          {[
            { key: 'configuration-hub', label: 'Setup status' },
            { key: 'agents', label: 'Agents' },
            { key: 'ticket-settings', label: 'Ticket settings' },
            { key: 'sla', label: 'SLA configuration' },
            { key: 'escalation', label: 'Escalation rules' },
            { key: 'kb', label: 'Knowledge base' },
            { key: 'ai-bot', label: 'L0 AI bot' },
            { key: 'channels', label: 'Support channels' },
            { key: 'branding', label: 'Branding & white-label' },
          ].map((item) => {
            const isActive = activeConfig === (item.key as ConfigSection);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveConfig(item.key as ConfigSection)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? accentBrandSoft : 'transparent',
                  color: isActive ? textPrimary : textSecondary,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            href="/admin/billing"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '10px',
              textDecoration: 'none',
              color: textSecondary,
              fontSize: 13,
              border: `1px solid ${borderSubtle}`,
              background: 'transparent',
            }}
          >
            <span>Billing &amp; Invoices</span>
            <span style={{ fontSize: 11 }}>→</span>
          </Link>
          <div
            style={{
              borderRadius: '14px',
              border: `1px dashed ${borderSubtle}`,
              background: isDark ? '#020617' : '#F9FAFB',
              padding: '12px 12px 12px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 11, color: textSecondary }}>Plan</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {plans.find((p) => p.id === selectedPlanId)?.name || 'No plan selected'}
            </span>
            <span style={{ fontSize: 11, color: textSecondary }}>
              {(() => {
                const plan = plans.find((p) => p.id === selectedPlanId);
                if (!plan) return 'Select a plan to unlock limits';
                const agents =
                  plan.max_agents === -1 ? 'Unlimited agents' : `${plan.max_agents} agents`;
                const tickets =
                  plan.max_tickets_per_month === -1
                    ? 'unlimited tickets/mo'
                    : `${plan.max_tickets_per_month.toLocaleString()} tickets/mo`;
                return `${agents} • ${tickets}`;
              })()}
            </span>
            <button
              type="button"
              onClick={() => setShowPlansModal(true)}
              style={{
                marginTop: 4,
                fontSize: 11,
                color: isDark ? '#60A5FA' : '#1D4ED8',
                textDecoration: 'none',
                border: 'none',
                background: 'transparent',
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              View plans →
            </button>
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '999px',
              border: `1px solid ${borderSubtle}`,
              background: 'transparent',
              color: textSecondary,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          padding: '20px 26px 24px 26px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* Header / theme + user */}
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 12,
              borderBottom: `1px solid ${borderSubtle}`,
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: `1px solid ${borderSubtle}`,
                  background: isDark ? '#020617' : '#EEF2FF',
                  color: textSecondary,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
                aria-label="Toggle theme"
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    border: `1px solid ${borderSubtle}`,
                    background: isDark ? accentBrand : '#F9FAFB',
                  }}
                />
                <span>{isDark ? 'Dark' : 'Light'} mode</span>
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: `1px solid ${borderSubtle}`,
                  background: isDark ? '#020617' : '#FFFFFF',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '999px',
                    background: isDark ? '#1E293B' : '#DBEAFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: isDark ? '#E5E7EB' : '#1E3A8A',
                  }}
                >
                  {avatarInitial}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{displayName}</span>
                  <button
                    type="button"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      margin: 0,
                      fontSize: 11,
                      color: textSecondary,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    Profile & settings
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main content: overview is cleared; config panels remain in sidebar */}
          {activeConfig === 'overview' ? (
            <div style={{ padding: '24px 0' }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>Tenant overview</h1>
              <p style={{ fontSize: 13, color: textSecondary, margin: 0 }}>
                Use the sidebar to configure products, agents, and settings.
              </p>
            </div>
          ) : (
            // Configuration detail panel, stays in dashboard theme
            <div
              style={{
                borderRadius: '20px',
                border: `1px solid ${borderSubtle}`,
                background: bgSurface,
                padding: '18px 20px',
                marginTop: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {activeConfig === 'configuration-hub' && (
                <>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>Setup status</h2>
                  <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 16px 0' }}>
                    See which product has what configured. Select a product to complete missing setup.
                  </p>
                  {configStatusLoading ? (
                    <p style={{ fontSize: 13, color: textSecondary }}>Loading configuration status…</p>
                  ) : (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Select product</label>
                        <select
                          value={configProductId || ''}
                          onChange={(e) => setConfigProductId(e.target.value || null)}
                          style={{
                            minWidth: 220,
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: `1px solid ${borderSubtle}`,
                            background: inputBg,
                            color: textPrimary,
                            fontSize: 13,
                          }}
                        >
                          <option value="">— Choose a product —</option>
                          {(configurationStatus?.products ?? []).map((tp) => (
                            <option key={tp.id} value={tp.id}>
                              {(() => {
                                const cfg = tp.configuration || ({} as any);
                                const perProductDone =
                                  (cfg.agents ? 1 : 0) +
                                  (cfg.kb ? 1 : 0) +
                                  (cfg.l0_bot ? 1 : 0) +
                                  (cfg.sla ? 1 : 0) +
                                  (cfg.escalation ? 1 : 0);
                                const tenant = configurationStatus?.tenant_level;
                                const globalDone =
                                  (tenant?.ticket_settings ? 1 : 0) +
                                  (tenant?.channels ? 1 : 0) +
                                  (tenant?.branding ? 1 : 0);
                                const totalSteps = 8;
                                const totalDone = Math.min(totalSteps, globalDone + perProductDone);
                                return `${tp.name} (${totalDone}/8 configured)`;
                              })()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: 10,
                          marginBottom: 20,
                        }}
                      >
                        {(configurationStatus?.products ?? []).map((tp) => (
                          <button
                            key={tp.id}
                            type="button"
                            onClick={() => setConfigProductId(tp.id)}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 10,
                              border: `1px solid ${configProductId === tp.id ? accentBrand : borderSubtle}`,
                              background: configProductId === tp.id ? accentBrandSoft : (isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB'),
                              color: textPrimary,
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{tp.name}</div>
                            <div style={{ fontSize: 11, color: textSecondary }}>
                              {(() => {
                                const cfg = tp.configuration || ({} as any);
                                const perProductDone =
                                  (cfg.agents ? 1 : 0) +
                                  (cfg.kb ? 1 : 0) +
                                  (cfg.l0_bot ? 1 : 0) +
                                  (cfg.sla ? 1 : 0) +
                                  (cfg.escalation ? 1 : 0);
                                const tenant = configurationStatus?.tenant_level;
                                const globalDone =
                                  (tenant?.ticket_settings ? 1 : 0) +
                                  (tenant?.channels ? 1 : 0) +
                                  (tenant?.branding ? 1 : 0);
                                const totalSteps = 8;
                                const totalDone = Math.min(totalSteps, globalDone + perProductDone);
                                const remaining = totalSteps - totalDone;
                                return `${totalDone}/8 done${remaining > 0 ? ` · ${remaining} to go` : ''}`;
                              })()}
                            </div>
                          </button>
                        ))}
                      </div>
                      <div style={{ borderTop: `1px solid ${borderSubtle}`, paddingTop: 16 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: textSecondary, marginBottom: 10 }}>
                          {configProductId ? `${configurationStatus?.products?.find((p) => p.id === configProductId)?.name ?? 'Product'} — checklist` : 'Workspace (tenant) — checklist'}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {configProductId ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }}>
                                <span style={{ fontSize: 13 }}>Agents assigned</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration.agents ? (isDark ? '#4ADE80' : '#166534') : textSecondary, fontSize: 12 }}>
                                    {configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration.agents ? 'Done' : 'Not done'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveConfig('agents')}
                                    style={{ fontSize: 12, color: accentBrand, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Open
                                  </button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }}>
                                <span style={{ fontSize: 13 }}>Knowledge base</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration.kb ? (isDark ? '#4ADE80' : '#166534') : textSecondary, fontSize: 12 }}>
                                    {configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration.kb ? 'Done' : 'Not done'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => { setConfigProductId(configProductId); setActiveConfig('kb'); }}
                                    style={{ fontSize: 12, color: accentBrand, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Open
                                  </button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }}>
                                <span style={{ fontSize: 13 }}>L0 AI bot</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration.l0_bot ? (isDark ? '#4ADE80' : '#166534') : textSecondary, fontSize: 12 }}>
                                    {configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration.l0_bot ? 'Done' : 'Not done'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => { setConfigProductId(configProductId); setActiveConfig('ai-bot'); }}
                                    style={{ fontSize: 12, color: accentBrand, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Open
                                  </button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }}>
                                <span style={{ fontSize: 13 }}>SLA configuration</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration?.sla ? (isDark ? '#4ADE80' : '#166534') : textSecondary, fontSize: 12 }}>
                                    {configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration?.sla ? 'Done' : 'Not done'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => { setConfigProductId(configProductId); setActiveConfig('sla'); }}
                                    style={{ fontSize: 12, color: accentBrand, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Open
                                  </button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }}>
                                <span style={{ fontSize: 13 }}>Escalation rules</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration?.escalation ? (isDark ? '#4ADE80' : '#166534') : textSecondary, fontSize: 12 }}>
                                    {configurationStatus?.products?.find((p) => p.id === configProductId)?.configuration?.escalation ? 'Done' : 'Not done'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => { setConfigProductId(configProductId); setActiveConfig('escalation'); }}
                                    style={{ fontSize: 12, color: accentBrand, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Open
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : null}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }}>
                            <span style={{ fontSize: 13 }}>Ticket settings</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: configurationStatus?.tenant_level?.ticket_settings ? (isDark ? '#4ADE80' : '#166534') : textSecondary, fontSize: 12 }}>
                                {configurationStatus?.tenant_level?.ticket_settings ? 'Done' : 'Not done'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveConfig('ticket-settings')}
                                style={{ fontSize: 12, color: accentBrand, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Open
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }}>
                            <span style={{ fontSize: 13 }}>Support channels</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: configurationStatus?.tenant_level?.channels ? (isDark ? '#4ADE80' : '#166534') : textSecondary, fontSize: 12 }}>
                                {configurationStatus?.tenant_level?.channels ? 'Done' : 'Not done'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveConfig('channels')}
                                style={{ fontSize: 12, color: accentBrand, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Open
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }}>
                            <span style={{ fontSize: 13 }}>Branding & white-label</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: configurationStatus?.tenant_level?.branding ? (isDark ? '#4ADE80' : '#166534') : textSecondary, fontSize: 12 }}>
                                {configurationStatus?.tenant_level?.branding ? 'Done' : 'Not done'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveConfig('branding')}
                                style={{ fontSize: 12, color: accentBrand, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Open
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {activeConfig === 'products' && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>Products</h2>
                      <p style={{ fontSize: 13, color: textSecondary, margin: 0 }}>
                        List of products and services this tenant supports.
                      </p>
                    </div>
                    {!selectedPlanId ? (
                      <button
                        type="button"
                        onClick={() => setShowPlansModal(true)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: accentBrand,
                          color: '#0B1120',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Choose plan
                      </button>
                    ) : productLimitReached ? (
                      <button
                        type="button"
                        onClick={() => setShowPlansModal(true)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: `1px solid ${borderSubtle}`,
                          background: 'transparent',
                          color: textSecondary,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Plan limit reached ({products.length}/{currentPlan?.max_products})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setProductsError('');
                          setShowProductModal(true);
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: accentBrand,
                          color: '#0B1120',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Add product
                      </button>
                    )}
                  </div>

                  {productsError && (
                    <div
                      style={{
                        padding: 10,
                        background: 'rgba(239,68,68,0.08)',
                        borderRadius: 10,
                        color: '#ef4444',
                        marginBottom: 12,
                        fontSize: 12,
                      }}
                    >
                      {productsError}
                    </div>
                  )}

                  {productsLoading ? (
                    <p style={{ fontSize: 12, color: textSecondary }}>Loading products…</p>
                  ) : products.length > 0 ? (
                    <div
                      style={{
                        marginTop: 4,
                        borderRadius: 10,
                        border: `1px solid ${borderSubtle}`,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2.2fr 2fr 2.8fr 1.8fr 1.2fr',
                          padding: '8px 12px',
                          background: isDark ? '#020617' : '#F3F4F6',
                          fontSize: 11,
                          fontWeight: 600,
                          color: textSecondary,
                        }}
                      >
                        <span>Product</span>
                        <span>Website (optional)</span>
                        <span>Description</span>
                        <span>Created by</span>
                        <span style={{ textAlign: 'right' }}>Status</span>
                      </div>
                      {products.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2.2fr 2fr 2.8fr 1.8fr 1.2fr',
                            padding: '9px 12px',
                            borderTop: `1px solid ${borderSubtle}`,
                            alignItems: 'center',
                            fontSize: 12,
                            background: isDark ? '#020617' : '#FFFFFF',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </div>
                          <div style={{ color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.website || '—'}
                          </div>
                          <div
                            style={{
                              color: textSecondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {p.description || '—'}
                          </div>
                          <div style={{ color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.created_by_email || '—'}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                fontSize: 11,
                                padding: '3px 7px',
                                borderRadius: 999,
                                background:
                                  p.status === 'inactive'
                                    ? isDark
                                      ? 'rgba(148,163,184,0.15)'
                                      : '#E5E7EB'
                                    : isDark
                                    ? 'rgba(34,197,94,0.15)'
                                    : '#DCFCE7',
                                color: p.status === 'inactive' ? textSecondary : '#16a34a',
                              }}
                            >
                              {p.status === 'inactive' ? 'Inactive' : 'Active'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 18,
                        border: `1px dashed ${borderSubtle}`,
                        borderRadius: 12,
                        fontSize: 12,
                        color: textSecondary,
                      }}
                    >
                      {selectedPlanId
                        ? 'No products yet. Click "Add product" to create your first product.'
                        : 'Choose a plan above to add products.'}
                    </div>
                  )}
                </>
              )}

              {activeConfig === 'people' && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>People</h2>
                      <p style={{ fontSize: 13, color: textSecondary, margin: 0 }}>
                        Tenant admins and support agents for this workspace.
                      </p>
                    </div>
                    {!selectedPlanId ? (
                      <button
                        type="button"
                        onClick={() => setShowPlansModal(true)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: accentBrand,
                          color: '#0B1120',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Choose plan
                      </button>
                    ) : peopleLimitReached ? (
                      <button
                        type="button"
                        onClick={() => setShowPlansModal(true)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: `1px solid ${borderSubtle}`,
                          background: 'transparent',
                          color: textSecondary,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Plan limit reached (1 admin, {agentCount}/{currentPlan?.max_agents === -1 ? '∞' : currentPlan?.max_agents} agents)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAgentsError('');
                          setEditingPersonId(null);
                          setPeopleFirstName('');
                          setPeopleLastName('');
                          setAgentEmail('');
                          setAgentRole(
                            agentLimitReached ? 'tenant_admin' : 'l1_agent'
                          );
                          setAgentProducts([]);
                          setShowPeopleModal(true);
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: accentBrand,
                          color: '#0B1120',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Add people
                      </button>
                    )}
                  </div>

                  {agentsError && (
                    <div
                      style={{
                        padding: 10,
                        background: 'rgba(239,68,68,0.08)',
                        borderRadius: 10,
                        color: '#ef4444',
                        marginBottom: 12,
                        fontSize: 12,
                      }}
                    >
                      {agentsError}
                    </div>
                  )}

                  {agentsLoading ? (
                    <p style={{ fontSize: 12, color: textSecondary }}>Loading people…</p>
                  ) : agents.length > 0 ? (
                    <div
                      style={{
                        marginTop: 4,
                        borderRadius: 10,
                        border: `1px solid ${borderSubtle}`,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.8fr 2.2fr 1.4fr 1.4fr 2.2fr 0.9fr',
                          padding: '8px 12px',
                          background: isDark ? '#020617' : '#F3F4F6',
                          fontSize: 11,
                          fontWeight: 600,
                          color: textSecondary,
                        }}
                      >
                        <span>Name</span>
                        <span>Email</span>
                        <span>Role</span>
                        <span>Support level</span>
                        <span>Assigned products</span>
                        <span style={{ textAlign: 'right' }}>Actions</span>
                      </div>
                      {agents.map((a: any) => (
                        <div
                          key={a.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.8fr 2.2fr 1.4fr 1.4fr 2.2fr 0.9fr',
                            padding: '9px 12px',
                            borderTop: `1px solid ${borderSubtle}`,
                            alignItems: 'center',
                            fontSize: 12,
                            background: isDark ? '#020617' : '#FFFFFF',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: textPrimary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {a.first_name || a.last_name
                              ? `${a.first_name || ''} ${a.last_name || ''}`.trim()
                              : '—'}
                          </div>
                          <div
                            style={{
                              color: textSecondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {a.email || '—'}
                          </div>
                          <div style={{ color: textSecondary, textTransform: 'capitalize' }}>
                            {(a.role || '').replace(/_/g, ' ') || '—'}
                          </div>
                          <div style={{ color: textSecondary }}>
                            {a.role && a.role.startsWith('l')
                              ? a.primary_support_level || 'L1'
                              : '—'}
                          </div>
                          <div
                            style={{
                              color: textSecondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {Array.isArray(a.assigned_products) && a.assigned_products.length > 0
                              ? a.assigned_products
                                  .map((p: any) => p.name)
                                  .filter(Boolean)
                                  .join(', ')
                              : '—'}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setAgentsError('');
                                setEditingPersonId(a.id);
                                setPeopleFirstName(a.first_name || '');
                                setPeopleLastName(a.last_name || '');
                                setAgentEmail(a.email || '');
                                setAgentRole(a.role || 'l1_agent');
                                setAgentProducts(
                                  Array.isArray(a.assigned_products)
                                    ? a.assigned_products
                                        .map((p: any) => p?.id)
                                        .filter((id: any): id is string => typeof id === 'string')
                                    : []
                                );
                                setShowPeopleModal(true);
                              }}
                              style={{
                                padding: '7px 10px',
                                borderRadius: 10,
                                border: `1px solid ${borderSubtle}`,
                                background: isDark ? 'rgba(15,23,42,0.75)' : '#fff',
                                color: textPrimary,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 18,
                        border: `1px dashed ${borderSubtle}`,
                        borderRadius: 12,
                        fontSize: 12,
                        color: textSecondary,
                      }}
                    >
                      {selectedPlanId
                        ? 'No people yet. Use "Add people" to invite admins or agents.'
                        : 'Choose a plan above to add people.'}
                    </div>
                  )}
                </>
              )}

              {activeConfig === 'agents' && (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>Agents</h2>
                    <p style={{ fontSize: 13, color: textSecondary, margin: 0 }}>
                      Team members who handle tickets. Filter by product or add agents.
                    </p>
                  </div>
                  {!selectedPlanId ? (
                    <button
                      type="button"
                      onClick={() => setShowPlansModal(true)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: accentBrand,
                        color: '#0B1120',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Choose plan
                    </button>
                  ) : agentLimitReached ? (
                    <button
                      type="button"
                      onClick={() => setShowPlansModal(true)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: `1px solid ${borderSubtle}`,
                        background: 'transparent',
                        color: textSecondary,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Plan limit reached ({agentCount}/{currentPlan?.max_agents} agents)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAgentsError('');
                        setAgentProducts(agentFilterProductId ? [agentFilterProductId] : []);
                        setShowAddAgentModal(true);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: accentBrand,
                        color: '#0B1120',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Add agent
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: textSecondary }}>Filter by product</span>
                  <select
                    value={agentFilterProductId || ''}
                    onChange={(e) => setAgentFilterProductId(e.target.value || null)}
                    style={{
                      minWidth: 180,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${borderSubtle}`,
                      background: inputBg,
                      color: textPrimary,
                      fontSize: 13,
                    }}
                  >
                    <option value="">All products</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {agentsLoading ? (
                  <p style={{ fontSize: 12, color: textSecondary }}>Loading...</p>
                ) : (() => {
                  const filtered = agentFilterProductId
                    ? agents.filter((a: any) =>
                        Array.isArray(a.assigned_products) &&
                        a.assigned_products.some((p: any) => p.id === agentFilterProductId)
                      )
                    : agents;
                  return filtered.length > 0 ? (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>
                        {agentFilterProductId ? `Agents for this product (${filtered.length})` : `All agents (${filtered.length})`}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {filtered.map((a: any) => {
                          const roleLabel = (a.role || 'agent').replace(/_/g, ' ');
                          const displayName = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email || 'Agent';
                          const productsForAgent =
                            Array.isArray(a.assigned_products) && a.assigned_products.length > 0
                              ? a.assigned_products.map((p: any) => p.name).filter(Boolean).join(', ')
                              : 'No products assigned';
                          return (
                            <div
                              key={a.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 10px',
                                borderRadius: 10,
                                border: `1px solid ${borderSubtle}`,
                                background: inputBg,
                                fontSize: 12,
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontWeight: 600, color: textPrimary }}>{displayName}</span>
                                <span style={{ color: textSecondary }}>
                                  Role: {roleLabel} • Support level: {a.primary_support_level || 'L1'}
                                </span>
                                <span style={{ color: textSecondary }}>Products: {productsForAgent}</span>
                              </div>
                              <div />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 18, border: `1px dashed ${borderSubtle}`, borderRadius: 12, fontSize: 12, color: textSecondary }}>
                      {agentFilterProductId ? 'No agents assigned to this product yet.' : selectedPlanId ? 'No agents yet. Click Add agent to invite.' : 'Choose a plan above to add agents.'}
                    </div>
                  );
                })()}
              </>
            )}

            {activeConfig === 'ticket-settings' && (
              <>
                <div style={{ marginBottom: 4, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 3</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>Ticket Settings</h2>
                <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 18px 0' }}>
                  Configure how tickets are created and assigned.
                </p>

                <TicketSettingsInline
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderSubtle={borderSubtle}
                  inputBg={inputBg}
                  accentBrand={accentBrand}
                  onNext={() => setActiveConfig('sla')}
                />
              </>
            )}

            {activeConfig === 'sla' && (
              <>
                <div style={{ marginBottom: 4, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 4</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>SLA Configuration</h2>
                <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 18px 0' }}>
                  Define response and resolution times by priority.
                </p>

                <SlaInline
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderSubtle={borderSubtle}
                  inputBg={inputBg}
                  accentBrand={accentBrand}
                  onNext={() => setActiveConfig('escalation')}
                  products={products}
                  initialTenantProductId={configProductId ?? undefined}
                />
              </>
            )}

            {activeConfig === 'escalation' && (
              <>
                <div style={{ marginBottom: 4, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 5</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>Escalation Rules</h2>
                <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 18px 0' }}>
                  Configure when tickets automatically escalate to higher support levels (L1 → L2 → L3).
                </p>

                <EscalationInline
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderSubtle={borderSubtle}
                  inputBg={inputBg}
                  accentBrand={accentBrand}
                  onNext={() => setActiveConfig('kb')}
                  products={configurationStatus?.products ?? []}
                  initialTenantProductId={configProductId ?? undefined}
                />
              </>
            )}

            {activeConfig === 'kb' && (
              <>
                <div style={{ marginBottom: 4, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 6</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>Knowledge Base</h2>
                <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 18px 0' }}>
                  Manage articles and training sources per tenant-product. Upload docs, crawl URLs, and curate KB
                  articles used by the L0 bot and agent assist.
                </p>

                <KbInline
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderSubtle={borderSubtle}
                  accentBrand={accentBrand}
                  onNext={() => setActiveConfig('ai-bot')}
                  initialTenantProductId={configProductId ?? undefined}
                />
              </>
            )}

            {activeConfig === 'ai-bot' && (
              <>
                <div style={{ marginBottom: 4, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 7</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>AI Bot (L0)</h2>
                <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 18px 0' }}>
                  Select provider/model per tenant-product from super-admin configured models. Choose which LLM powers
                  your bot for each product, balancing quality, latency, and cost.
                </p>

                <AiBotInline
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderSubtle={borderSubtle}
                  inputBg={inputBg}
                  accentBrand={accentBrand}
                  onNext={() => setActiveConfig('channels')}
                  initialTenantProductId={configProductId ?? undefined}
                />
              </>
            )}

            {activeConfig === 'channels' && (
              <>
                <div style={{ marginBottom: 4, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 8</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>Support Channels</h2>
                <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 18px 0' }}>
                  Configure chat widget, hosted webform, and email-to-ticket. Decide how students/users reach you
                  across channels.
                </p>

                <ChannelsInline
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderSubtle={borderSubtle}
                  inputBg={inputBg}
                  accentBrand={accentBrand}
                  products={products}
                  onNext={() => setActiveConfig('branding')}
                />
              </>
            )}

            {activeConfig === 'branding' && (
              <>
                <div style={{ marginBottom: 4, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 9</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>Branding & white-label</h2>
                <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 18px 0' }}>
                  Upload logo, choose colors, and configure your support domain so the portal and widgets look like your
                  brand.
                </p>

                <BrandingInline
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderSubtle={borderSubtle}
                  inputBg={inputBg}
                  accentBrand={accentBrand}
                  onNext={() => setActiveConfig('overview')}
                />
              </>
            )}
          </div>
        )}

        {showPeopleModal && (
          <div
            onClick={() => {
                  if (!agentsSaving) setShowPeopleModal(false);
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
                width: 'min(520px, 96vw)',
                background: bgSurface,
                borderRadius: 16,
                border: `1px solid ${borderSubtle}`,
                padding: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {editingPersonId ? 'Edit person' : 'Add person'}
                  </div>
                  <div style={{ fontSize: 12, color: textSecondary }}>
                    {editingPersonId
                      ? 'Update details for this tenant admin or support agent.'
                      : 'Create a tenant admin or support agent for this workspace.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!agentsSaving) setShowPeopleModal(false);
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

              {agentsError && (
                <div
                  style={{
                    padding: 10,
                    background: 'rgba(239,68,68,0.08)',
                    borderRadius: 10,
                    color: '#ef4444',
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  {agentsError}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fullName = `${peopleFirstName} ${peopleLastName}`.trim();
                  if (!fullName || !agentEmail.trim()) return;
                  if (!editingPersonId && currentPlan) {
                    if (agentRole === 'tenant_admin' && tenantAdminCount >= 1) {
                      setAgentsError('Plan allows only 1 admin. Choose a different role or upgrade plan.');
                      return;
                    }
                    if (agentRole !== 'tenant_admin' && agentLimitReached) {
                      setAgentsError(`Agent limit reached (${currentPlan.max_agents} agents). Upgrade plan to add more.`);
                      return;
                    }
                  }
                  setAgentsError('');
                  setAgentsSaving(true);
                  try {
                    if (editingPersonId) {
                      const token =
                        typeof window !== 'undefined'
                          ? localStorage.getItem('gkt_token')
                          : null;
                      const headers: HeadersInit = { 'Content-Type': 'application/json' };
                      if (token) {
                        (headers as any).Authorization = `Bearer ${token}`;
                      }
                      const resp = await fetch(
                        `${API_BASE}/api/agents/${encodeURIComponent(editingPersonId)}`,
                        {
                          method: 'PATCH',
                          headers,
                          body: JSON.stringify({
                            first_name: peopleFirstName.trim(),
                            last_name: peopleLastName.trim(),
                            email: agentEmail.trim(),
                            role: agentRole,
                            assigned_products:
                              agentRole === 'tenant_admin' ? [] : agentProducts,
                            new_password:
                              peoplePassword.trim().length >= 8 ? peoplePassword.trim() : undefined,
                          }),
                        }
                      );
                      const body = await resp.json().catch(() => ({}));
                      if (!resp.ok) {
                        throw new Error(
                          (body as any)?.error || (body as any)?.message || 'Failed to update person'
                        );
                      }
                    } else {
                      await onboardingApi.inviteAgent({
                        name: fullName,
                        email: agentEmail.trim(),
                        role: agentRole,
                        assigned_products: agentRole === 'tenant_admin' ? [] : agentProducts,
                      });
                    }
                    const list = await onboardingApi.getAgents();
                    setAgents(Array.isArray(list) ? list : []);
                    setPeopleFirstName('');
                    setPeopleLastName('');
                    setAgentEmail('');
                    setAgentProducts([]);
                    setPeoplePassword('');
                    setEditingPersonId(null);
                    setShowPeopleModal(false);
                  } catch (err: any) {
                    setAgentsError(err?.message || (err?.error && String(err.error)) || 'Failed to add person');
                  } finally {
                    setAgentsSaving(false);
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.1fr)',
                      gap: 10,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 600,
                          color: textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        First name
                      </label>
                      <input
                        value={peopleFirstName}
                        onChange={(e) => setPeopleFirstName(e.target.value)}
                        placeholder="Rahul"
                        style={{
                          width: '100%',
                          padding: '9px 10px',
                          borderRadius: 8,
                          border: `1px solid ${borderSubtle}`,
                          background: inputBg,
                          color: textPrimary,
                          fontSize: 13,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 600,
                          color: textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        Last name
                      </label>
                      <input
                        value={peopleLastName}
                        onChange={(e) => setPeopleLastName(e.target.value)}
                        placeholder="Sharma"
                        style={{
                          width: '100%',
                          padding: '9px 10px',
                          borderRadius: 8,
                          border: `1px solid ${borderSubtle}`,
                          background: inputBg,
                          color: textPrimary,
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>

                  {editingPersonId && (
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 600,
                          color: textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        New password (optional)
                      </label>
                      <input
                        type="password"
                        value={peoplePassword}
                        onChange={(e) => setPeoplePassword(e.target.value)}
                        placeholder="Leave blank to keep current password"
                        style={{
                          width: '100%',
                          padding: '9px 10px',
                          borderRadius: 8,
                          border: `1px solid ${borderSubtle}`,
                          background: inputBg,
                          color: textPrimary,
                          fontSize: 13,
                        }}
                      />
                      <p style={{ marginTop: 4, fontSize: 11, color: textSecondary }}>
                        Minimum 8 characters if you choose to change it.
                      </p>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.1fr)',
                      gap: 10,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 600,
                          color: textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        value={agentEmail}
                        onChange={(e) => setAgentEmail(e.target.value)}
                        placeholder="rahul@company.com"
                        style={{
                          width: '100%',
                          padding: '9px 10px',
                          borderRadius: 8,
                          border: `1px solid ${borderSubtle}`,
                          background: inputBg,
                          color: textPrimary,
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.1fr)',
                      gap: 10,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 600,
                          color: textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        Role
                      </label>
                      <select
                        value={agentRole}
                        onChange={(e) => setAgentRole(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 10px',
                          borderRadius: 8,
                          border: `1px solid ${borderSubtle}`,
                          background: inputBg,
                          color: textPrimary,
                          fontSize: 13,
                        }}
                      >
                        {editingPersonId ? (
                          <>
                            <option value="l1_agent">L1 Agent</option>
                            <option value="l2_agent">L2 Agent</option>
                            <option value="l3_agent">L3 Agent</option>
                            <option value="tenant_admin">Admin</option>
                          </>
                        ) : (
                          <>
                            {!agentLimitReached && (
                              <>
                                <option value="l1_agent">L1 Agent</option>
                                <option value="l2_agent">L2 Agent</option>
                                <option value="l3_agent">L3 Agent</option>
                              </>
                            )}
                            {tenantAdminCount < 1 && <option value="tenant_admin">Admin</option>}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {agentRole !== 'tenant_admin' && products.length > 0 && (
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 600,
                          color: textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        Assigned products
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {products.map((p) => (
                          <label
                            key={p.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              cursor: 'pointer',
                              fontSize: 12,
                              color: textSecondary,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={agentProducts.includes(p.id)}
                              onChange={() =>
                                setAgentProducts((prev) =>
                                  prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                                )
                              }
                            />
                            {p.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!agentsSaving) {
                        setShowPeopleModal(false);
                        setPeoplePassword('');
                        setEditingPersonId(null);
                      }
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: `1px solid ${borderSubtle}`,
                      background: 'transparent',
                      color: textSecondary,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      agentsSaving ||
                      !(`${peopleFirstName} ${peopleLastName}`.trim()) ||
                      !agentEmail.trim()
                    }
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: accentBrand,
                      color: '#0B1120',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor:
                        agentsSaving ||
                        !(`${peopleFirstName} ${peopleLastName}`.trim()) ||
                        !agentEmail.trim()
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        agentsSaving ||
                        !(`${peopleFirstName} ${peopleLastName}`.trim()) ||
                        !agentEmail.trim()
                          ? 0.7
                          : 1,
                    }}
                  >
                    {agentsSaving
                      ? editingPersonId
                        ? 'Saving…'
                        : 'Adding…'
                      : editingPersonId
                      ? 'Save changes'
                      : 'Add person'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAddAgentModal && (
          <div
            onClick={() => {
              if (!agentsSaving) setShowAddAgentModal(false);
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
                background: bgSurface,
                borderRadius: 16,
                border: `1px solid ${borderSubtle}`,
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Add agent</div>
                  <div style={{ fontSize: 12, color: textSecondary }}>
                    Invite a team member and assign them to products. Support level is set by role.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { if (!agentsSaving) setShowAddAgentModal(false); }}
                  style={{ border: 'none', background: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: 18 }}
                >
                  ×
                </button>
              </div>
              {agentsError && (
                <div style={{ padding: 10, background: 'rgba(239,68,68,0.08)', borderRadius: 10, color: '#ef4444', marginBottom: 12, fontSize: 12 }}>
                  {agentsError}
                </div>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!agentName.trim() || !agentEmail.trim()) return;
                  setAgentsError('');
                  setAgentsSaving(true);
                  try {
                    await onboardingApi.inviteAgent({
                      name: agentName.trim(),
                      email: agentEmail.trim(),
                      role: agentRole === 'tenant_admin' ? 'tenant_admin' : agentRole === 'l2_agent' ? 'l2_agent' : agentRole === 'l3_agent' ? 'l3_agent' : 'l1_agent',
                      assigned_products: agentRole === 'tenant_admin' ? [] : agentProducts,
                    });
                    const list = await onboardingApi.getAgents();
                    setAgents(Array.isArray(list) ? list : []);
                    setAgentName('');
                    setAgentEmail('');
                    setAgentProducts(agentFilterProductId ? [agentFilterProductId] : []);
                    setShowAddAgentModal(false);
                  } catch (err: any) {
                    setAgentsError(err?.message || (err?.error && String(err.error)) || 'Failed to invite agent');
                  } finally {
                    setAgentsSaving(false);
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>Name</label>
                    <input
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Rahul"
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: `1px solid ${borderSubtle}`, background: inputBg, color: textPrimary, fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>Email</label>
                    <input
                      type="email"
                      value={agentEmail}
                      onChange={(e) => setAgentEmail(e.target.value)}
                      placeholder="rahul@company.com"
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: `1px solid ${borderSubtle}`, background: inputBg, color: textPrimary, fontSize: 13 }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>Role</label>
                  <select
                    value={agentRole}
                    onChange={(e) => setAgentRole(e.target.value)}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: `1px solid ${borderSubtle}`, background: inputBg, color: textPrimary, fontSize: 13 }}
                  >
                    <option value="l1_agent">L1 Agent</option>
                    <option value="l2_agent">L2 Agent</option>
                    <option value="l3_agent">L3 Agent</option>
                    <option value="tenant_admin">Admin</option>
                  </select>
                </div>
                {agentRole !== 'tenant_admin' && products.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>Assigned products</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {products.map((p) => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: textSecondary }}>
                          <input
                            type="checkbox"
                            checked={agentProducts.includes(p.id)}
                            onChange={() => setAgentProducts((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={agentsSaving || !agentName.trim() || !agentEmail.trim()}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    background: accentBrand,
                    color: '#0B1120',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: agentsSaving ? 'not-allowed' : 'pointer',
                    opacity: agentsSaving ? 0.8 : 1,
                    alignSelf: 'flex-start',
                  }}
                >
                  {agentsSaving ? 'Inviting…' : 'Invite agent'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showResetAgentPasswordModal && (
          <div
            onClick={() => {
              if (!agentsSaving) setShowResetAgentPasswordModal(false);
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
                width: 'min(520px, 96vw)',
                background: bgSurface,
                borderRadius: 16,
                border: `1px solid ${borderSubtle}`,
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Reset agent password</div>
                  <div style={{ fontSize: 12, color: textSecondary }}>
                    Agent: {resetAgentLabel || resetAgentId || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!agentsSaving) setShowResetAgentPasswordModal(false);
                  }}
                  style={{ border: 'none', background: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: 18 }}
                >
                  ×
                </button>
              </div>

              {agentsError && (
                <div style={{ padding: 10, background: 'rgba(239,68,68,0.08)', borderRadius: 10, color: '#ef4444', marginBottom: 12, fontSize: 12 }}>
                  {agentsError}
                </div>
              )}
              {resetAgentInfo && (
                <div style={{ padding: 10, background: 'rgba(34,197,94,0.12)', borderRadius: 10, color: '#4ADE80', marginBottom: 12, fontSize: 12 }}>
                  {resetAgentInfo}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!resetAgentId) return;
                  if (resetAgentPassword.trim().length < 8) {
                    setAgentsError('Password must be at least 8 characters');
                    return;
                  }
                  setAgentsError('');
                  setResetAgentInfo('');
                  setAgentsSaving(true);
                  try {
                    await onboardingApi.setAgentPassword(resetAgentId, resetAgentPassword.trim());
                    setResetAgentInfo('Password updated. Agent can log in now.');
                  } catch (err: any) {
                    setAgentsError(err?.message || (err?.error && String(err.error)) || 'Failed to update password');
                  } finally {
                    setAgentsSaving(false);
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>
                    New password
                  </label>
                  <input
                    type="password"
                    value={resetAgentPassword}
                    onChange={(e) => setResetAgentPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: `1px solid ${borderSubtle}`, background: inputBg, color: textPrimary, fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!agentsSaving) setShowResetAgentPasswordModal(false);
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: `1px solid ${borderSubtle}`,
                      background: 'transparent',
                      color: textPrimary,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={agentsSaving || resetAgentPassword.trim().length < 8}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: accentBrand,
                      color: '#0B1120',
                      cursor: agentsSaving ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 800,
                      opacity: agentsSaving || resetAgentPassword.trim().length < 8 ? 0.7 : 1,
                    }}
                  >
                    {agentsSaving ? 'Updating…' : 'Update password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showProductModal && (
          <div
            onClick={() => {
              if (!productsSaving) setShowProductModal(false);
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
                background: bgSurface,
                borderRadius: 16,
                border: `1px solid ${borderSubtle}`,
                padding: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Add product</div>
                  <div style={{ fontSize: 12, color: textSecondary }}>
                    Create a product or service for this tenant workspace.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!productsSaving) setShowProductModal(false);
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

              {productsError && (
                <div
                  style={{
                    padding: 10,
                    background: 'rgba(239,68,68,0.08)',
                    borderRadius: 10,
                    color: '#ef4444',
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  {productsError}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!productName.trim()) return;
                  setProductsError('');
                  setProductsSaving(true);
                  try {
                    await onboardingApi.createProduct({
                      name: productName.trim(),
                      description: productDescription.trim() || undefined,
                      website: productWebsite.trim() || undefined,
                    });
                    const refreshed = (await onboardingApi.getProducts()) as TenantProduct[];
                    setProducts(refreshed);
                    setProductName('');
                    setProductDescription('');
                    setProductWebsite('');
                    setShowProductModal(false);
                  } catch {
                    setProductsError('Failed to add product');
                  } finally {
                    setProductsSaving(false);
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      Product name
                    </label>
                    <input
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Rewire AI"
                      style={{
                        width: '100%',
                        padding: '9px 10px',
                        borderRadius: 8,
                        border: `1px solid ${borderSubtle}`,
                        background: inputBg,
                        color: textPrimary,
                        fontSize: 13,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      Description (optional)
                    </label>
                    <input
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                      placeholder="Short description"
                      style={{
                        width: '100%',
                        padding: '9px 10px',
                        borderRadius: 8,
                        border: `1px solid ${borderSubtle}`,
                        background: inputBg,
                        color: textPrimary,
                        fontSize: 13,
                      }}
                    />
                  </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    Website (optional)
                  </label>
                  <input
                    value={productWebsite}
                    onChange={(e) => setProductWebsite(e.target.value)}
                    placeholder="https://example.edu/product"
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 8,
                      border: `1px solid ${borderSubtle}`,
                      background: inputBg,
                      color: textPrimary,
                      fontSize: 13,
                    }}
                  />
                </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!productsSaving) setShowProductModal(false);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: `1px solid ${borderSubtle}`,
                      background: 'transparent',
                      color: textSecondary,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={productsSaving || !productName.trim()}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: accentBrand,
                      color: '#0B1120',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: productsSaving || !productName.trim() ? 'not-allowed' : 'pointer',
                      opacity: productsSaving || !productName.trim() ? 0.7 : 1,
                    }}
                  >
                    {productsSaving ? 'Adding…' : 'Add product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPlansModal && (
          <div
            onClick={() => setShowPlansModal(false)}
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
                width: 'min(800px, 96vw)',
                maxHeight: '80vh',
                background: bgSurface,
                borderRadius: 18,
                border: `1px solid ${borderSubtle}`,
                padding: 18,
                overflow: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Workspace plans</div>
                  <div style={{ fontSize: 12, color: textSecondary }}>
                    Choose a plan below. Your current plan is highlighted. Click &quot;Select plan&quot; to switch.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlansModal(false)}
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

              {plansError && (
                <div
                  style={{
                    padding: 10,
                    background: 'rgba(239,68,68,0.08)',
                    borderRadius: 10,
                    color: '#ef4444',
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  {plansError}
                </div>
              )}

              {plansLoading ? (
                <div style={{ fontSize: 13, color: textSecondary }}>Loading plans…</div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                  }}
                >
                  {plans.map((plan) => {
                    const isSelected = plan.id === selectedPlanId;
                    const price = Number(plan.price_usd);
                    const isUnlimited =
                      plan.max_agents === -1 || plan.max_tickets_per_month === -1;
                    return (
                      <div
                        key={plan.id}
                        style={{
                          borderRadius: 14,
                          border: isSelected
                            ? `2px solid ${accentBrandBorder}`
                            : `1px solid ${borderSubtle}`,
                          background: isSelected
                            ? accentBrandSoft
                            : isDark
                            ? '#020617'
                            : '#FFFFFF',
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{plan.name}</div>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>
                          {isNaN(price) ? '—' : `$${price}`}{' '}
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: textSecondary,
                            }}
                          >
                            /mo
                          </span>
                        </div>
                        <ul
                          style={{
                            listStyle: 'none',
                            margin: '4px 0 0',
                            padding: 0,
                            fontSize: 12,
                            color: textSecondary,
                          }}
                        >
                          <li>
                            {isUnlimited
                              ? 'Unlimited agents & tickets'
                              : `${plan.max_agents === -1 ? 'Unlimited' : plan.max_agents} agents`}
                          </li>
                          {plan.max_tickets_per_month !== -1 && (
                            <li>
                              {plan.max_tickets_per_month.toLocaleString()} tickets per month
                            </li>
                          )}
                        </ul>
                        {isSelected ? (
                          <div
                            style={{
                              marginTop: 'auto',
                              paddingTop: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              color: accentChipText,
                              background: accentChipBg,
                              borderRadius: 999,
                              padding: '6px 10px',
                              alignSelf: 'flex-start',
                            }}
                          >
                            Current plan
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={plansSaving}
                            onClick={async () => {
                              setPlansError('');
                              setPlansSaving(true);
                              try {
                                const res = await billingApi.createOrder(plan.id);
                                const { order_id, amount, currency, key_id } = res.data;

                                const options = {
                                  key: key_id,
                                  amount,
                                  currency,
                                  name: 'GKT Ticketing',
                                  description: `Subscribe to ${plan.name}`,
                                  order_id,
                                  handler: async (response: any) => {
                                    try {
                                      const verifyRes = await billingApi.verifyPayment({
                                        razorpay_order_id: response.razorpay_order_id,
                                        razorpay_payment_id: response.razorpay_payment_id,
                                        razorpay_signature: response.razorpay_signature,
                                        plan_id: plan.id,
                                      });
                                      setSelectedPlanId(plan.id);
                                      setShowPlansModal(false);
                                      setPaymentReceipt(verifyRes.data?.transaction ?? {
                                        payment_id: response.razorpay_payment_id,
                                        order_id: response.razorpay_order_id,
                                        plan_name: plan.name,
                                        amount_inr: Math.round(amount / 100),
                                        paid_at: new Date().toISOString(),
                                        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                                      });
                                    } catch {
                                      setPlansError('Payment succeeded but activation failed. Contact support.');
                                    } finally {
                                      setPlansSaving(false);
                                    }
                                  },
                                  modal: {
                                    ondismiss: () => {
                                      setPlansSaving(false);
                                    },
                                  },
                                  theme: { color: accentBrand },
                                };

                                const RazorpayCheckout = (window as any).Razorpay;
                                if (!RazorpayCheckout) {
                                  setPlansError('Payment gateway failed to load. Please refresh and try again.');
                                  setPlansSaving(false);
                                  return;
                                }
                                const rzp = new RazorpayCheckout(options);
                                rzp.on('payment.failed', (response: any) => {
                                  setPlansError(response?.error?.description || 'Payment failed. Please try again.');
                                  setPlansSaving(false);
                                });
                                rzp.open();
                              } catch (err: any) {
                                const msg =
                                  err?.response?.data?.error ||
                                  err?.message ||
                                  'Failed to initiate payment';
                                setPlansError(msg);
                                setPlansSaving(false);
                              }
                            }}
                            style={{
                              marginTop: 'auto',
                              paddingTop: 8,
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 10,
                              border: 'none',
                              background: accentBrand,
                              color: '#0B1120',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: plansSaving ? 'not-allowed' : 'pointer',
                              opacity: plansSaving ? 0.8 : 1,
                            }}
                          >
                            {plansSaving ? 'Opening payment…' : 'Select plan'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {paymentReceipt && (
          <div
            onClick={() => setPaymentReceipt(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: isDark ? '#0f172a' : '#ffffff',
                border: `1px solid ${borderSubtle}`,
                borderRadius: 20,
                padding: '32px 28px',
                width: '100%',
                maxWidth: 420,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(34,197,94,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                  }}
                >
                  ✓
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary }}>Payment Successful</div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'rgba(34,197,94,0.12)',
                    color: '#22c55e',
                    letterSpacing: 0.5,
                  }}
                >
                  PAID
                </div>
              </div>

              {/* Amount */}
              <div
                style={{
                  textAlign: 'center',
                  marginBottom: 24,
                  padding: '16px 0',
                  borderTop: `1px solid ${borderSubtle}`,
                  borderBottom: `1px solid ${borderSubtle}`,
                }}
              >
                <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4 }}>Amount Paid</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: textPrimary }}>
                  ₹{paymentReceipt.amount_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>INR</div>
              </div>

              {/* Details rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
                {[
                  {
                    label: 'Plan',
                    value: paymentReceipt.plan_name,
                    highlight: true,
                  },
                  {
                    label: 'Date & Time',
                    value: new Date(paymentReceipt.paid_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  },
                  {
                    label: 'Valid Until',
                    value: new Date(paymentReceipt.valid_until).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    }),
                  },
                  {
                    label: 'Payment ID',
                    value: paymentReceipt.payment_id,
                    mono: true,
                  },
                  {
                    label: 'Order ID',
                    value: paymentReceipt.order_id,
                    mono: true,
                  },
                  {
                    label: 'Payment Method',
                    value: 'Razorpay',
                  },
                ].map(({ label, value, highlight, mono }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 12, color: textSecondary, flexShrink: 0 }}>{label}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: highlight ? 700 : 500,
                        color: highlight ? accentBrand : textPrimary,
                        fontFamily: mono ? 'monospace' : undefined,
                        wordBreak: 'break-all',
                        textAlign: 'right',
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setPaymentReceipt(null)}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: accentBrand,
                  color: '#0B1120',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
