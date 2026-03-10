'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';

export default function SupportEmbedTestPage() {
  const search = useSearchParams();
  const tenantId = search.get('tenant_id') || 'c8a48f2a-8a68-4fab-a5c7-2981f2003144';
  const productId = search.get('product_id') || 'PRODUCT_ID';
  const supportUrl = `http://localhost:3000/support?tenant_id=${encodeURIComponent(
    tenantId
  )}&product_id=${encodeURIComponent(productId)}`;
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#020617',
        color: '#E5E7EB',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      <header
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid rgba(148,163,184,0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: '#FACC15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#0F172A',
              fontSize: 14,
            }}
          >
            T
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Tenant Demo Site</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Example landing page embedding your support form</span>
          </div>
        </div>
        <nav style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9CA3AF' }}>
          <span>Home</span>
          <span>Courses</span>
          <span>Pricing</span>
          <span style={{ color: '#FACC15' }}>Support</span>
        </nav>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '20px 24px 32px',
        }}
      >
        <section style={{ maxWidth: 640, marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Contact support</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>
            This is how your hosted GKT support form will look when it is embedded directly into a tenant website.
          </p>
        </section>

        <section
          style={{
            flex: 1,
            maxWidth: 900,
            background: '#020617',
            borderRadius: 18,
            border: '1px solid rgba(148,163,184,0.5)',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(15,23,42,0.6)',
          }}
        >
          <iframe
            src={supportUrl}
            width="100%"
            height="650"
            style={{
              border: 'none',
              borderRadius: 0,
            }}
            title="Support form"
          />
        </section>
      </main>
    </div>
  );
}

