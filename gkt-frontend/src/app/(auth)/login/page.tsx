'use client';

import React, { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && theme === 'dark';

  // ── Design tokens (matches landing page) ──
  const pageBg = isDark
    ? 'linear-gradient(160deg,#020617 0%,#0a1628 40%,#060d1f 100%)'
    : 'linear-gradient(160deg,#EFF6FF 0%,#DBEAFE 30%,#F0F9FF 65%,#E0F2FE 100%)';
  const textPrimary   = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#334155';
  const accentBlue    = '#0EA5E9';
  const accentIndigo  = '#6366F1';
  const cardBg        = isDark ? 'rgba(15,23,42,0.85)'    : 'rgba(255,255,255,0.85)';
  const cardBorder    = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(147,197,253,0.6)';
  const inputBg       = isDark ? 'rgba(15,23,42,0.7)'     : 'rgba(255,255,255,0.9)';
  const inputBorder   = isDark ? 'rgba(148,163,184,0.3)'  : 'rgba(147,197,253,0.7)';
  const pillBg        = isDark ? 'rgba(14,165,233,0.12)'  : 'rgba(219,234,254,0.9)';
  const pillBorder    = isDark ? 'rgba(14,165,233,0.3)'   : 'rgba(147,197,253,0.8)';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: `1px solid ${inputBorder}`, background: inputBg,
    color: textPrimary, fontSize: 14, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 6, display: 'block',
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); setIsLoading(false); return; }
      const { setAuth } = useAuthStore.getState();
      setAuth(data.user, data.token);
      localStorage.setItem('gkt_token', data.token);
      if (data.refresh_token) localStorage.setItem('gkt_refresh_token', data.refresh_token);
      localStorage.setItem('gkt_user', JSON.stringify(data.user));
      if (data.user.role === 'super_admin') router.push('/super-admin/products');
      else if (data.user.role === 'tenant_admin') router.push('/admin/dashboard');
      else if (['l1_agent','l2_agent','l3_agent'].includes(data.user.role)) router.push('/agent/dashboard');
      else router.push('/portal/dashboard');
    } catch {
      setError('Network error. Please ensure the backend is running.');
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: textPrimary, fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif', overflowX: 'hidden' }}>

      {/* Blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, left: -80, width: 450, height: 450, borderRadius: '50%', background: isDark ? 'rgba(29,78,216,0.15)' : 'rgba(147,197,253,0.35)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: 0, right: -60, width: 380, height: 380, borderRadius: '50%', background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(199,210,254,0.4)', filter: 'blur(70px)' }} />
      </div>

      {/* Nav */}
      <header style={{ position: 'relative', zIndex: 10, maxWidth: 1140, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: isDark ? 'rgba(14,165,233,0.2)' : '#BFDBFE', border: `1px solid ${pillBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: 999, background: accentBlue }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>GKT AI Ticketing</div>
            <div style={{ fontSize: 10, color: textSecondary }}>Modern AI workspace for education teams</div>
          </div>
        </Link>
        <button type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} style={{ padding: '5px 12px', borderRadius: 999, border: `1px solid ${cardBorder}`, background: pillBg, color: textSecondary, fontSize: 11, cursor: 'pointer' }}>
          {isDark ? '☀ Light' : '🌙 Dark'}
        </button>
      </header>

      {/* Two-column layout */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', padding: '24px 24px 60px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.05fr)', gap: 40, alignItems: 'start' }}>

        {/* ── Left: form card ── */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 20, padding: 32, backdropFilter: 'blur(12px)', boxShadow: isDark ? '0 24px 60px rgba(0,0,0,0.5)' : '0 20px 50px rgba(14,165,233,0.14)' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 28, background: isDark ? 'rgba(255,255,255,0.05)' : '#EFF6FF', borderRadius: 12, padding: 4, border: `1px solid ${cardBorder}` }}>
            <div style={{ flex: 1, padding: '9px', borderRadius: 9, background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, color: '#fff', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>Log In</div>
            <Link href="/signup" style={{ flex: 1, padding: '9px', borderRadius: 9, color: textSecondary, fontWeight: 600, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>Sign Up</Link>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Welcome back</h1>
            <p style={{ fontSize: 13, color: textSecondary }}>Sign in to your GKT workspace.</p>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#ef4444', fontSize: 13, marginBottom: 20, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="you@company.com" />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={isLoading} style={{ marginTop: 4, padding: '12px', borderRadius: 10, background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(14,165,233,0.35)', opacity: isLoading ? 0.8 : 1 }}>
              {isLoading ? 'Signing in…' : 'Log In'}
            </button>
          </form>

          <p style={{ fontSize: 12, color: textSecondary, marginTop: 20, textAlign: 'center' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: accentBlue, fontWeight: 600, textDecoration: 'none' }}>Sign up free</Link>
          </p>
        </div>

        {/* ── Right: feature showcase ── */}
        <div style={{ background: isDark ? 'linear-gradient(135deg,rgba(14,165,233,0.1),rgba(99,102,241,0.08))' : 'linear-gradient(135deg,rgba(219,234,254,0.7),rgba(224,231,255,0.6))', border: `1px solid ${cardBorder}`, borderRadius: 20, padding: 32, backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: isDark ? 'rgba(14,165,233,0.07)' : 'rgba(147,197,253,0.3)', pointerEvents: 'none' }} />

          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6, color: textPrimary }}>AI-Powered Support,<br />Built for Teams</div>
            <div style={{ fontSize: 13, color: textSecondary, lineHeight: 1.65 }}>Resolve tickets faster with intelligent triage, live chat, and knowledge-base automation.</div>
          </div>

          {/* Ticket cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id:'TKT-041', label:'Login issue on mobile app',    status:'In Progress', c:'#0EA5E9', agent:'Priya M.' },
              { id:'TKT-040', label:'Billing invoice not received',  status:'Open',        c:'#F59E0B', agent:'Unassigned' },
              { id:'TKT-039', label:'Password reset not working',    status:'Resolved',    c:'#4ADE80', agent:'Rahul S.' },
            ].map(t => (
              <div key={t.id} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)', border: `1px solid ${cardBorder}`, borderRadius: 10, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: t.c, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: textSecondary, marginTop: 1 }}>{t.id} · {t.agent}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${t.c}22`, color: t.c, flexShrink: 0 }}>{t.status}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v:'94%', l:'Resolution Rate', c:'#4ADE80' }, { v:'<2m', l:'Avg Response', c:'#0EA5E9' }, { v:'3×', l:'Faster w/ AI', c:'#A78BFA' }].map(s => (
              <div key={s.l} style={{ flex: 1, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)', border: `1px solid ${cardBorder}`, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 9, color: textSecondary, marginTop: 2, lineHeight: 1.3 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* AI bubble */}
          <div style={{ background: isDark ? 'rgba(14,165,233,0.08)' : 'rgba(219,234,254,0.7)', border: `1px solid ${isDark ? 'rgba(14,165,233,0.2)' : 'rgba(147,197,253,0.5)'}`, borderRadius: 12, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: 'linear-gradient(135deg,#0EA5E9,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🤖</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: accentBlue, marginBottom: 3 }}>L0 AI Bot</div>
              <div style={{ fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>Found 3 KB articles matching your issue. Shall I auto-resolve this ticket?</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
