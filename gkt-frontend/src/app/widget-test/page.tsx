'use client';

import React, { useEffect } from 'react';

export default function WidgetTestPage() {
  useEffect(() => {
    // Dynamically inject the widget script on the client to avoid hydration issues
    const script = document.createElement('script');
    script.src = 'http://localhost:3000/widget.js';
    script.dataset.tenant = 'c8a48f2a-8a68-4fab-a5c7-2981f2003144';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
      const iframe = document.querySelector('iframe[data-gkt-widget="chat"]');
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
  }, []);

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
          This page includes the GKT widget script. You should see a chat window in the bottom-right corner.
        </p>
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
          }}
        >
          {`<script src="http://localhost:3000/widget.js"\n        data-tenant="c8a48f2a-8a68-4fab-a5c7-2981f2003144"></script>`}
        </code>
      </div>
    </div>
  );
}


