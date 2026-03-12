'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { gmailApi } from '@/lib/api/gmail.api';
import { useAuthStore } from '@/store/auth.store';

export default function AgentGmailConnectPage() {
  const { user, clearAuth } = useAuthStore();
  const searchParams = useSearchParams();
  const gmailConnected = searchParams.get('gmail_connected') === '1';
  const connectedEmail = searchParams.get('email') || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);

  const connect = async () => {
    setLoading(true);
    setError('');
    setUrl(null);
    try {
      const res = await gmailApi.oauthStart();
      const u = res?.data?.url;
      const r = res?.data?.redirect_uri;
      if (!u) throw new Error('No OAuth URL returned');
      setUrl(String(u));
      setRedirectUri(r ? String(r) : null);
      window.location.href = String(u);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to start Gmail OAuth');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#E5E7EB' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 950 }}>Gmail connection</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
              Connect the Gmail inbox so ticket threads can sync on Refresh.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/agent/dashboard" style={{ color: '#FACC15', textDecoration: 'none', fontWeight: 900, fontSize: 12 }}>
              Dashboard
            </Link>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>
              {user?.email ? `Signed in: ${user.email}` : 'Not signed in'}
            </div>
            <button
              type="button"
              onClick={() => clearAuth()}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.25)',
                background: 'rgba(2,6,23,0.55)',
                color: '#E5E7EB',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Success banner shown after OAuth redirect */}
        {gmailConnected && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: '1px solid rgba(74,222,128,0.35)', background: 'rgba(20,83,45,0.35)' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#4ADE80', marginBottom: 4 }}>
              Gmail connected successfully
            </div>
            {connectedEmail && (
              <div style={{ fontSize: 12, color: '#86EFAC' }}>
                Authorized inbox: <b>{connectedEmail}</b>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#86EFAC', marginTop: 6 }}>
              You can now go to any ticket and click <b>Refresh</b> to sync the Gmail thread.
            </div>
            <Link
              href="/agent/dashboard"
              style={{ display: 'inline-block', marginTop: 10, padding: '8px 12px', borderRadius: 999, background: '#4ADE80', color: '#0F172A', fontSize: 12, fontWeight: 950, textDecoration: 'none' }}
            >
              Go to Dashboard →
            </Link>
          </div>
        )}

        {/* Primary method: direct backend URL — no API call, no frontend indirection */}
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: '1px solid rgba(250,204,21,0.35)', background: 'rgba(15,23,42,0.65)' }}>
          <div style={{ fontSize: 12, color: '#FACC15', fontWeight: 800, marginBottom: 6 }}>
            Recommended: Connect via direct link
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>
            Click the button below (or paste the URL in a new browser tab). This goes straight from the backend to Google — no frontend API call — which avoids redirect URI mismatches.
          </div>
          <a
            href="http://localhost:5000/api/gmail/oauth/connect"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block',
              padding: '10px 14px',
              borderRadius: 999,
              background: '#FACC15',
              color: '#0F172A',
              fontSize: 12,
              fontWeight: 950,
              textDecoration: 'none',
            }}
          >
            Open Gmail OAuth →
          </a>
          <div style={{ marginTop: 10, fontSize: 11, color: '#64748B', wordBreak: 'break-all' }}>
            URL: http://localhost:5000/api/gmail/oauth/connect
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#94A3B8' }}>
            Make sure <b>http://localhost:5000/api/gmail/oauth/callback</b> is listed under Authorized redirect URIs in Google Cloud → OAuth Client.
          </div>
        </div>

        {/* Fallback: original frontend-initiated flow */}
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(15,23,42,0.65)' }}>
          <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 800, marginBottom: 10 }}>
            Alternative: Connect via button
          </div>
          {error && (
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(248,113,113,0.12)', color: '#FCA5A5', fontSize: 12, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={connect}
            disabled={loading}
            style={{
              padding: '10px 14px',
              borderRadius: 999,
              border: 'none',
              background: loading ? 'rgba(250,204,21,0.5)' : '#FACC15',
              color: '#0F172A',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 950,
            }}
          >
            {loading ? 'Opening Google…' : 'Connect Gmail'}
          </button>

          {redirectUri && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#94A3B8' }}>
              Backend redirect URI in use:
              <div style={{ marginTop: 6, color: '#E5E7EB', fontWeight: 800, wordBreak: 'break-all' }}>{redirectUri}</div>
            </div>
          )}

          {url && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#94A3B8' }}>
              If you weren't redirected, open this link:
              <div style={{ marginTop: 6 }}>
                <a href={url} style={{ color: '#93C5FD', wordBreak: 'break-all' }}>
                  {url}
                </a>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: '#94A3B8', padding: '0 2px' }}>
          After approving access, Google redirects to the backend callback which saves your tokens and brings you back here. Then go to a ticket and click <b>Refresh</b> to sync the Gmail thread.
        </div>
      </div>
    </div>
  );
}
