'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function PublicSupportFormPage() {
  const search = useSearchParams();
  const tenantId = search.get('tenant_id') || null;
  const productId = search.get('product_id') || null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/public/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_PUBLIC_API_KEY || '',
        },
        body: JSON.stringify({
          name,
          email,
          subject,
          description,
          source: 'web_form',
          tenant_id: tenantId,
          product_id: productId,
        }),
      });
      if (!res.ok) {
        setResult({ ok: false, message: 'Failed to submit. Please try again.' });
      } else {
        setResult({ ok: true, message: 'Thank you! Your request has been submitted.' });
        setName('');
        setEmail('');
        setSubject('');
        setDescription('');
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F172A',
        color: '#F9FAFB',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        padding: '32px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#020617',
          borderRadius: 20,
          border: '1px solid rgba(148,163,184,0.35)',
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Submit a support request</h1>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
          Use this form to reach the support team. We’ll email you when there’s an update.
        </p>

        {result && (
          <div
            style={{
              marginBottom: 14,
              padding: 10,
              borderRadius: 10,
              fontSize: 12,
              background: result.ok ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)',
              color: result.ok ? '#4ADE80' : '#FCA5A5',
            }}
          >
            {result.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: '#020617',
                color: '#F9FAFB',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: '#020617',
                color: '#F9FAFB',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: '#020617',
                color: '#F9FAFB',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Describe your issue</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: '#020617',
                color: '#F9FAFB',
                fontSize: 13,
                resize: 'vertical',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: 4,
              padding: '10px 18px',
              borderRadius: 999,
              border: 'none',
              background: '#FACC15',
              color: '#0F172A',
              fontWeight: 700,
              fontSize: 13,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.8 : 1,
            }}
          >
            {isSubmitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </div>
    </div>
  );
}

