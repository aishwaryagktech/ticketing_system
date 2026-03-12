'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

export default function SignupPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    job_title: '',
    company: '',
    number_of_employees: '',
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';

  const navyBackground = isDark ? '#020617' : '#0F172A';
  const surfaceBackground = isDark ? '#020617' : '#F9FAFB';
  const textPrimary = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const electricBlue = '#0EA5E9';
  const cardBg = isDark ? '#020617' : '#FFFFFF';
  const inputBg = isDark ? 'rgba(15,23,42,0.8)' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(148,163,184,0.45)' : '#E5E7EB';
  const accentBrand = '#0EA5E9';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: textPrimary,
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          number_of_employees: form.number_of_employees
            ? Number(form.number_of_employees)
            : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account');
        setIsLoading(false);
        return;
      }

      // Account created successfully – send user to login
      router.push('/login');
    } catch (err) {
      console.error(err);
      setError('Network error. Please ensure the backend is running.');
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        padding: '32px 16px',
        background: isDark
          ? `radial-gradient(circle at top left, #1D4ED8 0, ${navyBackground} 45%, #020617 100%)`
          : `radial-gradient(circle at top left, #FFFFFF 0, #F3F4F6 40%, #E5E7EB 100%)`,
        color: textPrimary,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1120,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        {/* Brand header (matches landing page) */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: isDark ? '#1D4ED8' : '#DBEAFE',
              border: `1px solid ${inputBorder}`,
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
        </Link>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
            gap: 40,
            alignItems: 'center',
          }}
        >
          {/* Left: signup form card */}
          <div
            style={{
              borderRadius: 18,
              padding: 24,
              border: `1px solid ${inputBorder}`,
              background: cardBg,
              boxShadow: isDark
                ? '0 26px 70px rgba(15,23,42,0.95)'
                : '0 22px 60px rgba(15,23,42,0.25)',
            }}
          >
        <div style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              marginBottom: 32,
              borderBottom: `1px solid ${inputBorder}`,
            }}
          >
            <Link
              href="/login"
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                color: textSecondary,
                border: 'none',
                textAlign: 'center',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Log In
            </Link>
            <button
              style={{
                flex: 1,
                padding: '12px',
                background: electricBlue,
                color: '#0B1120',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Sign Up
            </button>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Create your GKT account</h1>
          <p style={{ fontSize: 14, color: textSecondary, marginBottom: 20 }}>
            We&apos;ll use these details to set up your company (tenant) and your first user.
          </p>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: 13,
                marginBottom: 20,
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: textSecondary,
                    marginBottom: 6,
                    display: 'block',
                  }}
                >
                  First name
                </label>
                <input
                  style={inputStyle}
                  value={form.first_name}
                  onChange={(e) => updateField('first_name', e.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: textSecondary,
                    marginBottom: 6,
                    display: 'block',
                  }}
                >
                  Last name
                </label>
                <input
                  style={inputStyle}
                  value={form.last_name}
                  onChange={(e) => updateField('last_name', e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: textSecondary,
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Work email
              </label>
              <input
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: textSecondary,
                    marginBottom: 6,
                    display: 'block',
                  }}
                >
                  Phone
                </label>
                <input
                  style={inputStyle}
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: textSecondary,
                    marginBottom: 6,
                    display: 'block',
                  }}
                >
                  Job title
                </label>
                <input
                  style={inputStyle}
                  value={form.job_title}
                  onChange={(e) => updateField('job_title', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: textSecondary,
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Company (tenant)
              </label>
              <input
                style={inputStyle}
                value={form.company}
                onChange={(e) => updateField('company', e.target.value)}
                required
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: textSecondary,
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Number of employees
              </label>
              <input
                type="number"
                min={1}
                style={inputStyle}
                value={form.number_of_employees}
                onChange={(e) => updateField('number_of_employees', e.target.value)}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: textSecondary,
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Password
              </label>
              <input
                type="password"
                style={inputStyle}
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                marginTop: 8,
                padding: '12px',
                borderRadius: 8,
                background: accentBrand,
                color: '#000',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.8 : 1,
              }}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>

            <p style={{ fontSize: 12, color: textSecondary, marginTop: 8 }}>
              By creating an account you agree that the company you enter will be created as a tenant in
              the GKT AI Ticketing platform.
            </p>
          </form>
        </div>
        </div>

          {/* Right: tenant summary illustration */}
          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${inputBorder}`,
              background: isDark ? '#020617' : surfaceBackground,
              position: 'relative',
              overflow: 'hidden',
              padding: 20,
              boxShadow: isDark
                ? '0 26px 70px rgba(15,23,42,0.95)'
                : '0 22px 60px rgba(15,23,42,0.25)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isDark
                  ? 'radial-gradient(circle at top left, rgba(56,189,248,0.25), transparent 55%)'
                  : 'radial-gradient(circle at top left, rgba(56,189,248,0.15), transparent 55%)',
                opacity: 0.7,
              }}
            />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 13, color: textSecondary, marginBottom: 8 }}>Example tenant</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>ABC University</div>
              <div style={{ fontSize: 12, color: textSecondary, marginBottom: 12 }}>
                Student success, IT helpdesk, and exam support all running on one AI ticketing workspace.
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 10,
                  fontSize: 11,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ color: textSecondary, marginBottom: 2 }}>Agents</div>
                  <div style={{ fontWeight: 700 }}>18</div>
                </div>
                <div>
                  <div style={{ color: textSecondary, marginBottom: 2 }}>Tickets / month</div>
                  <div style={{ fontWeight: 700 }}>3.2k</div>
                </div>
                <div>
                  <div style={{ color: textSecondary, marginBottom: 2 }}>L0 deflection</div>
                  <div style={{ fontWeight: 700, color: electricBlue }}>68%</div>
                </div>
              </div>

              <div
                style={{
                  borderRadius: 14,
                  border: `1px solid ${inputBorder}`,
                  background: cardBg,
                  padding: 14,
                  fontSize: 11,
                }}
              >
                <div style={{ color: textSecondary, marginBottom: 6 }}>Provisioning steps</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: textSecondary }}>
                  <li>Create tenant workspace</li>
                  <li>Add initial admins & agents</li>
                  <li>Connect channels and SLAs</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
