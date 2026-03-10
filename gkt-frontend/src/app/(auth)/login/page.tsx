'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

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

  // Apollo-inspired Global UI Tokens
  const bgPrimary = isDark ? '#0F172A' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const inputBg = isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';
  const accentBrand = '#FACC15'; // Vibrant Apollo Yellow

  const handleLogin = async (e: React.FormEvent) => {
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

      localStorage.setItem('gkt_token', data.token);
      if (data.refresh_token) localStorage.setItem('gkt_refresh_token', data.refresh_token);
      localStorage.setItem('gkt_user', JSON.stringify(data.user));

      if (data.user.role === 'super_admin') {
        router.push('/super-admin/products');
      } else if (data.user.role === 'tenant_admin') {
        router.push('/admin/dashboard');
      } else if (data.user.role === 'l1_agent' || data.user.role === 'l2_agent') {
        router.push('/agent/queue');
      } else {
        router.push('/portal/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please ensure the backend is running.');
      setIsLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: textPrimary,
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const ssoButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '6px',
    border: `1px solid ${inputBorder}`,
    background: 'transparent',
    color: textPrimary,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '12px',
    transition: 'background 0.2s',
  };

  // Prevent hydration mismatch
  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bgPrimary, color: textPrimary, fontFamily: 'sans-serif', width: '100%' }}>
      
      {/* Left Column: Login Form */}
      <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          
          <div style={{ display: 'flex', marginBottom: '40px', borderBottom: `1px solid ${inputBorder}` }}>
            <button style={{ flex: 1, padding: '12px', background: textPrimary, color: bgPrimary, border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 700, fontSize: '14px' }}>Log In</button>
            <Link href="/signup" style={{ flex: 1, padding: '12px', background: 'transparent', color: textSecondary, border: 'none', textAlign: 'center', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>Sign Up</Link>
          </div>

          <button style={ssoButtonStyle} onMouseOver={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB')} onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Log in with Google
          </button>
          
          <button style={ssoButtonStyle} onMouseOver={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB')} onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}>
            <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
              <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
              <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
              <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
            </svg>
            Log in with Microsoft
          </button>

          <div style={{ display: 'flex', alignItems: 'center', textAlign: 'center', margin: '24px 0', color: textSecondary }}>
            <div style={{ flex: 1, height: '1px', background: inputBorder }}></div>
            <span style={{ margin: '0 12px', fontSize: '13px', fontWeight: 500 }}>Or</span>
            <div style={{ flex: 1, height: '1px', background: inputBorder }}></div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', marginBottom: '20px', textAlign: 'center', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Email</label>
              <input
                type="email"
                placeholder="project@gktech.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = accentBrand)}
                onBlur={(e) => (e.target.style.borderColor = inputBorder)}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: textSecondary, marginBottom: '6px', display: 'block' }}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = accentBrand)}
                onBlur={(e) => (e.target.style.borderColor = inputBorder)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                marginTop: '8px',
                padding: '12px',
                borderRadius: '8px',
                background: accentBrand,
                color: '#000000',
                fontSize: '14px',
                fontWeight: 700,
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                opacity: isLoading ? 0.8 : 1,
              }}
            >
              {isLoading ? 'Processing...' : 'Log In'}
            </button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: textSecondary, cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: accentBrand }} /> Keep me signed in
              </label>
              <Link href="/forgot-password" style={{ fontSize: '13px', color: isDark ? '#60A5FA' : '#2563EB', textDecoration: 'none', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>
          </form>

          <div style={{ marginTop: '80px', fontSize: '12px', color: textSecondary, textAlign: 'center' }}>
            2026 All Rights Reserved.<br />
            Privacy and Terms.
          </div>
        </div>
      </div>

      {/* Right Column: Hero / Graphic Area simulating Apollo's light blue trapezoid structure */}
      <div style={{ 
        flex: '1 1 50%', 
        position: 'relative', 
        overflow: 'hidden', 
        background: bgPrimary,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '60px',
        minWidth: 0 // Prevents flex children from overflowing 
      }}>
        {/* Abstract structural shape matching Apollo */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '120%',
          background: isDark ? '#1E293B' : '#E2E8F0',
          clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)',
          zIndex: 0
        }}></div>

        {/* Content stacked on top of the shape */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '400px', textAlign: 'center' }}>
          
          {/* Mock Apollo extension card graphic */}
          <div style={{ 
            background: isDark ? '#0F172A' : '#FFFFFF', 
            borderRadius: '12px', 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: `1px solid ${inputBorder}`,
            padding: '24px',
            marginBottom: '40px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', background: accentBrand, borderRadius: '2px' }}></div>
                GKT Agent
              </div>
              <div style={{ color: textSecondary, fontSize: '18px' }}>×</div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', borderBottom: `1px solid ${inputBorder}`, paddingBottom: '16px', marginBottom: '16px' }}>
              <button style={{ padding: '6px 16px', background: isDark ? '#1E293B' : '#111827', color: isDark ? '#FFFFFF' : '#FFFFFF', borderRadius: '4px', border: 'none', fontSize: '12px', fontWeight: 600 }}>Person</button>
              <button style={{ padding: '6px 16px', background: 'transparent', color: textSecondary, border: 'none', fontSize: '12px', fontWeight: 600 }}>Company</button>
            </div>

            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700 }}>Tim Zheng</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: textSecondary }}>CEO & Founder at GKT</p>
              <span style={{ background: isDark ? 'rgba(16, 185, 129, 0.1)' : '#DCFCE7', color: isDark ? '#34D399' : '#15803D', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>ZoomInfo Match</span>
            </div>
          </div>

          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: textPrimary }}>800,000+</h2>
          <p style={{ fontSize: '15px', color: textPrimary, lineHeight: 1.5, marginBottom: '24px', fontWeight: 500 }}>
            Salespeople and marketers use our extension to prospect, connect, and convert leads faster.
          </p>
          <button style={{ padding: '10px 20px', background: isDark ? '#1E293B' : '#FFFFFF', border: `1px solid ${inputBorder}`, borderRadius: '6px', color: textPrimary, fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            Get GKT Chrome Extension
          </button>
        </div>
      </div>
    </div>
  );
}
