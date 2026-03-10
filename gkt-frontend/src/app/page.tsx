'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';

export default function appPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme !== 'light';

  const bgPrimary = isDark ? '#0F172A' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const accentBrand = '#FACC15';
  const cardBg = isDark ? '#020617' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(148,163,184,0.35)' : '#E5E7EB';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: bgPrimary,
        color: textPrimary,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      }}
    >
      {/* Top nav */}
      <header
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: accentBrand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 800,
              color: '#000',
            }}
          >
            G
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>GKT AI Ticketing</div>
            <div style={{ fontSize: 11, color: textSecondary }}>Multi-tenant AI support for education</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${borderColor}`,
              background: 'transparent',
              color: textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              cursor: 'pointer',
            }}
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <Link
            href="/login"
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: `1px solid ${borderColor}`,
              color: textSecondary,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            style={{
              padding: '9px 18px',
              borderRadius: 999,
              background: accentBrand,
              color: '#000',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '32px 24px 48px',
        }}
      >
        {/* Hero section */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
            gap: 48,
            alignItems: 'center',
            marginBottom: 48,
          }}
        >
          {/* Left copy */}
          <div>
            <h1
              style={{
                fontSize: 40,
                lineHeight: 1.1,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                marginBottom: 16,
              }}
            >
              AI-first ticketing for{' '}
              <span style={{ color: accentBrand }}>multi-tenant education teams</span>.
            </h1>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: textSecondary,
                maxWidth: 540,
                marginBottom: 20,
              }}
            >
              Bring web forms, chatbot, and email into a single AI-powered workspace. Deflect FAQs with an L0
              bot, route complex tickets to L1/L2/L3, and keep every tenant on SLA.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: 18 }}>
              <Link
                href="/signup"
                style={{
                  padding: '11px 20px',
                  borderRadius: 999,
                  background: accentBrand,
                  color: '#000',
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Create your account
              </Link>
              <Link
                href="/login"
                style={{
                  padding: '11px 18px',
                  borderRadius: 999,
                  border: `1px solid ${borderColor}`,
                  color: textPrimary,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Already using GKT? Log in
              </Link>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: 12,
                color: textSecondary,
              }}
            >
              <span>✓ Multi-tenant & multi-product</span>
              <span>✓ L0 bot + L1/L2/L3 escalation</span>
              <span>✓ SLA dashboards & real-time agent chat</span>
            </div>
          </div>

          {/* Right: compact system snapshot */}
          <div>
            <div
              style={{
                borderRadius: 16,
                border: `1px solid ${borderColor}`,
                background: cardBg,
                padding: 20,
                boxShadow: isDark
                  ? '0 18px 45px rgba(15,23,42,0.8)'
                  : '0 16px 40px rgba(15,23,42,0.12)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: textSecondary }}>Live queues</div>
                <div
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: isDark ? 'rgba(34,197,94,0.16)' : '#DCFCE7',
                    color: isDark ? '#4ADE80' : '#16A34A',
                    fontWeight: 600,
                  }}
                >
                  SLA healthy
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 10,
                  marginBottom: 16,
                  fontSize: 11,
                }}
              >
                {[
                  { label: 'New', value: '42', color: '#38BDF8' },
                  { label: 'In SLA', value: '128', color: accentBrand },
                  { label: 'At risk', value: '5', color: '#F97316' },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: '10px 10px',
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: `1px dashed ${borderColor}`,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: textSecondary }}>Tenant: ABC University</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: isDark ? '#1E293B' : '#EEF2FF',
                      color: isDark ? '#C4B5FD' : '#4F46E5',
                      fontWeight: 600,
                    }}
                  >
                    L0 bot
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: isDark ? '#020617' : '#E5E7EB',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '72%',
                      height: '100%',
                      background: accentBrand,
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: textSecondary, marginTop: 6 }}>
                  72% of tickets auto-resolved at L0 last week.
                </div>
              </div>

              <div style={{ fontSize: 11, color: textSecondary, marginTop: 8 }}>
                Trusted by internal IT, student success, and exam ops teams to keep tickets flowing and SLAs
                green.
              </div>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Why teams choose GKT</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 16,
              fontSize: 13,
            }}
          >
            <div
              style={{
                borderRadius: 12,
                border: `1px solid ${borderColor}`,
                padding: 16,
                background: cardBg,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Unified intake</div>
              <p style={{ margin: 0, color: textSecondary }}>
                Webforms, chatbot, and email all feed one ticket inbox with consistent SLAs and routing.
              </p>
            </div>
            <div
              style={{
                borderRadius: 12,
                border: `1px solid ${borderColor}`,
                padding: 16,
                background: cardBg,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>AI L0 + escalation</div>
              <p style={{ margin: 0, color: textSecondary }}>
                Let the L0 bot handle FAQs and pass rich context to L1/L2/L3 agents when humans are needed.
              </p>
            </div>
            <div
              style={{
                borderRadius: 12,
                border: `1px solid ${borderColor}`,
                padding: 16,
                background: cardBg,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Multi-tenant by design</div>
              <p style={{ margin: 0, color: textSecondary }}>
                Clean separation of tenants, SLAs, and branding for university, department, or product lines.
              </p>
            </div>
          </div>
        </section>

        {/* Typical ticketing flows */}
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
              <li>Submit support tickets from portal or widget</li>
              <li>Track status and respond in real time</li>
              <li>Search knowledge base to self-serve</li>
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>For support agents</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>AI summaries on every ticket</li>
              <li>L1 / L2 / L3 queues with SLAs</li>
              <li>Real-time chat and internal notes</li>
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>For admins</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Configure tenants, SLAs, and escalation rules</li>
              <li>White-label branding per product</li>
              <li>Monitor deflection and SLA performance</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
