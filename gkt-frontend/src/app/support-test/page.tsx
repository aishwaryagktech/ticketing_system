'use client';

import React, { useMemo, useState } from 'react';

export default function SupportEmbedTestPage() {
  const [snippet, setSnippet] = useState(
    `<iframe
  src="http://localhost:3000/support?tenant_id=03464b4d-d96c-4ac6-b253-73294dac2427&tenant_product_id=5402e5fe-52d6-45f1-a631-cae09f2330c1&product_id=5402e5fe-52d6-45f1-a631-cae09f2330c1"
  width="100%"
  height="650"
  style="border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(15,23,42,0.35);"
  title="Support form"
></iframe>`
  );

  const src = useMemo(() => {
    const m = snippet.match(/src="([^"]+)"/i);
    return m?.[1] || 'http://localhost:3000/support';
  }, [snippet]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#020617',
        color: '#E5E7EB',
        padding: 16,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Support webform test</h1>
        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>
          Paste your iframe snippet below. The form will render in the preview
          so you can test the flow like it is embedded in a tenant website.
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
            border: '1px solid rgba(148,163,184,0.5)',
            color: '#E5E7EB',
            fontSize: 12,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        />
        <div
          style={{
            marginTop: 16,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(148,163,184,0.5)',
            boxShadow: '0 20px 40px rgba(15,23,42,0.6)',
          }}
        >
          <iframe
            src={src}
            width="100%"
            height={650}
            style={{ border: 'none' }}
            title="Support form preview"
          />
        </div>
      </div>
    </div>
  );
}

