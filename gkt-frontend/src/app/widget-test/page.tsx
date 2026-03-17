'use client';

import React, { useEffect, useMemo, useState } from 'react';

export default function WidgetTestPage() {
  const [snippet, setSnippet] = useState(
    `<script src="http://localhost:3000/widget.js"\n  data-tenant="TENANT_ID"\n  data-product="TENANT_PRODUCT_ID"></script>`
  );
  const [testUserId] = useState(() => `demo-user-${Math.random().toString(36).slice(2, 8)}`);
  const [testUserEmail] = useState(() => `demo.${Math.random().toString(36).slice(2, 6)}@example.com`);

  const parsed = useMemo(() => {
    const m = snippet.match(/<script[^>]*>/i)?.[0] || '';
    const get = (name: string) => {
      const r = new RegExp(`${name}="([^"]*)"`, 'i').exec(m);
      return r?.[1] || '';
    };
    return {
      src: get('src') || 'http://localhost:3000/widget.js',
      tenant: get('data-tenant'),
      product: get('data-product'),
      tenantProductId: get('data-tenant-product-id') || get('data-tenantProductId'),
      // user id/email are injected by the host app at runtime; for this demo
      // page we generate random values instead of reading from the snippet.
      userId: '',
      userEmail: '',
    };
  }, [snippet]);

  useEffect(() => {
    // Dynamically inject the widget script on the client to avoid hydration issues
    const existing = document.querySelector('script[data-gkt-widget-script="true"]');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    // Remove sidebar container (new layout) and any leftover old elements
    const existingSidebar = document.getElementById('gkt-sidebar');
    if (existingSidebar && existingSidebar.parentNode) existingSidebar.parentNode.removeChild(existingSidebar);
    const existingStyle = document.querySelector('style[data-gkt-sidebar-style]');
    if (existingStyle && existingStyle.parentNode) existingStyle.parentNode.removeChild(existingStyle);
    const existingIframe = document.querySelector('iframe[data-gkt-widget="chat"]');
    if (existingIframe && existingIframe.parentNode) existingIframe.parentNode.removeChild(existingIframe);
    const existingLauncher = document.querySelector('button[data-gkt-widget-launcher="chat"]');
    if (existingLauncher && existingLauncher.parentNode) existingLauncher.parentNode.removeChild(existingLauncher);

    const script = document.createElement('script');
    script.src = parsed.src;
    script.dataset.tenant = parsed.tenant;
    if (parsed.tenantProductId) script.dataset.tenantProductId = parsed.tenantProductId;
    if (parsed.product) script.dataset.product = parsed.product;
    // For real integrations, the tenant app should set data-user-id/data-user-email
    // dynamically from their own logged-in user context. Here we always send
    // a random demo user so you don't have to edit the snippet.
    script.dataset.userId = testUserId;
    script.dataset.userEmail = testUserEmail;
    script.dataset.gktWidgetScript = 'true';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
      const sidebar = document.getElementById('gkt-sidebar');
      if (sidebar && sidebar.parentNode) sidebar.parentNode.removeChild(sidebar);
      const iframe = document.querySelector('iframe[data-gkt-widget="chat"]');
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      const launcher = document.querySelector('button[data-gkt-widget-launcher="chat"]');
      if (launcher && launcher.parentNode) launcher.parentNode.removeChild(launcher);
    };
  }, [parsed.src, parsed.tenant, parsed.product, parsed.tenantProductId, testUserId, testUserEmail]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        background: '#0f172a',
        color: '#e5e7eb',
        padding: 16,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Widget test page</h1>
        <p style={{ fontSize: 13, marginBottom: 12, color: '#9ca3af' }}>
          Paste your snippet below. The widget will load and you can test the L0 bot flow (KB answers + auto ticket handoff).
        </p>
        <textarea
          value={snippet}
          onChange={(e) => setSnippet(e.target.value)}
          style={{
            width: '100%',
            minHeight: 140,
            background: '#020617',
            padding: 10,
            borderRadius: 8,
            fontSize: 12,
            border: '1px solid rgba(148,163,184,0.5)',
            color: '#E5E7EB',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        />
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10, textAlign: 'left' }}>
          <div>
            <strong style={{ color: '#e5e7eb' }}>Tip</strong>: in a real app, you render the
            script tag with a real <code>data-tenant</code> and <code>data-product</code>{' '}
            (tenant_product_id). The host app should also inject its own logged-in{' '}
            <code>user_id</code> and <code>user_email</code> into the tag.
          </div>
        </div>
        <code
          style={{
            display: 'inline-block',
            textAlign: 'left',
            background: '#020617',
            padding: 10,
            borderRadius: 8,
            fontSize: 11,
            border: '1px solid rgba(148,163,184,0.5)',
            whiteSpace: 'pre',
            marginTop: 12,
          }}
        >
          {'Widget is loading with:\n' +
            `tenant=${parsed.tenant || '(missing)'}\n` +
            `tenant_product_id=${parsed.tenantProductId || parsed.product || '(missing)'}\n` +
            `user_id=${testUserId}\n` +
            `user_email=${testUserEmail}`}
        </code>
      </div>
    </div>
  );
}


