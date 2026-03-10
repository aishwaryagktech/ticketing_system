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

  const bgPrimary = isDark ? '#0F172A' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const inputBg = isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';
  const accentBrand = '#FACC15';

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
        display: 'flex',
        minHeight: '100vh',
        background: bgPrimary,
        color: textPrimary,
        fontFamily: 'sans-serif',
        width: '100%',
      }}
    >
      {/* Left: form */}
      <div
        style={{
          flex: '1 1 55%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 520 }}>
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
                background: textPrimary,
                color: bgPrimary,
                border: 'none',
                borderRadius: '4px 4px 0 0',
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

      {/* Right: simple visual */}
      <div
        style={{
          flex: '1 1 45%',
          position: 'relative',
          overflow: 'hidden',
          background: bgPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
          minWidth: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '120%',
            background: isDark ? '#1E293B' : '#E2E8F0',
            clipPath: 'polygon(18% 0, 100% 0, 100% 100%, 0% 100%)',
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 380,
            padding: 20,
            borderRadius: 16,
            border: `1px solid ${inputBorder}`,
            background: isDark ? '#020617' : '#FFFFFF',
            boxShadow: isDark
              ? '0 18px 45px rgba(15,23,42,0.8)'
              : '0 16px 40px rgba(15,23,42,0.12)',
          }}
        >
          <div style={{ fontSize: 13, color: textSecondary, marginBottom: 8 }}>Example tenant</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>ABC University</div>
          <div style={{ fontSize: 12, color: textSecondary, marginBottom: 12 }}>
            Student success, IT helpdesk, and exam support all running on one AI ticketing workspace.
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 8,
              fontSize: 11,
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
              <div style={{ fontWeight: 700, color: accentBrand }}>68%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
