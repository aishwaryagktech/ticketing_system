'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { onboardingApi } from '@/lib/api/onboarding.api';

type Source = {
  id: string;
  url: string;
  title?: string | null;
  content_text: string;
  created_at: string;
};

export default function KnowledgeBaseImportPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState('https://rewirelearning.com/');
  const [tenantProducts, setTenantProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [tenantProductId, setTenantProductId] = useState<string>('');
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Source | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [article, setArticle] = useState({
    title: '',
    category: 'Getting Started',
    audience: 'student',
    tags: 'rewire,beta',
    body: '',
    is_published: false,
  });

  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === 'dark';
  const bg = isDark ? '#0F172A' : '#F8FAFC';
  const surface = isDark ? '#0B1220' : '#FFFFFF';
  const border = isDark ? 'rgba(148,163,184,0.18)' : '#E2E8F0';
  const text = isDark ? '#F8FAFC' : '#0F172A';
  const sub = isDark ? '#94A3B8' : '#64748B';
  const accent = '#FACC15';

  const leftList = useMemo(
    () =>
      sources
        .filter((s) => (s as any).source_type !== 'upload' && !String(s.url || '').startsWith('upload:')) // show only web-crawled sources here
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [sources]
  );

  async function refreshList() {
    setLoadingList(true);
    try {
      const list = await onboardingApi.kbSources(tenantProductId || undefined);
      setSources(Array.isArray(list) ? list : []);
      if (!selectedId && Array.isArray(list) && list[0]?.id) setSelectedId(list[0].id);
    } catch (e: any) {
      setError(e?.message || 'Failed to load sources');
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;
    onboardingApi.getProducts()
      .then((p) => {
        const list = Array.isArray(p) ? p : [];
        setTenantProducts(list);
        if (!tenantProductId && list[0]?.id) setTenantProductId(list[0].id);
      })
      .catch(() => setTenantProducts([]))
      .finally(() => refreshList());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantProductId]);

  useEffect(() => {
    if (!mounted || !selectedId) return;
    setError('');
    setSuccess('');
    onboardingApi.kbSource(selectedId)
      .then((src) => {
        setSelected(src);
        setArticle((prev) => ({
          ...prev,
          title: src.title || new URL(src.url).hostname,
          body: src.content_text,
        }));
      })
      .catch(() => setSelected(null));
  }, [mounted, selectedId]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${border}`,
    background: surface,
    color: text,
    fontSize: 14,
    outline: 'none',
  };

  if (!mounted) return null;

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: bg, color: text }}>
      <div style={{ maxWidth: 1900, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <Link
            href="/setup/knowledge-base"
            style={{
              display: 'inline-block',
              marginBottom: 10,
              color: sub,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ← Back to Knowledge Base
          </Link>
          <div style={{ fontSize: 13, fontWeight: 700, color: accent, marginBottom: 6 }}>Knowledge Base Import</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Crawl a URL → Extract → Convert to Article</h1>
          <p style={{ margin: '8px 0 0', color: sub, fontSize: 13, lineHeight: 1.6 }}>
            Paste a product page URL (HTML) to extract readable text. Review on the right and manually save as a KB article.
          </p>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', marginBottom: 14 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: 12, borderRadius: 10, background: isDark ? 'rgba(34,197,94,0.12)' : '#DCFCE7', color: isDark ? '#4ADE80' : '#15803D', marginBottom: 14, fontWeight: 700 }}>
            {success}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 2.7fr)', gap: 24, alignItems: 'stretch' }}>
          {/* Left: sources list */}
          <div style={{ border: `1px solid ${border}`, borderRadius: 14, background: surface, overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: `1px solid ${border}` }}>
              <div style={{ display: 'flex', gap: 10 }}>
                  <select
                    value={tenantProductId}
                    onChange={(e) => setTenantProductId(e.target.value)}
                    style={{ ...inputStyle, maxWidth: 180, background: isDark ? '#0F172A' : '#FFFFFF' }}
                  >
                    {tenantProducts.length === 0 ? (
                      <option value="">No products</option>
                    ) : (
                      tenantProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    )}
                  </select>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/docs"
                  style={{ ...inputStyle, flex: 1, background: isDark ? '#0F172A' : '#FFFFFF' }}
                />
                <button
                  type="button"
                  disabled={crawling}
                  onClick={async () => {
                    setError('');
                    setSuccess('');
                    setCrawling(true);
                    try {
                      const src = await onboardingApi.kbCrawl(url, tenantProductId || undefined);
                      setSuccess('Extracted and stored.');
                      await refreshList();
                      setSelectedId(src.id);
                    } catch (e: any) {
                      setError(e?.message || 'Failed to crawl');
                    } finally {
                      setCrawling(false);
                    }
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: accent,
                    color: '#000',
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: crawling ? 0.8 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {crawling ? 'Crawling…' : 'Crawl'}
                </button>
              </div>
              <div style={{ marginTop: 8, color: sub, fontSize: 12 }}>
                Tip: start with homepage, docs, FAQ, onboarding pages.
              </div>
            </div>

            <div style={{ padding: 12, maxHeight: 'calc(100vh - 190px)', overflow: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Sources
              </div>
              {loadingList ? (
                <div style={{ padding: 12, color: sub }}>Loading…</div>
              ) : leftList.length === 0 ? (
                <div style={{ padding: 12, color: sub }}>No sources yet. Crawl a URL above.</div>
              ) : (
                leftList.map((s) => {
                  const active = s.id === selectedId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 10px',
                        borderRadius: 12,
                        border: `1px solid ${active ? accent : border}`,
                        background: active ? (isDark ? 'rgba(250,204,21,0.10)' : 'rgba(250,204,21,0.18)') : 'transparent',
                        color: text,
                        cursor: 'pointer',
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 4 }}>
                        {s.title || new URL(s.url).hostname}
                      </div>
                      <div style={{ color: sub, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.url}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: preview + editor */}
          <div style={{ border: `1px solid ${border}`, borderRadius: 14, background: surface, overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: sub, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Preview</div>
                <div style={{ fontSize: 14, fontWeight: 900 }}>{selected ? (selected.title || selected.url) : 'Select a source'}</div>
              </div>
              <button
                type="button"
                disabled={!selected || converting}
                onClick={async () => {
                  if (!selected) return;
                  setError('');
                  setSuccess('');
                  setConverting(true);
                  try {
                    const tags = article.tags.split(',').map((t) => t.trim()).filter(Boolean);
                    await onboardingApi.kbConvert(selected.id, {
                      title: article.title,
                      body: article.body,
                      category: article.category,
                      audience: article.audience,
                      tags,
                      is_published: article.is_published,
                      tenant_product_id: tenantProductId || null,
                    });
                    setSuccess('KB article created.');
                  } catch (e: any) {
                    setError(e?.message || 'Failed to create article');
                  } finally {
                    setConverting(false);
                  }
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: accent,
                  color: '#000',
                  fontWeight: 900,
                  cursor: 'pointer',
                  opacity: !selected || converting ? 0.7 : 1,
                }}
              >
                {converting ? 'Creating…' : 'Create KB Article'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 14, borderBottom: `1px solid ${border}` }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: sub, marginBottom: 6 }}>Title</div>
                <input value={article.title} onChange={(e) => setArticle((p) => ({ ...p, title: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: sub, marginBottom: 6 }}>Category</div>
                <input value={article.category} onChange={(e) => setArticle((p) => ({ ...p, category: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: sub, marginBottom: 6 }}>Audience</div>
                <input value={article.audience} onChange={(e) => setArticle((p) => ({ ...p, audience: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: sub, marginBottom: 6 }}>Tags (comma-separated)</div>
                <input value={article.tags} onChange={(e) => setArticle((p) => ({ ...p, tags: e.target.value }))} style={inputStyle} />
              </div>
              <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, color: sub, fontSize: 13, fontWeight: 700 }}>
                <input type="checkbox" checked={article.is_published} onChange={(e) => setArticle((p) => ({ ...p, is_published: e.target.checked }))} />
                Publish immediately
              </label>
            </div>

            <div style={{ padding: 14, height: 'calc(100vh - 260px)', minHeight: 460, overflow: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: sub, marginBottom: 8 }}>Extracted text / Article body</div>
              <textarea
                value={article.body}
                onChange={(e) => setArticle((p) => ({ ...p, body: e.target.value }))}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 440,
                  resize: 'none',
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${border}`,
                  background: isDark ? '#0F172A' : '#FFFFFF',
                  color: text,
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

