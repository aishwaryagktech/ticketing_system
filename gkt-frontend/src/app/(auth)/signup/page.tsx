'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

export default function SignupPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({ first_name:'', last_name:'', phone:'', job_title:'', company:'', number_of_employees:'', email:'', password:'' });
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
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${inputBorder}`, background: inputBg,
    color: textPrimary, fontSize: 13, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 5, display: 'block' };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, number_of_employees: form.number_of_employees ? Number(form.number_of_employees) : undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create account'); setIsLoading(false); return; }
      router.push('/login');
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
      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', padding: '16px 24px 60px', display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: 40, alignItems: 'start' }}>

        {/* ── Left: form card ── */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 20, padding: 28, backdropFilter: 'blur(12px)', boxShadow: isDark ? '0 24px 60px rgba(0,0,0,0.5)' : '0 20px 50px rgba(14,165,233,0.14)' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: isDark ? 'rgba(255,255,255,0.05)' : '#EFF6FF', borderRadius: 12, padding: 4, border: `1px solid ${cardBorder}` }}>
            <Link href="/login" style={{ flex: 1, padding: '9px', borderRadius: 9, color: textSecondary, fontWeight: 600, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>Log In</Link>
            <div style={{ flex: 1, padding: '9px', borderRadius: 9, background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, color: '#fff', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>Sign Up</div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 5 }}>Create your GKT account</h1>
            <p style={{ fontSize: 12, color: textSecondary }}>Your company will be set up as a new tenant workspace.</p>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#ef4444', fontSize: 13, marginBottom: 16, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>First name</label><input style={inputStyle} value={form.first_name} onChange={e => updateField('first_name', e.target.value)} required placeholder="Jane" /></div>
              <div><label style={labelStyle}>Last name</label><input style={inputStyle} value={form.last_name} onChange={e => updateField('last_name', e.target.value)} required placeholder="Smith" /></div>
            </div>

            <div><label style={labelStyle}>Work email</label><input type="email" style={inputStyle} value={form.email} onChange={e => updateField('email', e.target.value)} required placeholder="jane@company.com" /></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+1 555 000" /></div>
              <div><label style={labelStyle}>Job title</label><input style={inputStyle} value={form.job_title} onChange={e => updateField('job_title', e.target.value)} placeholder="IT Manager" /></div>
            </div>

            <div><label style={labelStyle}>Company (tenant name)</label><input style={inputStyle} value={form.company} onChange={e => updateField('company', e.target.value)} required placeholder="ABC University" /></div>

            <div><label style={labelStyle}>Number of employees</label><input type="number" min={1} style={inputStyle} value={form.number_of_employees} onChange={e => updateField('number_of_employees', e.target.value)} placeholder="50" /></div>

            <div><label style={labelStyle}>Password</label><input type="password" style={inputStyle} value={form.password} onChange={e => updateField('password', e.target.value)} required placeholder="Min. 8 characters" /></div>

            <button type="submit" disabled={isLoading} style={{ marginTop: 6, padding: '12px', borderRadius: 10, background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(14,165,233,0.35)', opacity: isLoading ? 0.8 : 1 }}>
              {isLoading ? 'Creating account…' : 'Create account →'}
            </button>

            <p style={{ fontSize: 11, color: textSecondary, textAlign: 'center' }}>
              By signing up you agree to our terms. Your company will be created as a GKT tenant.
            </p>
          </form>
        </div>

        {/* ── Right: value prop panel ── */}
        <div style={{ background: isDark ? 'linear-gradient(135deg,rgba(14,165,233,0.1),rgba(99,102,241,0.08))' : 'linear-gradient(135deg,rgba(219,234,254,0.7),rgba(224,231,255,0.6))', border: `1px solid ${cardBorder}`, borderRadius: 20, padding: 28, backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: isDark ? 'rgba(14,165,233,0.07)' : 'rgba(147,197,253,0.3)', pointerEvents: 'none' }} />

          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: pillBg, border: `1px solid ${pillBorder}`, fontSize: 10, color: accentBlue, fontWeight: 700, marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: accentBlue, display: 'inline-block' }} /> FREE TRIAL — NO CARD NEEDED
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: textPrimary, lineHeight: 1.3 }}>Everything you need to run a world-class support team</div>
          </div>

          {/* Feature checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              { icon:'🤖', title:'L0 AI deflection', body:'Bot resolves 60–70% of tickets before an agent sees them.' },
              { icon:'⏱️', title:'SLA governance', body:'Per-priority timers, breach alerts & auto-escalation rules.' },
              { icon:'💬', title:'Live agent chat', body:'Real-time WebSocket conversations, fully logged.' },
              { icon:'🏢', title:'Multi-tenant ready', body:'Separate SLAs, branding & KB per campus or department.' },
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)', border: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: textSecondary, lineHeight: 1.5 }}>{f.body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[{ v:'94%', l:'SLA rate', c:'#4ADE80' }, { v:'68%', l:'L0 deflection', c:'#0EA5E9' }, { v:'3×', l:'Throughput', c:'#A78BFA' }].map(s => (
              <div key={s.l} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)', border: `1px solid ${cardBorder}`, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 9, color: textSecondary, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: textSecondary, textAlign: 'center' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: accentBlue, fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
