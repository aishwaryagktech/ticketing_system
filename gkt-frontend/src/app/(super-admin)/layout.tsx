'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';

import { LayoutDashboard, Boxes, Ticket, CreditCard, Flag, Key } from 'lucide-react';

const navItems = [
  { href: '/super-admin',               label: 'Overview',      icon: <LayoutDashboard size={18} /> },
  { href: '/super-admin/products',      label: 'Products',      icon: <Boxes size={18} /> },
  { href: '/super-admin/tickets',       label: 'Tickets',       icon: <Ticket size={18} /> },
  { href: '/super-admin/billing',       label: 'Billing',       icon: <CreditCard size={18} /> },
  { href: '/super-admin/feature-flags', label: 'Feature Flags', icon: <Flag size={18} /> },
  { href: '/api-keys',                  label: 'API Keys',      icon: <Key size={18} /> },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, hydrate, clearAuth } = useAuthStore();

  useEffect(() => { setMounted(true); hydrate(); }, [hydrate]);

  useEffect(() => {
    if (mounted && (!user || user.role !== 'super_admin')) router.push('/login');
  }, [mounted, user, router]);

  const isDark = mounted ? theme === 'dark' : true;

  // ── Design tokens (matches landing page) ──
  const mainBg      = isDark ? 'linear-gradient(160deg,#020617 0%,#0a1628 40%,#060d1f 100%)' : 'linear-gradient(160deg,#EFF6FF 0%,#DBEAFE 30%,#F0F9FF 65%,#E0F2FE 100%)';
  const sidebarBg   = isDark ? 'rgba(10,22,40,0.95)'       : 'rgba(255,255,255,0.88)';
  const headerBg    = isDark ? 'rgba(10,22,40,0.92)'       : 'rgba(255,255,255,0.88)';
  const textPrimary    = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary  = isDark ? '#94A3B8' : '#334155';
  const cardBorder     = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(147,197,253,0.55)';
  const pillBg         = isDark ? 'rgba(14,165,233,0.12)'  : 'rgba(219,234,254,0.9)';
  const pillBorder     = isDark ? 'rgba(14,165,233,0.3)'   : 'rgba(147,197,253,0.8)';
  const accentBlue     = '#0EA5E9';
  const accentIndigo   = '#6366F1';

  const handleLogout = () => { clearAuth(); router.push('/login'); };

  if (!mounted || !user || user.role !== 'super_admin') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: mainBg, color: textPrimary, fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif' }}>

      {/* Background blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, left: -80, width: 500, height: 500, borderRadius: '50%', background: isDark ? 'rgba(29,78,216,0.12)' : 'rgba(147,197,253,0.3)', filter: 'blur(90px)' }} />
        <div style={{ position: 'absolute', bottom: 0, right: -60, width: 400, height: 400, borderRadius: '50%', background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(199,210,254,0.35)', filter: 'blur(80px)' }} />
      </div>

      {/* Sidebar */}
      <aside style={{
        width: collapsed ? '72px' : '248px',
        background: sidebarBg,
        borderRight: `1px solid ${cardBorder}`,
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s ease',
        position: 'fixed', top: 0, left: 0, height: '100vh',
        zIndex: 50, overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: collapsed ? '18px 16px' : '18px 20px', borderBottom: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center', gap: 10, minHeight: 68 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: isDark ? 'rgba(14,165,233,0.2)' : '#BFDBFE', border: `1px solid ${pillBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: 999, background: accentBlue }} />
            </div>
            {!collapsed && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: textPrimary, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>GKT Admin</div>
                <div style={{ fontSize: 10, color: textSecondary }}>Super Admin Panel</div>
              </div>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ padding: '10px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '11px 16px' : '10px 14px',
                borderRadius: 10, textDecoration: 'none', fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : textSecondary,
                background: isActive ? `linear-gradient(90deg,${accentBlue},${accentIndigo})` : 'transparent',
                border: isActive ? 'none' : '1px solid transparent',
                boxShadow: isActive ? '0 2px 12px rgba(14,165,233,0.3)' : 'none',
                justifyContent: collapsed ? 'center' : 'flex-start',
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div style={{ padding: '10px 8px', borderTop: `1px solid ${cardBorder}` }}>
          <button onClick={() => setCollapsed(!collapsed)} style={{
            width: '100%', padding: '9px', borderRadius: 10,
            border: `1px solid ${cardBorder}`,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
            color: textSecondary, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: collapsed ? '72px' : '248px', transition: 'margin-left 0.25s ease', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {/* Top bar */}
        <header style={{
          height: 68, borderBottom: `1px solid ${cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', background: headerBg, backdropFilter: 'blur(20px)',
          position: 'sticky', top: 0, zIndex: 40,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, letterSpacing: '-0.02em' }}>Super Admin</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} style={{ padding: '5px 12px', borderRadius: 999, border: `1px solid ${cardBorder}`, background: pillBg, color: textSecondary, fontSize: 11, cursor: 'pointer' }}>
              {isDark ? '☀ Light' : '🌙 Dark'}
            </button>
            <span style={{ fontSize: 13, color: textSecondary, fontWeight: 600 }}>{user.name}</span>
            <button onClick={handleLogout} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${cardBorder}`, background: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
