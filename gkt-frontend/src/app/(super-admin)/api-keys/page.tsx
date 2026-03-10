'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import apiClient from '@/lib/api/client';

interface AiProvider {
  id: string;
  product_id: string | null;
  provider_name: string;
  enabled: boolean;
  available_models: string[];
  default_model: string | null;
  custom_base_url: string | null;
  created_at: string;
}

const BUILTIN_PROVIDERS = [
  { name: 'openai', label: 'OpenAI', icon: '🤖', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { name: 'anthropic', label: 'Anthropic', icon: '🧠', models: ['claude-3.5-sonnet', 'claude-3-haiku', 'claude-3-opus'] },
  { name: 'google', label: 'Google Gemini', icon: '💎', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'] },
  { name: 'groq', label: 'Groq', icon: '⚡', models: ['llama-3.1-70b', 'llama-3.1-8b', 'mixtral-8x7b'] },
];

export default function ApiKeysPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [configModal, setConfigModal] = useState<{ providerName: string; label: string; icon: string; models: string[]; isCustom: boolean } | null>(null);
  const [addCustomModal, setAddCustomModal] = useState(false);
  const [configForm, setConfigForm] = useState({ api_key: '', default_model: '', custom_base_url: '', selected_models: [] as string[] });
  const [customForm, setCustomForm] = useState({ provider_name: '', label: '', api_key: '', models: '', default_model: '', custom_base_url: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/admin/ai-providers');
      setProviders(res.data || []);
    } catch { setProviders([]); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchProviders(); }, []);

  const isDark = mounted && theme === 'dark';
  const textPrimary = isDark ? '#F8FAFC' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const surfaceBg = isDark ? '#1E293B' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';
  const inputBg = isDark ? '#0F172A' : '#FFFFFF';
  const accentBrand = '#FACC15';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary,
    fontSize: '14px', fontFamily: 'inherit', outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
  };

  // Open configure modal for a builtin provider
  const openConfigModal = (providerDef: typeof BUILTIN_PROVIDERS[0]) => {
    const existing = providers.find(p => p.provider_name === providerDef.name);
    setConfigModal({
      providerName: providerDef.name,
      label: providerDef.label,
      icon: providerDef.icon,
      models: providerDef.models,
      isCustom: false,
    });
    setConfigForm({
      api_key: '',
      default_model: existing?.default_model || providerDef.models[0],
      custom_base_url: existing?.custom_base_url || '',
      selected_models: existing?.available_models || [...providerDef.models],
    });
  };

  const handleConfigSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configModal) return;
    setIsSaving(true);
    try {
      const existing = providers.find(p => p.provider_name === configModal.providerName);
      if (existing) {
        await apiClient.patch(`/api/admin/ai-providers/${existing.id}`, {
          api_key_encrypted: configForm.api_key || undefined,
          default_model: configForm.default_model,
          available_models: configForm.selected_models,
          custom_base_url: configForm.custom_base_url || null,
          enabled: true,
        });
      } else {
        await apiClient.post('/api/admin/ai-providers', {
          provider_name: configModal.providerName,
          api_key_encrypted: configForm.api_key,
          default_model: configForm.default_model,
          available_models: configForm.selected_models,
          custom_base_url: configForm.custom_base_url || null,
          enabled: true,
          created_by: 'super_admin',
        });
      }
      setConfigModal(null);
      fetchProviders();
    } catch (err) { console.error(err); }
    finally { setIsSaving(false); }
  };

  const handleCustomSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const modelList = customForm.models.split(',').map(m => m.trim()).filter(Boolean);
      await apiClient.post('/api/admin/ai-providers', {
        provider_name: customForm.provider_name.toLowerCase().replace(/\s+/g, '_'),
        api_key_encrypted: customForm.api_key,
        default_model: customForm.default_model || modelList[0] || null,
        available_models: modelList,
        custom_base_url: customForm.custom_base_url || null,
        enabled: true,
        created_by: 'super_admin',
      });
      setAddCustomModal(false);
      setCustomForm({ provider_name: '', label: '', api_key: '', models: '', default_model: '', custom_base_url: '' });
      fetchProviders();
    } catch (err) { console.error(err); }
    finally { setIsSaving(false); }
  };

  const toggleModel = (model: string) => {
    setConfigForm(prev => {
      const has = prev.selected_models.includes(model);
      const next = has ? prev.selected_models.filter(m => m !== model) : [...prev.selected_models, model];
      // If default was removed, reset default
      const newDefault = next.includes(prev.default_model) ? prev.default_model : (next[0] || '');
      return { ...prev, selected_models: next, default_model: newDefault };
    });
  };

  if (!mounted) return null;

  const modalOverlay: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  };

  // Find custom providers (configured but not in builtin list)
  const builtinNames = BUILTIN_PROVIDERS.map(p => p.name);
  const customProviders = providers.filter(p => !builtinNames.includes(p.provider_name));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: textPrimary, marginBottom: '4px' }}>LLM API Keys</h1>
          <p style={{ fontSize: '14px', color: textSecondary }}>Configure AI provider keys for platform-wide AI features</p>
        </div>
        <button onClick={() => setAddCustomModal(true)} style={{
          padding: '10px 20px', background: accentBrand, color: '#000', borderRadius: '8px',
          fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
        }}>
          + Add Custom Provider
        </button>
      </div>

      {/* Builtin Provider Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {BUILTIN_PROVIDERS.map(provider => {
          const configured = providers.find(p => p.provider_name === provider.name);
          return (
            <div
              key={provider.name}
              onClick={() => openConfigModal(provider)}
              style={{
                background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '12px',
                padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentBrand; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: configured?.enabled ? '#22C55E' : (isDark ? 'rgba(255,255,255,0.05)' : '#E5E7EB') }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '28px' }}>{provider.icon}</span>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>{provider.label}</h3>
                    <p style={{ fontSize: '12px', color: textSecondary, margin: 0 }}>{provider.models.length} models</p>
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                  background: configured?.enabled ? (isDark ? 'rgba(34,197,94,0.1)' : '#DCFCE7') : (isDark ? 'rgba(234,179,8,0.1)' : '#FEF9C3'),
                  color: configured?.enabled ? (isDark ? '#4ADE80' : '#15803D') : (isDark ? '#FBBF24' : '#A16207'),
                }}>
                  {configured?.enabled ? 'Active' : 'Not Configured'}
                </span>
              </div>

              {configured ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: textSecondary }}>Default Model</span>
                    <span style={{ color: textPrimary, fontWeight: 600, fontFamily: 'monospace', fontSize: '12px' }}>{configured.default_model || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: textSecondary }}>API Key</span>
                    <span style={{ color: textPrimary, fontWeight: 600 }}>••••••••</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: textSecondary }}>Models Enabled</span>
                    <span style={{ color: textPrimary, fontWeight: 600 }}>{configured.available_models?.length || 0}</span>
                  </div>
                  {/* Model tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {(configured.available_models || []).map((m: string) => (
                      <span key={m} style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, fontFamily: 'monospace',
                        background: m === configured.default_model ? accentBrand : (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                        color: m === configured.default_model ? '#000' : textSecondary,
                      }}>
                        {m}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: '11px', color: isDark ? '#60A5FA' : '#2563EB', margin: '8px 0 0', fontWeight: 500 }}>Click to update configuration →</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: textSecondary, marginBottom: '8px' }}>
                    Click to configure this AI provider
                  </p>
                  <p style={{ fontSize: '11px', color: isDark ? '#60A5FA' : '#2563EB', fontWeight: 500 }}>Click to set up →</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Providers */}
      {customProviders.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, marginBottom: '16px' }}>Custom Providers</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {customProviders.map(cp => (
              <div key={cp.id} style={{
                background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '12px',
                padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: cp.enabled ? '#22C55E' : '#EF4444' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>🔧 {cp.provider_name}</h3>
                    <p style={{ fontSize: '12px', color: textSecondary, margin: 0 }}>{cp.available_models?.length || 0} models</p>
                  </div>
                  <span style={{
                    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                    background: cp.enabled ? (isDark ? 'rgba(34,197,94,0.1)' : '#DCFCE7') : (isDark ? 'rgba(239,68,68,0.1)' : '#FEE2E2'),
                    color: cp.enabled ? (isDark ? '#4ADE80' : '#15803D') : '#EF4444',
                  }}>
                    {cp.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: textSecondary }}>Default</span>
                    <span style={{ color: textPrimary, fontWeight: 600, fontFamily: 'monospace', fontSize: '12px' }}>{cp.default_model || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: textSecondary }}>API Key</span>
                    <span style={{ color: textPrimary, fontWeight: 600 }}>••••••••</span>
                  </div>
                  {cp.custom_base_url && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: textSecondary }}>Base URL</span>
                      <span style={{ color: textPrimary, fontWeight: 500, fontSize: '11px', fontFamily: 'monospace' }}>{cp.custom_base_url}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                  {(cp.available_models || []).map((m: string) => (
                    <span key={m} style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, fontFamily: 'monospace',
                      background: m === cp.default_model ? accentBrand : (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                      color: m === cp.default_model ? '#000' : textSecondary,
                    }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Models Reference */}
      <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, marginBottom: '16px' }}>Available Models Reference</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {BUILTIN_PROVIDERS.map(provider => (
            <div key={provider.name} style={{ padding: '14px', background: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderRadius: '8px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: textPrimary, marginBottom: '8px' }}>{provider.icon} {provider.label}</p>
              {provider.models.map(m => (
                <p key={m} style={{ fontSize: '12px', color: textSecondary, margin: '3px 0', fontFamily: 'monospace' }}>• {m}</p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Configure Builtin Provider Modal */}
      {configModal && (
        <div style={modalOverlay} onClick={() => setConfigModal(null)}>
          <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '28px' }}>{configModal.icon}</span>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: textPrimary, margin: 0 }}>Configure {configModal.label}</h2>
                <p style={{ fontSize: '13px', color: textSecondary, margin: 0 }}>
                  {providers.find(p => p.provider_name === configModal.providerName) ? 'Update existing configuration' : 'Set up new provider'}
                </p>
              </div>
            </div>

            <form onSubmit={handleConfigSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>
                  API Key {providers.find(p => p.provider_name === configModal.providerName) && <span style={{ color: isDark ? '#60A5FA' : '#2563EB', fontSize: '11px' }}>(leave blank to keep current)</span>}
                </label>
                <input type="password" style={inputStyle} value={configForm.api_key} onChange={e => setConfigForm(f => ({ ...f, api_key: e.target.value }))}
                  required={!providers.find(p => p.provider_name === configModal.providerName)}
                  placeholder="sk-..." />
              </div>

              {/* Model Multi-select */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '8px', display: 'block' }}>Enabled Models</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: isDark ? 'rgba(255,255,255,0.02)' : '#F9FAFB', padding: '12px', borderRadius: '8px', border: `1px solid ${borderColor}` }}>
                  {configModal.models.map(model => {
                    const isSelected = configForm.selected_models.includes(model);
                    return (
                      <label key={model} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px', transition: 'background 0.15s', background: isSelected ? (isDark ? 'rgba(250,204,21,0.08)' : '#FEF9C3') : 'transparent' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleModel(model)}
                          style={{ accentColor: accentBrand, width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: isSelected ? 600 : 400, color: isSelected ? textPrimary : textSecondary }}>{model}</span>
                        {model === configForm.default_model && (
                          <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, background: accentBrand, color: '#000', marginLeft: 'auto' }}>DEFAULT</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {configForm.selected_models.length === 0 && (
                  <p style={{ color: '#EF4444', fontSize: '12px', fontWeight: 500, margin: '6px 0 0' }}>⚠️ Select at least one model</p>
                )}
              </div>

              {/* Default Model */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Default Model</label>
                <select style={selectStyle} value={configForm.default_model} onChange={e => setConfigForm(f => ({ ...f, default_model: e.target.value }))}>
                  {configForm.selected_models.map(m => <option key={m} value={m} style={{ background: inputBg, color: textPrimary }}>{m}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Custom Base URL (optional)</label>
                <input style={inputStyle} value={configForm.custom_base_url} onChange={e => setConfigForm(f => ({ ...f, custom_base_url: e.target.value }))} placeholder="https://api.openai.com/v1" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setConfigModal(null)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={isSaving || configForm.selected_models.length === 0} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: configForm.selected_models.length === 0 ? (isDark ? '#374151' : '#D1D5DB') : accentBrand, color: configForm.selected_models.length === 0 ? textSecondary : '#000', border: 'none', cursor: (isSaving || configForm.selected_models.length === 0) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700, opacity: isSaving ? 0.8 : 1 }}>
                  {isSaving ? 'Saving...' : (providers.find(p => p.provider_name === configModal.providerName) ? 'Update Provider' : 'Configure Provider')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Provider Modal */}
      {addCustomModal && (
        <div style={modalOverlay} onClick={() => setAddCustomModal(false)}>
          <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: textPrimary, marginBottom: '4px' }}>Add Custom Provider</h2>
            <p style={{ fontSize: '13px', color: textSecondary, marginBottom: '24px' }}>Add a provider not in the built-in list (e.g., Mistral, Cohere, Together AI)</p>

            <form onSubmit={handleCustomSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Provider Name</label>
                <input style={inputStyle} value={customForm.provider_name} onChange={e => setCustomForm(f => ({ ...f, provider_name: e.target.value }))} required placeholder="mistral" />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>API Key</label>
                <input type="password" style={inputStyle} value={customForm.api_key} onChange={e => setCustomForm(f => ({ ...f, api_key: e.target.value }))} required placeholder="sk-..." />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Models (comma-separated)</label>
                <input style={inputStyle} value={customForm.models} onChange={e => setCustomForm(f => ({ ...f, models: e.target.value }))} required placeholder="mistral-large, mistral-small, codestral" />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Default Model</label>
                <input style={inputStyle} value={customForm.default_model} onChange={e => setCustomForm(f => ({ ...f, default_model: e.target.value }))} placeholder="mistral-large" />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Base URL</label>
                <input style={inputStyle} value={customForm.custom_base_url} onChange={e => setCustomForm(f => ({ ...f, custom_base_url: e.target.value }))} placeholder="https://api.mistral.ai/v1" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setAddCustomModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={isSaving} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: accentBrand, color: '#000', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700, opacity: isSaving ? 0.8 : 1 }}>{isSaving ? 'Adding...' : 'Add Provider'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
