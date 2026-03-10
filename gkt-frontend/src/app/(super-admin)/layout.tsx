'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';

const navItems = [
  { href: '/super-admin/products', label: 'Products', icon: '🏢' },
  { href: '/super-admin/billing', label: 'Billing', icon: '💳' },
  { href: '/super-admin/feature-flags', label: 'Feature Flags', icon: '🚩' },
  { href: '/api-keys', label: 'API Keys', icon: '🔑' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, hydrate, clearAuth } = useAuthStore();

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  // Role guard — redirect if not super_admin
  useEffect(() => {
    if (mounted && (!user || user.role !== 'super_admin')) {
      router.push('/login');
    }
  }, [mounted, user, router]);

  const isDark = mounted ? theme === 'dark' : true;

  // Apollo-inspired tokens from skill.md
  const bgPrimary = isDark ? '#0F172A' : '#FFFFFF';
  const surfaceBg = isDark ? '#1E293B' : '#FFFFFF';
  const mainBg = isDark ? '#0F172A' : '#F8F9FA';
  const textPrimary = isDark ? '#F8FAFC' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#4B5563';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';
  const headerBg = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)';
  const accentBrand = '#FACC15';

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  if (!mounted || !user || user.role !== 'super_admin') {
    return null; // Don't render until hydrated and authorized
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: mainBg, color: textPrimary, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: collapsed ? '72px' : '260px',
          background: isDark ? 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' : 'linear-gradient(180deg, #FFFFFF 0%, #F8F9FA 100%)',
          borderRight: `1px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 50,
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: collapsed ? '20px 16px' : '20px 24px',
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minHeight: '72px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: accentBrand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 800,
              color: '#000',
              flexShrink: 0,
            }}
          >
            G
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, letterSpacing: '-0.3px' }}>GKT Admin</div>
              <div style={{ fontSize: '11px', color: textSecondary, fontWeight: 500 }}>Super Admin Panel</div>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: collapsed ? '12px 16px' : '10px 16px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? (isDark ? '#000' : '#000') : textSecondary,
                  background: isActive ? accentBrand : 'transparent',
                  border: isActive ? `1px solid ${accentBrand}` : '1px solid transparent',
                  transition: 'all 0.2s ease',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div style={{ padding: '12px 8px', borderTop: `1px solid ${borderColor}` }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              border: `1px solid ${borderColor}`,
              background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
              color: textSecondary,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          marginLeft: collapsed ? '72px' : '260px',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '100vh',
        }}
      >
        {/* Top bar */}
        <header
          style={{
            height: '72px',
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            background: headerBg,
            backdropFilter: 'blur(20px)',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 600, color: textPrimary }}>
              Super Admin
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px', borderRadius: '50%', transition: 'background 0.2s',
                fontSize: '18px',
              }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            <span style={{ fontSize: '14px', color: textSecondary, fontWeight: 500 }}>{user.name}</span>

            <button
              onClick={handleLogout}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: `1px solid ${borderColor}`,
                background: 'transparent',
                color: textSecondary,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <div style={{ padding: '32px', maxWidth: '1400px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
