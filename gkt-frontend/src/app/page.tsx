'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';

export default function AppPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === 'dark';

  // Colour tokens
  const pageBg = isDark
    ? 'linear-gradient(160deg, #020617 0%, #0a1628 40%, #060d1f 100%)'
    : 'linear-gradient(160deg, #EFF6FF 0%, #DBEAFE 30%, #F0F9FF 65%, #E0F2FE 100%)';
  const textPrimary  = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#334155';
  const cardBg       = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)';
  const cardBorder   = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(147,197,253,0.6)';
  const accentBlue   = '#0EA5E9';
  const accentIndigo = '#6366F1';
  const pillBg       = isDark ? 'rgba(14,165,233,0.12)' : 'rgba(219,234,254,0.9)';
  const pillBorder   = isDark ? 'rgba(14,165,233,0.3)'  : 'rgba(147,197,253,0.8)';
  const sectionBorder = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(147,197,253,0.4)';

  const glassCard: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    borderRadius: 16,
    backdropFilter: 'blur(12px)',
  };

  if (!mounted) return null;

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: textPrimary, fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif', overflowX: 'hidden' }}>

      {/* ── Background decorative blobs ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, left: -80, width: 500, height: 500, borderRadius: '50%', background: isDark ? 'rgba(29,78,216,0.15)' : 'rgba(147,197,253,0.35)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', top: 200, right: -100, width: 400, height: 400, borderRadius: '50%', background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(199,210,254,0.45)', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: 100, left: '35%', width: 350, height: 350, borderRadius: '50%', background: isDark ? 'rgba(14,165,233,0.08)' : 'rgba(186,230,253,0.4)', filter: 'blur(60px)' }} />
      </div>

      {/* ── Nav ── */}
      <header style={{ position: 'relative', zIndex: 10, maxWidth: 1140, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: isDark ? 'rgba(14,165,233,0.2)' : '#BFDBFE', border: `1px solid ${pillBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: 999, background: accentBlue }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>GKT AI Ticketing</div>
            <div style={{ fontSize: 10, color: textSecondary }}>Modern AI workspace for education teams</div>
          </div>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 13, color: textSecondary }}>
          {[['Docs', '/dev-hub'], ['Pricing', '/pricing'], ['Support', '/support']].map(([label, href]) => (
            <Link key={label} href={href} style={{ textDecoration: 'none', color: textSecondary, fontWeight: 500 }}>{label}</Link>
          ))}
        </nav>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} style={{ padding: '5px 12px', borderRadius: 999, border: `1px solid ${cardBorder}`, background: pillBg, color: textSecondary, fontSize: 11, cursor: 'pointer' }}>
            {isDark ? '☀ Light' : '🌙 Dark'}
          </button>
          <Link href="/login" style={{ padding: '7px 16px', borderRadius: 999, border: `1px solid ${cardBorder}`, color: textSecondary, fontSize: 13, fontWeight: 600, textDecoration: 'none', background: isDark ? 'transparent' : 'rgba(255,255,255,0.7)' }}>Log in</Link>
          <Link href="/signup" style={{ padding: '8px 18px', borderRadius: 999, background: accentBlue, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(14,165,233,0.4)' }}>Get started →</Link>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── Hero ── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)', gap: 48, alignItems: 'center', padding: '56px 0 72px' }}>
          {/* Copy */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999, background: pillBg, border: `1px solid ${pillBorder}`, fontSize: 11, color: accentBlue, fontWeight: 600, marginBottom: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: accentBlue, display: 'inline-block' }} />
              Now with L0 AI deflection & multi-tenant SLAs
            </div>

            <h1 style={{ fontSize: 46, lineHeight: 1.06, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 18 }}>
              The AI support workspace{' '}
              <span style={{ background: `linear-gradient(90deg, ${accentBlue}, ${accentIndigo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                built for education
              </span>
              .
            </h1>

            <p style={{ fontSize: 16, lineHeight: 1.75, color: textSecondary, maxWidth: 520, marginBottom: 28 }}>
              GKT unifies chatbot, web forms, email and portal into one intelligent dashboard. AI resolves routine queries automatically — agents handle only what needs a human.
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
              <Link href="/signup" style={{ padding: '12px 28px', borderRadius: 999, background: `linear-gradient(90deg, ${accentBlue}, ${accentIndigo})`, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 6px 28px rgba(14,165,233,0.45)' }}>
                Start free trial
              </Link>
              <Link href="/pricing" style={{ padding: '12px 24px', borderRadius: 999, border: `1px solid ${cardBorder}`, color: textPrimary, fontSize: 14, fontWeight: 600, textDecoration: 'none', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)' }}>
                View pricing
              </Link>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: textSecondary }}>
              {['✓ Multi-campus & multi-tenant', '✓ L0 / L1 / L2 / L3 queue tiers', '✓ SLA monitoring & alerts', '✓ Live agent workspace'].map(f => (
                <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{f}</span>
              ))}
            </div>
          </div>

          {/* Dashboard mockup */}
          <div style={{ ...glassCard, padding: 18, boxShadow: isDark ? '0 32px 80px rgba(0,0,0,0.7)' : '0 24px 60px rgba(14,165,233,0.18)' }}>
            {/* Chrome */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#F87171','#FBBF24','#34D399'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: 999, background: isDark ? c : '#CBD5E1', display: 'inline-block' }} />)}
              </div>
              <div style={{ fontSize: 10, color: textSecondary, background: isDark ? 'rgba(255,255,255,0.05)' : '#EFF6FF', padding: '3px 10px', borderRadius: 6, border: `1px solid ${cardBorder}` }}>
                admin / dashboard
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[{ v:'64', l:'Open today', c:'#0EA5E9' }, { v:'98.2%', l:'SLA rate', c:'#4ADE80' }, { v:'7', l:'At risk', c:'#F97316' }].map(s => (
                <div key={s.l} style={{ ...glassCard, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: textSecondary, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Ticket rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {[
                { id:'TKT-041', subj:'Login issue — mobile app', pri:'P1', status:'In Progress', sc:'#0EA5E9' },
                { id:'TKT-040', subj:'Invoice not received', pri:'P2', status:'Open', sc:'#F59E0B' },
                { id:'TKT-039', subj:'Password reset broken', pri:'P1', status:'Resolved', sc:'#4ADE80' },
              ].map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(239,246,255,0.8)', border: `1px solid ${cardBorder}` }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: t.sc, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subj}</span>
                  <span style={{ fontSize: 10, color: textSecondary, flexShrink: 0 }}>{t.id}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: `${t.sc}22`, color: t.sc, flexShrink: 0 }}>{t.status}</span>
                </div>
              ))}
            </div>

            {/* AI bot bubble */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 10, background: isDark ? 'rgba(14,165,233,0.08)' : 'rgba(219,234,254,0.6)', border: `1px solid ${isDark ? 'rgba(14,165,233,0.2)' : 'rgba(147,197,253,0.5)'}` }}>
              <div style={{ width: 24, height: 24, borderRadius: 999, background: 'linear-gradient(135deg,#0EA5E9,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>🤖</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: accentBlue, marginBottom: 2 }}>L0 AI Bot</div>
                <div style={{ fontSize: 11, color: textSecondary, lineHeight: 1.4 }}>Found 3 KB matches for TKT-041. Auto-reply sent — awaiting user confirmation.</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Social proof strip ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '18px 0 48px', borderTop: `1px solid ${sectionBorder}`, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: textSecondary, fontWeight: 500 }}>TRUSTED BY TEAMS AT</span>
          {['State University', 'EduTech Labs', 'CampusConnect', 'LMS Group', 'AcademiaCo'].map(n => (
            <span key={n} style={{ fontSize: 13, fontWeight: 700, color: isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.55)', letterSpacing: '0.04em' }}>{n}</span>
          ))}
        </div>

        {/* ── How it works ── */}
        <section style={{ marginBottom: 72 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: accentBlue, background: pillBg, border: `1px solid ${pillBorder}`, padding: '4px 12px', borderRadius: 999, marginBottom: 12 }}>HOW IT WORKS</div>
            <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>From request to resolution in seconds</h2>
            <p style={{ fontSize: 14, color: textSecondary, maxWidth: 520, margin: '0 auto' }}>AI handles the routine. Agents focus on what matters. Every step is tracked and SLA-governed.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14 }}>
            {[
              { step:'01', icon:'📥', title:'User submits', body:'Via chatbot, web form, email, or portal — all unified in one inbox.', color:'#0EA5E9' },
              { step:'02', icon:'🤖', title:'AI triages', body:'L0 bot classifies intent, searches the knowledge base, and replies instantly.', color:'#6366F1' },
              { step:'03', icon:'🎯', title:'Smart routing', body:'Unresolved tickets escalate to L1/L2/L3 queues with full AI context attached.', color:'#F59E0B' },
              { step:'04', icon:'✅', title:'Resolved & tracked', body:'Agents close tickets; SLA, CSAT, and deflection metrics update in real time.', color:'#4ADE80' },
            ].map(s => (
              <div key={s.step} style={{ ...glassCard, padding: '20px 16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 28, fontWeight: 900, color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(14,165,233,0.08)', lineHeight: 1 }}>{s.step}</div>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{s.icon}</div>
                <div style={{ fontSize: 3, height: 3, width: 24, borderRadius: 999, background: s.color, marginBottom: 10 }} />
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: textPrimary }}>{s.title}</div>
                <div style={{ fontSize: 12, color: textSecondary, lineHeight: 1.6 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Feature cards (3-col) ── */}
        <section style={{ marginBottom: 72 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: accentIndigo, background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(224,231,255,0.9)', border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(199,210,254,0.8)'}`, padding: '4px 12px', borderRadius: 999, marginBottom: 12 }}>PLATFORM FEATURES</div>
            <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>Everything your support team needs</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            {[
              { icon:'🧠', title:'L0 AI Deflection', body:'Knowledge-base-powered bot resolves 60–70% of tickets before a human sees them.', color:'#0EA5E9' },
              { icon:'🏷️', title:'Intelligent Triage', body:'Auto-classify priority, category, and assigned team based on message intent.', color:'#6366F1' },
              { icon:'⏱️', title:'SLA Governance', body:'Per-priority SLA timers with breach warnings and auto-escalation rules.', color:'#F59E0B' },
              { icon:'💬', title:'Live Agent Chat', body:'Real-time WebSocket conversations between agents and end-users, fully logged.', color:'#4ADE80' },
              { icon:'🏢', title:'Multi-tenant', body:'Isolated tenants with independent branding, SLAs, teams, and KB articles.', color:'#F472B6' },
              { icon:'📊', title:'Analytics & Reports', body:'Deflection rates, queue health, SLA trends, and agent productivity at a glance.', color:'#A78BFA' },
            ].map(f => (
              <div key={f.title} style={{ ...glassCard, padding: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${f.color}18`, border: `1px solid ${f.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: textPrimary }}>{f.title}</div>
                <div style={{ fontSize: 12, color: textSecondary, lineHeight: 1.65 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stats banner ── */}
        <section style={{ ...glassCard, padding: '36px 40px', marginBottom: 72, background: isDark ? 'linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.1))' : 'linear-gradient(135deg,rgba(219,234,254,0.9),rgba(224,231,255,0.85))', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 24, textAlign: 'center' }}>
          {[
            { value: '94%', label: 'Avg SLA compliance', color: '#4ADE80' },
            { value: '68%', label: 'L0 deflection rate', color: '#0EA5E9' },
            { value: '< 90s', label: 'Median first response', color: '#A78BFA' },
            { value: '3×', label: 'Agent throughput lift', color: '#F59E0B' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 34, fontWeight: 900, color: s.color, letterSpacing: '-0.04em' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </section>

        {/* ── Persona section ── */}
        <section style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 24, textAlign: 'center' }}>Built for every role in your team</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            {[
              { role:'Students & Faculty', icon:'🎓', color:'#0EA5E9', items:['Submit via chatbot, form, or email', 'Instant AI answers from knowledge base', 'Live ticket status & history portal'] },
              { role:'Support Agents', icon:'🧑‍💻', color:'#6366F1', items:['AI-summarised ticket context', 'L1 / L2 / L3 queue assignment', 'Real-time chat & internal notes'] },
              { role:'Admins & Ops', icon:'⚙️', color:'#F59E0B', items:['Multi-tenant SLA configuration', 'Escalation rules & branding', 'Deflection, queue & SLA analytics'] },
            ].map(p => (
              <div key={p.role} style={{ ...glassCard, padding: 22 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{p.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: p.color, marginBottom: 12 }}>{p.role}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {p.items.map(i => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
                      <span style={{ color: p.color, fontWeight: 700, flexShrink: 0 }}>→</span>{i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 24, textAlign: 'center' }}>What teams are saying</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            {[
              { quote: '"The L0 bot deflected 70% of our tickets in the first week. Agents now focus on complex issues only."', name: 'Priya M.', role: 'IT Head, State University' },
              { quote: '"Multi-tenant setup lets each department have its own SLA and branding. Incredibly flexible."', name: 'Rahul S.', role: 'Ops Manager, EduTech Labs' },
              { quote: '"Live chat with full ticket history in one view — our agents love not switching between tools."', name: 'Asha K.', role: 'Support Lead, CampusConnect' },
            ].map(t => (
              <div key={t.name} style={{ ...glassCard, padding: 22 }}>
                <div style={{ fontSize: 28, color: accentBlue, marginBottom: 8, lineHeight: 1 }}>"</div>
                <p style={{ fontSize: 13, color: textSecondary, lineHeight: 1.7, margin: '0 0 16px' }}>{t.quote}</p>
                <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{t.name}</div>
                <div style={{ fontSize: 11, color: textSecondary }}>{t.role}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA banner ── */}
        <section style={{ ...glassCard, padding: '52px 40px', textAlign: 'center', background: isDark ? 'linear-gradient(135deg,rgba(14,165,233,0.14),rgba(99,102,241,0.12))' : 'linear-gradient(135deg,rgba(219,234,254,0.95),rgba(224,231,255,0.9))', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: isDark ? 'rgba(14,165,233,0.08)' : 'rgba(147,197,253,0.25)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(199,210,254,0.3)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 12 }}>
              Ready to transform your{' '}
              <span style={{ background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>support operations?</span>
            </h2>
            <p style={{ fontSize: 15, color: textSecondary, marginBottom: 28, maxWidth: 480, margin: '0 auto 28px' }}>
              Set up in minutes. No credit card required. See your first AI-deflected ticket today.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/signup" style={{ padding: '13px 32px', borderRadius: 999, background: `linear-gradient(90deg,${accentBlue},${accentIndigo})`, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 6px 28px rgba(14,165,233,0.45)' }}>
                Start free trial
              </Link>
              <Link href="/pricing" style={{ padding: '13px 24px', borderRadius: 999, border: `1px solid ${cardBorder}`, color: textPrimary, fontSize: 14, fontWeight: 600, textDecoration: 'none', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)' }}>
                See pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: `1px solid ${sectionBorder}`, padding: '28px 24px', maxWidth: 1140, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: textSecondary }}>
        <span>© 2026 GKT AI Ticketing. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[['Docs', '/dev-hub'], ['Pricing', '/pricing'], ['Login', '/login'], ['Sign up', '/signup']].map(([l, h]) => (
            <Link key={l} href={h} style={{ color: textSecondary, textDecoration: 'none', fontWeight: 500 }}>{l}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
