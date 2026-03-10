'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { superAdminApi } from '@/lib/api/super-admin.api';

const USD_TO_INR = 85;

function toInr(usd: number) { return Math.round(usd * USD_TO_INR * 100) / 100; }
function toUsd(inr: number) { return Math.round((inr / USD_TO_INR) * 100) / 100; }
function clamp0(v: number) { return Math.max(0, v); }

const emptyForm = () => ({
  name: '', max_agents: 0, max_tickets_per_month: 0,
  price_usd: 0, price_inr: 0,
  overage_per_ticket_usd: 0, overage_per_ticket_inr: 0,
});

export default function BillingPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [form, setForm] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    try { const res = await superAdminApi.getPlans(); setPlans(res.data); }
    catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchPlans(); }, []);

  const isDark = mounted && theme === 'dark';
  const textPrimary = isDark ? '#F8FAFC' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const surfaceBg = isDark ? '#1E293B' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';
  const inputBg = isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF';
  const accentBrand = '#FACC15';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary,
    fontSize: '14px', fontFamily: 'inherit', outline: 'none',
  };

  // ── Currency auto-conversion helpers for Create form ──
  const setCreateUsd = (field: 'price_usd' | 'overage_per_ticket_usd', val: number) => {
    val = clamp0(val);
    const inrField = field === 'price_usd' ? 'price_inr' : 'overage_per_ticket_inr';
    setForm(f => ({ ...f, [field]: val, [inrField]: toInr(val) }));
  };
  const setCreateInr = (field: 'price_inr' | 'overage_per_ticket_inr', val: number) => {
    val = clamp0(val);
    const usdField = field === 'price_inr' ? 'price_usd' : 'overage_per_ticket_usd';
    setForm(f => ({ ...f, [field]: val, [usdField]: toUsd(val) }));
  };

  // ── Currency auto-conversion helpers for Edit form ──
  const setEditUsd = (field: 'price_usd' | 'overage_per_ticket_usd', val: number) => {
    val = clamp0(val);
    const inrField = field === 'price_usd' ? 'price_inr' : 'overage_per_ticket_inr';
    setEditForm((f: any) => ({ ...f, [field]: val, [inrField]: toInr(val) }));
  };
  const setEditInr = (field: 'price_inr' | 'overage_per_ticket_inr', val: number) => {
    val = clamp0(val);
    const usdField = field === 'price_inr' ? 'price_usd' : 'overage_per_ticket_usd';
    setEditForm((f: any) => ({ ...f, [field]: val, [usdField]: toUsd(val) }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await superAdminApi.createPlan({ ...form, features: {} });
      setShowCreateModal(false);
      setForm(emptyForm());
      fetchPlans();
    } catch (err) { console.error(err); }
    finally { setIsSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !editForm) return;
    setIsSaving(true);
    try {
      await superAdminApi.updatePlan(editingPlan.id, editForm);
      setEditingPlan(null);
      setEditForm(null);
      fetchPlans();
    } catch (err) { console.error(err); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await superAdminApi.deletePlan(id);
      setConfirmDelete(null);
      fetchPlans();
    } catch (err) { console.error(err); }
  };

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      max_agents: plan.max_agents,
      max_tickets_per_month: plan.max_tickets_per_month,
      price_usd: Number(plan.price_usd),
      price_inr: Number(plan.price_inr),
      overage_per_ticket_usd: Number(plan.overage_per_ticket_usd),
      overage_per_ticket_inr: Number(plan.overage_per_ticket_inr),
    });
  };

  // ── Live duplicate name check (against active plans already loaded) ──
  const getNameError = (name: string, excludeId?: string): string => {
    if (!name.trim()) return '';
    const duplicate = plans.find(
      (p: any) => p.is_active && p.name.toLowerCase().trim() === name.toLowerCase().trim() && p.id !== excludeId
    );
    return duplicate ? `A plan named "${duplicate.name}" already exists` : '';
  };

  const createNameError = getNameError(form.name);
  const editNameError = editForm ? getNameError(editForm.name, editingPlan?.id) : '';

  if (!mounted) return null;

  const modalOverlay: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  };

  const renderForm = (
    values: any,
    onUsd: (field: any, val: number) => void,
    onInr: (field: any, val: number) => void,
    setValues: (fn: (prev: any) => any) => void,
    onSubmit: (e: React.FormEvent) => void,
    submitLabel: string,
    onCancel: () => void,
    nameError: string,
  ) => {
    const hasNameError = nameError.length > 0;
    return (
    <form onSubmit={e => { if (hasNameError) { e.preventDefault(); return; } onSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Plan Name</label>
        <input style={{ ...inputStyle, borderColor: hasNameError ? '#EF4444' : borderColor }} value={values.name} onChange={e => setValues(f => ({ ...f, name: e.target.value }))} required placeholder="Starter" />
        {hasNameError && <p style={{ color: '#EF4444', fontSize: '12px', fontWeight: 500, margin: '6px 0 0' }}>⚠️ {nameError}</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Max Agents</label>
          <input type="number" min="0" style={inputStyle} value={values.max_agents} onChange={e => setValues(f => ({ ...f, max_agents: clamp0(Number(e.target.value)) }))} required />
        </div>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Max Tickets/mo</label>
          <input type="number" min="0" style={inputStyle} value={values.max_tickets_per_month} onChange={e => setValues(f => ({ ...f, max_tickets_per_month: clamp0(Number(e.target.value)) }))} required />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Price (USD/mo)</label>
          <input type="number" min="0" step="0.01" style={inputStyle} value={values.price_usd} onChange={e => onUsd('price_usd', Number(e.target.value))} required />
        </div>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Price (INR/mo) <span style={{ color: isDark ? '#60A5FA' : '#2563EB', fontSize: '11px' }}>auto</span></label>
          <input type="number" min="0" step="0.01" style={inputStyle} value={values.price_inr} onChange={e => onInr('price_inr', Number(e.target.value))} required />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Overage (USD)</label>
          <input type="number" min="0" step="0.01" style={inputStyle} value={values.overage_per_ticket_usd} onChange={e => onUsd('overage_per_ticket_usd', Number(e.target.value))} />
        </div>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Overage (INR) <span style={{ color: isDark ? '#60A5FA' : '#2563EB', fontSize: '11px' }}>auto</span></label>
          <input type="number" min="0" step="0.01" style={inputStyle} value={values.overage_per_ticket_inr} onChange={e => onInr('overage_per_ticket_inr', Number(e.target.value))} />
        </div>
      </div>
      <p style={{ fontSize: '11px', color: textSecondary, fontStyle: 'italic', margin: 0 }}>💱 Exchange rate: 1 USD = {USD_TO_INR} INR. Editing one currency auto-fills the other.</p>
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Cancel</button>
        <button type="submit" disabled={isSaving || hasNameError} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: hasNameError ? (isDark ? '#374151' : '#D1D5DB') : accentBrand, color: hasNameError ? textSecondary : '#000', border: 'none', cursor: (isSaving || hasNameError) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700, opacity: isSaving ? 0.8 : 1 }}>{isSaving ? 'Saving...' : submitLabel}</button>
      </div>
    </form>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: textPrimary, marginBottom: '4px' }}>Billing Plans</h1>
          <p style={{ fontSize: '14px', color: textSecondary }}>Create, edit, and manage subscription plans for products</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={{
          padding: '10px 20px', background: accentBrand, color: '#000', borderRadius: '8px',
          fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
        }}>
          + Create Plan
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: textSecondary }}>Loading plans...</div>
      ) : plans.length === 0 ? (
        <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
          <p style={{ fontSize: '20px', fontWeight: 700, color: textPrimary, marginBottom: '8px' }}>No billing plans</p>
          <p style={{ fontSize: '14px', color: textSecondary, marginBottom: '24px' }}>Create a billing plan to assign to products</p>
          <button onClick={() => setShowCreateModal(true)} style={{ padding: '12px 24px', background: accentBrand, color: '#000', borderRadius: '8px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer' }}>+ Create Your First Plan</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {plans.map((plan: any) => (
            <div key={plan.id} style={{
              background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '12px',
              padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: accentBrand }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: textPrimary, margin: 0 }}>{plan.name}</h3>
                <span style={{
                  padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                  background: plan.is_active ? (isDark ? 'rgba(34,197,94,0.1)' : '#DCFCE7') : (isDark ? 'rgba(239,68,68,0.1)' : '#FEE2E2'),
                  color: plan.is_active ? (isDark ? '#4ADE80' : '#15803D') : (isDark ? '#F87171' : '#DC2626'),
                }}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p style={{ fontSize: '36px', fontWeight: 800, color: accentBrand, marginBottom: '2px' }}>
                ${Number(plan.price_usd)}<span style={{ fontSize: '14px', fontWeight: 500, color: textSecondary }}>/mo</span>
              </p>
              <p style={{ fontSize: '13px', color: textSecondary, marginBottom: '20px' }}>₹{Number(plan.price_inr)}/mo</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Max Agents', value: plan.max_agents },
                  { label: 'Max Tickets/mo', value: plan.max_tickets_per_month.toLocaleString() },
                  { label: 'Overage / ticket', value: `$${Number(plan.overage_per_ticket_usd)} / ₹${Number(plan.overage_per_ticket_inr)}` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: textSecondary }}>{row.label}</span>
                    <span style={{ color: textPrimary, fontWeight: 600 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: `1px solid ${borderColor}`, paddingTop: '16px' }}>
                <button onClick={() => openEdit(plan)} style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${borderColor}`,
                  background: 'transparent', color: textPrimary, cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                }}>
                  ✏️ Edit
                </button>
                <button onClick={() => setConfirmDelete(plan.id)} style={{
                  padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                  background: 'transparent', color: '#EF4444', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                }}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div style={modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: textPrimary, marginBottom: '24px' }}>Create Billing Plan</h2>
            {renderForm(form, setCreateUsd, setCreateInr, setForm, handleCreate, 'Create Plan', () => setShowCreateModal(false), createNameError)}
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && editForm && (
        <div style={modalOverlay} onClick={() => { setEditingPlan(null); setEditForm(null); }}>
          <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: textPrimary, marginBottom: '4px' }}>Edit: {editingPlan.name}</h2>
            <p style={{ fontSize: '12px', color: textSecondary, marginBottom: '24px' }}>All fields are editable. Changes save to the database.</p>
            {renderForm(editForm, setEditUsd, setEditInr, setEditForm, handleEdit, 'Save Changes', () => { setEditingPlan(null); setEditForm(null); }, editNameError)}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: textPrimary, marginBottom: '8px' }}>Delete this plan?</h2>
            <p style={{ fontSize: '14px', color: textSecondary, marginBottom: '24px' }}>The plan will be deactivated and hidden from new products. Existing products on this plan will not be affected.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
