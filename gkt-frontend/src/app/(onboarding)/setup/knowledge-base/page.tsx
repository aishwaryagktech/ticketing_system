'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { onboardingApi } from '@/lib/api/onboarding.api';

export default function SetupKnowledgeBasePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [tenantProducts, setTenantProducts] = useState<any[]>([]);
  const [tenantProductId, setTenantProductId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [crawling, setCrawling] = useState(false);

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
  const [creatingArticle, setCreatingArticle] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setLoadingLists(true);
    onboardingApi.getProducts()
      .then((p) => {
        const list = Array.isArray(p) ? p : [];
        setTenantProducts(list);
        if (!tenantProductId && list[0]?.id) setTenantProductId(list[0].id);
      })
      .catch(() => setTenantProducts([]))
      .finally(() => setLoadingLists(false));
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    setLoadingLists(true);
    Promise.all([onboardingApi.kbSources(tenantProductId || undefined), onboardingApi.kbArticles(tenantProductId || undefined)])
      .then(([s]) => {
        setSources(Array.isArray(s) ? s : []);
      })
      .catch(() => {
        setSources([]);
      })
      .finally(() => setLoadingLists(false));
  }, [mounted, tenantProductId]);

  const handleContinue = async () => {
    setSaving(true);
    try {
      await onboardingApi.setStep('ai_bot');
      router.push('/setup/ai-bot');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      await onboardingApi.kbUpload(file, tenantProductId || undefined);
      const [s] = await Promise.all([onboardingApi.kbSources(tenantProductId || undefined)]);
      setSources(Array.isArray(s) ? s : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const isDark = mounted && theme === 'dark';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentBrand = '#FACC15';
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : '#E2E8F0';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF';
  const pageBg = isDark ? 'rgba(2,6,23,0.12)' : 'rgba(15,23,42,0.03)';

  const fmt = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString();
  };

  if (!mounted) return null;

  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: 13, color: accentBrand, fontWeight: 600 }}>Step 6</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Knowledge Base</h1>
      <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28 }}>
        Add documents and starter articles that power the AI features (L0 bot deflection, ticket classification, routing, and agent assist).
      </p>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#ef4444', marginBottom: 14 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: 12, background: isDark ? 'rgba(34,197,94,0.12)' : '#DCFCE7', borderRadius: 10, color: isDark ? '#4ADE80' : '#15803D', marginBottom: 14, fontWeight: 600 }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Product
        </div>
        <select
          value={tenantProductId}
          onChange={(e) => setTenantProductId(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: textPrimary, fontWeight: 800, minWidth: 220 }}
        >
          {tenantProducts.length === 0 ? <option value="">No products</option> : tenantProducts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#ef4444', marginBottom: 16 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22, alignItems: 'start' }}>
        {/* LEFT: Upload docs */}
        <div style={{ padding: 18, border: `1px solid ${borderColor}`, borderRadius: 14, background: cardBg }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: textPrimary }}>Upload docs</div>
              <div style={{ fontSize: 12, color: textSecondary }}>PDF/DOCX/TXT files your team relies on.</div>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontWeight: 900,
                fontSize: 12,
                color: textPrimary,
                whiteSpace: 'nowrap',
              }}
            >
              {uploading ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          <div style={{ border: `1px solid ${borderColor}`, borderRadius: 14, background: pageBg, padding: 12, height: 380, overflow: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Uploaded docs
            </div>
            {loadingLists ? (
              <div style={{ color: textSecondary, fontSize: 13 }}>Loading…</div>
            ) : sources.filter((s: any) => (s as any).source_type === 'upload' || String(s.url || '').startsWith('upload:')).length === 0 ? (
              <div style={{ color: textSecondary, fontSize: 13 }}>
                No uploaded docs yet. Upload a PDF/DOCX/TXT to start building your library.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {sources
                  .filter((s: any) => (s as any).source_type === 'upload' || String(s.url || '').startsWith('upload:'))
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
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid ${borderColor}`,
                        background: String(selectedUploadId) === String(s.id) ? (isDark ? 'rgba(250,204,21,0.10)' : 'rgba(250,204,21,0.18)') : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: textPrimary, fontWeight: 900, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.title || 'Untitled'}
                          </div>
                          <div style={{ color: textSecondary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.url}
                          </div>
                          <div style={{ color: textSecondary, fontSize: 12, marginTop: 4 }}>
                            Updated {fmt(s.updated_at || s.created_at)}
                          </div>
                        </div>
                        <div style={{ color: textSecondary, fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>Open →</div>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Web crawl */}
        <div style={{ padding: 18, border: `1px solid ${borderColor}`, borderRadius: 14, background: cardBg }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: textPrimary, marginBottom: 4 }}>Allow web crawl</div>
          <div style={{ fontSize: 12, color: textSecondary, marginBottom: 12 }}>Extract text from public HTML pages and convert into KB articles.</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10, marginBottom: 10 }}>
            <input
              value={crawl.url}
              onChange={(e) => setCrawl((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://example.com/docs"
              style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: textPrimary, fontWeight: 700 }}
            />
            <button
              type="button"
              disabled={crawling || !crawl.url}
              onClick={async () => {
                setError('');
                setCrawling(true);
                try {
                  const src = await onboardingApi.kbCrawl(crawl.url, tenantProductId || undefined);
                  setSelectedCrawlId(src.id);
                  setSelectedUploadId(null);
                  // Use crawl response for preview (it includes content_text); merge with any extra fields from a follow-up fetch
                  setSelectedSource(src?.content_text != null ? src : await onboardingApi.kbSource(src.id).catch(() => src));
                  // Refresh only uploaded docs list; do not overwrite so we keep current crawl in session
                  onboardingApi
                    .kbSources(tenantProductId || undefined)
                    .then((list) => {
                      if (Array.isArray(list)) setSources(list);
                    })
                    .catch(() => {});
                } catch (e: any) {
                  setError(e?.message || 'Failed to crawl URL');
                } finally {
                  setCrawling(false);
                }
              }}
              style={{ padding: '10px 12px', borderRadius: 10, border: 'none', background: accentBrand, color: '#000', fontWeight: 900, cursor: 'pointer', opacity: crawling ? 0.8 : 1 }}
            >
              {crawling ? 'Crawling…' : 'Crawl'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input value={crawl.title} onChange={(e) => setCrawl((p) => ({ ...p, title: e.target.value }))} placeholder="Title" style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: textPrimary, fontWeight: 700 }} />
            <input value={crawl.category} onChange={(e) => setCrawl((p) => ({ ...p, category: e.target.value }))} placeholder="Category" style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: textPrimary, fontWeight: 700 }} />
            <input value={crawl.audience} onChange={(e) => setCrawl((p) => ({ ...p, audience: e.target.value }))} placeholder="Audience" style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: textPrimary, fontWeight: 700 }} />
            <input value={crawl.tags} onChange={(e) => setCrawl((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma-separated)" style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: textPrimary, fontWeight: 700 }} />
          </div>

          <div style={{ border: `1px solid ${borderColor}`, borderRadius: 14, background: pageBg, padding: 12, height: 210, overflow: 'auto', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Extracted text
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: textSecondary, lineHeight: 1.6 }}>
              {selectedCrawlId && selectedSource?.id === selectedCrawlId ? (selectedSource?.content_text || '') : 'Select a crawled link to preview extracted content.'}
            </div>
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
                const src = selectedSource?.id === selectedCrawlId ? selectedSource : await onboardingApi.kbSource(selectedCrawlId);
                const tags = String(crawl.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
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
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: accentBrand, color: '#000', fontWeight: 900, cursor: 'pointer', opacity: !selectedCrawlId || creatingArticle ? 0.7 : 1, marginBottom: 12 }}
          >
            {creatingArticle ? 'Creating…' : 'Create KB Article from extracted text'}
          </button>
        </div>

      </div>

      {sourceModalOpen && selectedSource && (
        <div
          onClick={() => setSourceModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(980px, 96vw)', maxHeight: '85vh', overflow: 'hidden', background: isDark ? '#0B1220' : '#FFFFFF', border: `1px solid ${borderColor}`, borderRadius: 14 }}
          >
            <div style={{ padding: 14, borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedSource.title || 'Untitled'}
                </div>
                <div style={{ fontSize: 12, color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedSource.url}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Delete this extracted source?')) return;
                    setLoadingLists(true);
                    try {
                      await onboardingApi.kbDeleteSource(selectedSource.id);
                      const list = await onboardingApi.kbSources(tenantProductId || undefined);
                      setSources(Array.isArray(list) ? list : []);
                      setSourceModalOpen(false);
                    } finally {
                      setLoadingLists(false);
                    }
                  }}
                  style={{ border: `1px solid ${borderColor}`, background: 'transparent', color: textSecondary, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 900 }}
                >
                  Delete
                </button>
                <button type="button" onClick={() => setSourceModalOpen(false)} style={{ border: 'none', background: 'transparent', color: textSecondary, fontSize: 18, cursor: 'pointer' }}>
                  ×
                </button>
              </div>
            </div>
            <div style={{ padding: 14, maxHeight: 'calc(85vh - 64px)', overflow: 'auto' }}>
              <div style={{ fontSize: 12, color: textSecondary, marginBottom: 10 }}>
                Updated {fmt(selectedSource.updated_at || selectedSource.created_at)}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: textSecondary, lineHeight: 1.7 }}>
                {selectedSource.content_text || ''}
              </div>
            </div>
          </div>
        </div>
      )}

      <button onClick={handleContinue} disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: accentBrand, color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Continue to AI Bot'}
      </button>
    </div>
  );
}
