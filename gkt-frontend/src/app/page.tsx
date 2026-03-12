'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';

export default function appPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme !== 'light';

  const navyBackground = isDark ? '#020617' : '#0F172A';
  const surfaceBackground = isDark ? '#020617' : '#F9FAFB';
  const textPrimary = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const electricBlue = '#0EA5E9';
  const subtleBlue = isDark ? '#1D4ED8' : '#DBEAFE';
  const cardBg = isDark ? '#020617' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(148,163,184,0.45)' : '#E5E7EB';
  const mutedBorder = isDark ? 'rgba(30,64,175,0.55)' : '#E0F2FE';
  const pillBackground = isDark ? 'rgba(15,23,42,0.85)' : '#EEF2FF';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: isDark
          ? `radial-gradient(circle at top left, #1D4ED8 0, ${navyBackground} 45%, #020617 100%)`
          : `radial-gradient(circle at top left, #FFFFFF 0, #F3F4F6 40%, #E5E7EB 100%)`,
        color: textPrimary,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      }}
    >
      {/* Top nav */}
      <header
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: `1px solid ${mutedBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: subtleBlue,
              border: `1px solid ${mutedBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: electricBlue,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>GKT AI Ticketing</span>
            <span style={{ fontSize: 11, color: textSecondary }}>Modern AI workspace for education teams</span>
          </div>
        </div>

        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            fontSize: 12,
            color: textSecondary,
          }}
        >
          <Link href="/dev-hub" style={{ textDecoration: 'none', color: textSecondary }}>
            Docs
          </Link>
          <Link href="/support" style={{ textDecoration: 'none', color: textSecondary }}>
            Support
          </Link>
          <Link href="/pricing" style={{ textDecoration: 'none', color: textSecondary }}>
            Pricing
          </Link>
        </nav>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${borderColor}`,
              background: pillBackground,
              color: textSecondary,
              fontSize: 11,
              cursor: 'pointer',
            }}
            aria-label="Toggle theme"
          >
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 999,
                border: `1px solid ${borderColor}`,
                background: isDark ? electricBlue : '#F9FAFB',
              }}
            />
            <span>{isDark ? 'Dark' : 'Light'} mode</span>
          </button>
          <Link
            href="/login"
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              border: `1px solid ${borderColor}`,
              color: textSecondary,
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              background: electricBlue,
              color: '#0B1120',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 10px 30px rgba(14,165,233,0.35)',
            }}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '32px 24px 48px',
        }}
      >
        {/* Hero section */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
            gap: 48,
            alignItems: 'center',
            marginBottom: 56,
          }}
        >
          {/* Left copy */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                borderRadius: 999,
                background: pillBackground,
                border: `1px solid ${mutedBorder}`,
                fontSize: 11,
                color: textSecondary,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: electricBlue,
                }}
              />
              <span>Autonomous AI support workspace</span>
            </div>

            <h1
              style={{
                fontSize: 40,
                lineHeight: 1.05,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                marginBottom: 16,
              }}
            >
              Meet the AI workspace that{' '}
              <span style={{ color: electricBlue }}>orchestrates every ticket</span>.
            </h1>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: textSecondary,
                maxWidth: 540,
                marginBottom: 18,
              }}
            >
              GKT brings web forms, chatbot, email, and portal requests into one clean SaaS dashboard. Let AI
              resolve routine questions, route complex work to the right queue, and keep every tenant on SLA.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                fontSize: 12,
                color: textSecondary,
              }}
            >
              <span>✓ Multi-tenant & multi-campus ready</span>
              <span>✓ AI L0 bot + L1/L2/L3 queues</span>
              <span>✓ SLA dashboard & live agent workspace</span>
            </div>
          </div>

          {/* Right: dashboard snapshot */}
          <div>
            <div
              style={{
                borderRadius: 18,
                border: `1px solid ${mutedBorder}`,
                background: cardBg,
                padding: 18,
                boxShadow: isDark
                  ? '0 26px 70px rgba(15,23,42,0.95)'
                  : '0 22px 60px rgba(15,23,42,0.25)',
              }}
            >
              {/* Window chrome */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#4B5563', '#0EA5E9', '#22C55E'].map((c) => (
                    <span
                      key={c}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: isDark ? c : '#E5E7EB',
                        border: `1px solid ${borderColor}`,
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: textSecondary }}>Workspace overview</span>
              </div>

              {/* Top metrics row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 10,
                  marginBottom: 14,
                  fontSize: 11,
                }}
              >
                {[
                  { label: 'New today', value: '64', tone: electricBlue },
                  { label: 'Within SLA', value: '212', tone: '#22C55E' },
                  { label: 'At risk', value: '7', tone: '#F97316' },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: '9px 9px',
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                      background: isDark ? '#020617' : '#F9FAFB',
                    }}
                  >
                    <div style={{ fontSize: 11, color: textSecondary, marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.tone }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Queues + AI specialists */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
                  gap: 10,
                  fontSize: 11,
                }}
              >
                {/* Queues */}
                <div
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${borderColor}`,
                    padding: 10,
                    background: isDark ? '#020617' : '#F9FAFB',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 11, color: textSecondary }}>Queues</span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isDark ? 'rgba(22,163,74,0.18)' : '#DCFCE7',
                        color: isDark ? '#4ADE80' : '#166534',
                        fontWeight: 600,
                      }}
                    >
                      SLA healthy
                    </span>
                  </div>
                  {[
                    { name: 'Student IT', load: 42, sla: '99.3%' },
                    { name: 'Faculty support', load: 18, sla: '98.1%' },
                    { name: 'Exam operations', load: 9, sla: '97.4%' },
                  ].map((q) => (
                    <div
                      key={q.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 11 }}>{q.name}</span>
                        <span style={{ fontSize: 10, color: textSecondary }}>{q.load} open</span>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          marginLeft: 8,
                          height: 5,
                          borderRadius: 999,
                          background: isDark ? '#020617' : '#E5E7EB',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(q.load * 2, 100)}%`,
                            height: '100%',
                            background: electricBlue,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 10, color: textSecondary }}>{q.sla}</span>
                    </div>
                  ))}
                </div>

                {/* AI specialists list with monochromatic icons */}
                <div
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${borderColor}`,
                    padding: 10,
                    background: isDark ? '#020617' : '#F9FAFB',
                  }}
                >
                  <div style={{ fontSize: 11, color: textSecondary, marginBottom: 6 }}>AI specialists</div>
                  {['L0 deflection bot', 'Agent co-pilot', 'SLA watcher'].map((name) => (
                    <div
                      key={name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 0',
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 6,
                          border: `1px solid ${borderColor}`,
                          background: isDark ? '#020617' : '#EFF6FF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: electricBlue,
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 11 }}>{name}</span>
                        <span style={{ fontSize: 10, color: textSecondary }}>Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section
          style={{
            marginBottom: 40,
            padding: '20px 0 4px',
            borderTop: `1px solid ${borderColor}`,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Designed for modern education ops</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 16,
              fontSize: 13,
            }}
          >
            {[
              {
                title: 'Unified intake',
                body: 'Forms, chatbot, email, and portal all feed one AI-first ticketing workspace.',
              },
              {
                title: 'AI-first routing',
                body: 'L0 bot answers FAQs and passes rich summaries and intent to L1/L2/L3 queues.',
              },
              {
                title: 'Multi-tenant by design',
                body: 'Separate tenants, SLAs, and branding for every campus, department, or product line.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${borderColor}`,
                  padding: 16,
                  background: surfaceBackground,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 8,
                    border: `1px solid ${borderColor}`,
                    background: isDark ? '#020617' : '#EFF6FF',
                    marginBottom: 8,
                  }}
                />
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{item.title}</div>
                <p style={{ margin: 0, color: textSecondary }}>{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Flows section */}
        <section
          style={{
            paddingTop: 12,
            borderTop: `1px solid ${borderColor}`,
            fontSize: 13,
            color: textSecondary,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 20,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>For students & faculty</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Submit requests from portal, widget, or email</li>
              <li>Get instant L0 answers and status updates</li>
              <li>Search knowledge base to self-serve</li>
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>For support agents</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>See AI summaries and next actions on every ticket</li>
              <li>Work from L1/L2/L3 queues with live SLAs</li>
              <li>Collaborate with internal notes and real-time chat</li>
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>For admins</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Configure tenants, SLAs, and escalation rules</li>
              <li>Brand each workspace to your department</li>
              <li>Monitor deflection, queue health, and SLA trends</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
