'use client';

import React, { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';

  // Shared tokens with landing page
  const navyBackground = isDark ? '#020617' : '#0F172A';
  const surfaceBackground = isDark ? '#020617' : '#F9FAFB';
  const textPrimary = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const electricBlue = '#0EA5E9';
  const cardBg = isDark ? '#020617' : '#FFFFFF';
  const inputBg = isDark ? 'rgba(15,23,42,0.85)' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(148,163,184,0.45)' : '#E5E7EB';
  const accentBrand = '#0EA5E9';

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: textPrimary,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
  };

  const ssoButtonStyle: CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 6,
    border: `1px solid ${inputBorder}`,
    background: 'transparent',
    color: textPrimary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
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

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      const { setAuth } = useAuthStore.getState();
      setAuth(data.user, data.token);
      localStorage.setItem('gkt_token', data.token);
      if (data.refresh_token) localStorage.setItem('gkt_refresh_token', data.refresh_token);
      localStorage.setItem('gkt_user', JSON.stringify(data.user));

      if (data.user.role === 'super_admin') {
        router.push('/super-admin/products');
      } else if (data.user.role === 'tenant_admin') {
        router.push('/admin/dashboard');
      } else if (data.user.role === 'l1_agent' || data.user.role === 'l2_agent' || data.user.role === 'l3_agent') {
        router.push('/agent/dashboard');
      } else {
        router.push('/portal/dashboard');
      }
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
            gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
            gap: 40,
            alignItems: 'center',
          }}
        >
          {/* Left: login form card */}
          <div
            style={{
              borderRadius: 18,
              padding: 24,
              border: `1px solid ${inputBorder}`,
              background: cardBg,
            }}
          >
            <div style={{ display: 'flex', marginBottom: 32, borderBottom: `1px solid ${inputBorder}` }}>
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
                Log In
              </button>
              <Link
                href="/signup"
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'transparent',
                  color: textSecondary,
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: 'none',
                }}
              >
                Sign Up
              </Link>
            </div>

            <button
              type="button"
              style={ssoButtonStyle}
              onMouseOver={(e) =>
                (e.currentTarget as HTMLButtonElement).style.background = isDark
                  ? 'rgba(15,23,42,0.9)'
                  : surfaceBackground
              }
              onMouseOut={(e) =>
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }
            >
              Log in with Google
            </button>

            <button
              type="button"
              style={ssoButtonStyle}
              onMouseOver={(e) =>
                (e.currentTarget as HTMLButtonElement).style.background = isDark
                  ? 'rgba(15,23,42,0.9)'
                  : surfaceBackground
              }
              onMouseOut={(e) =>
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }
            >
              Log in with Microsoft
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                textAlign: 'center',
                margin: '24px 0',
                color: textSecondary,
              }}
            >
              <div style={{ flex: 1, height: 1, background: inputBorder }} />
              <span style={{ margin: '0 12px', fontSize: 13, fontWeight: 500 }}>Or</span>
              <div style={{ flex: 1, height: 1, background: inputBorder }} />
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8,
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

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 8,
                  background: accentBrand,
                  color: '#000',
                  fontSize: 14,
                  fontWeight: 700,
                  border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? 'Processing...' : 'Log In'}
              </button>
            </form>
          </div>

          {/* Right: ticketing visualization */}
          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${inputBorder}`,
              background: isDark ? '#020617' : surfaceBackground,
              padding: 20,
            }}
          >
            {/* Simple illustrative block; can be refined further */}
          </div>
        </div>
      </div>
    </div>
  );
}
