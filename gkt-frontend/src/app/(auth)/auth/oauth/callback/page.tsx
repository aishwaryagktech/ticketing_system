'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function GmailOauthCallbackPage() {
  const sp = useSearchParams();
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState<string>('Connecting Gmail…');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    const code = sp.get('code') || '';
    if (!code) {
      setStatus('error');
      setMessage('Missing "code" in callback URL.');
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    fetch(`${apiBase}/api/gmail/oauth/callback?code=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && localStorage.getItem('gkt_token')
          ? { Authorization: `Bearer ${localStorage.getItem('gkt_token')}` }
          : {}),
      },
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        setDetails(data);
        if (!r.ok) throw new Error(data?.error || `Failed (${r.status})`);
        setStatus('ok');
        setMessage(`Gmail connected: ${data?.email || 'ok'}`);
      })
      .catch((e: any) => {
        setStatus('error');
        setMessage(e?.message || 'Failed to connect Gmail');
      });
  }, [sp]);

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#E5E7EB', padding: 18 }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Gmail OAuth callback</div>
        <div style={{ marginTop: 10, padding: 14, borderRadius: 14, border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(15,23,42,0.65)' }}>
          <div style={{ fontSize: 12, color: status === 'ok' ? '#86EFAC' : status === 'error' ? '#FCA5A5' : '#94A3B8', fontWeight: 900 }}>
            {status === 'working' ? 'Working…' : status === 'ok' ? 'Connected' : 'Failed'}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#E5E7EB', whiteSpace: 'pre-wrap' }}>{message}</div>
          {status === 'error' && details && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 900, marginBottom: 6 }}>Debug details</div>
              <div style={{ fontSize: 11, color: '#E5E7EB', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(details, null, 2)}
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/agent/gmail" style={{ color: '#FACC15', textDecoration: 'none', fontWeight: 900, fontSize: 12 }}>
              Back to Gmail page
            </Link>
            <Link href="/agent/dashboard" style={{ color: '#93C5FD', textDecoration: 'none', fontWeight: 900, fontSize: 12 }}>
              Go to dashboard
            </Link>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#94A3B8' }}>
            After this shows “Connected”, open a ticket and click <b>Refresh</b> in the Conversation tab.
          </div>
        </div>
      </div>
    </div>
  );
}

