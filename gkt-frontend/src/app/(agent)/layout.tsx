'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { Sun, Moon, LogOut, ChevronLeft, ChevronRight, LayoutDashboard, ListTree, UserRound } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { ticketApi } from '@/lib/api/ticket.api';

const navItems = [
  { href: '/agent/dashboard',  label: 'Dashboard',    icon: <LayoutDashboard size={18} /> },
  { href: '/agent/queue',      label: 'Ticket Queue', icon: <ListTree size={18} />, badge: true },
  { href: '/agent/my-tickets', label: 'My Tickets',   icon: <UserRound size={18} /> },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const { user, token: storeToken, clearAuth } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const token = storeToken || (typeof window !== 'undefined' ? localStorage.getItem('gkt_token') : null) || undefined;
  const socket = useSocket(token);

  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [queueCount, setQueueCount] = useState<number>(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else if (!['l1_agent', 'l2_agent', 'l3_agent', 'tenant_admin'].includes(user.role)) {
      router.push('/login');
    }
  }, [user, router]);

  // Initial fetch for queue count
  useEffect(() => {
    async function fetchQueueCount() {
      if (!user) return;
      try {
        const resList = await ticketApi.list({ status: 'open', assigned: 'unassigned', take: 100 });
        setQueueCount(Array.isArray(resList.data?.items) ? resList.data.items.length : 0);
      } catch (err) {
        console.error('Failed to get ticket queue count', err);
      }
    }
    fetchQueueCount();
  }, [user]);

  // Socket listener for new tickets
  useEffect(() => {
    if (!socket) return;
    const handleTicketCreated = () => {
      setQueueCount(prev => prev + 1);
    };
    
    // As tickets are assigned or resolved, decrement the queue count
    const handleTicketAssigned = () => {
      setQueueCount(prev => Math.max(0, prev - 1));
    };

    socket.on('ticket:created', handleTicketCreated);
    socket.on('ticket:agent_started', handleTicketAssigned);
    socket.on('ticket:assigned', handleTicketAssigned);
    
    return () => {
      socket.off('ticket:created', handleTicketCreated);
      socket.off('ticket:agent_started', handleTicketAssigned);
      socket.off('ticket:assigned', handleTicketAssigned);
    };
  }, [socket]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const isDark = mounted && theme === 'dark';

  // Tokens match super-admin
  const bgMain        = isDark ? '#020617' : '#EFF6FF';
  const sidebarBg     = isDark ? '#0F172A' : '#FFFFFF';
  const sidebarBorder = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(147,197,253,0.3)';
  const textPrimary   = isDark ? '#E5E7EB' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#475569';
  const itemActiveBg  = isDark ? 'rgba(14,165,233,0.1)' : '#F0F9FF';
  const itemActiveText= isDark ? '#38BDF8' : '#0284C7';
  const itemHoverBg   = isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC';
  const accentBlue    = '#0EA5E9';

  if (!user) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: bgMain, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* ── Sidebar ── */}
      <aside style={{
        width: collapsed ? 72 : 260,
        background: sidebarBg,
        borderRight: `1px solid ${sidebarBorder}`,
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{ padding: collapsed ? '24px 0' : '24px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', borderBottom: `1px solid ${sidebarBorder}` }}>
          {collapsed ? (
            <div style={{ fontSize: 24, fontWeight: 900, background: `linear-gradient(135deg, ${accentBlue}, #6366F1)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>A</div>
          ) : (
            <div style={{ fontSize: 20, fontWeight: 900, color: textPrimary, letterSpacing: '-0.03em' }}>
              Agent <span style={{ color: accentBlue }}>Workspace</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute', top: 32, right: -12,
            width: 24, height: 24, borderRadius: '50%',
            background: isDark ? '#1E293B' : '#FFFFFF',
            border: `1px solid ${sidebarBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: textSecondary,
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            zIndex: 20,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <nav style={{ flex: 1, padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: collapsed ? '12px' : '12px 16px',
                  borderRadius: 8,
                  background: isActive ? itemActiveBg : 'transparent',
                  color: isActive ? itemActiveText : textSecondary,
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14,
                  transition: 'all 0.2s',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  position: 'relative',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = itemHoverBg; e.currentTarget.style.color = textPrimary; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = textSecondary; } }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? 1 : 0.8 }}>
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                  
                  {/* Notification Badge */}
                  {item.badge && queueCount > 0 && (
                    <span style={{
                      position: collapsed ? 'absolute' : 'static',
                      top: collapsed ? 8 : 'auto',
                      right: collapsed ? 8 : 'auto',
                      marginLeft: collapsed ? 0 : 'auto',
                      background: '#EF4444',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: collapsed ? '2px 4px' : '2px 8px',
                      borderRadius: 99,
                      minWidth: collapsed ? 16 : 20,
                      textAlign: 'center',
                      lineHeight: 1,
                    }}>
                      {queueCount > 99 ? '99+' : queueCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Sticky Header */}
        <header style={{
          height: 72, background: sidebarBg, borderBottom: `1px solid ${sidebarBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 32px', gap: 24, zIndex: 5,
        }}>
          {mounted && (
            <button onClick={toggleTheme} style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
              border: 'none', width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: textSecondary, transition: 'all 0.2s'
            }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          <div style={{ height: 32, width: 1, background: sidebarBorder }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                {user.email}
              </div>
              <div style={{ fontSize: 11, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {user.role}
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${accentBlue}, #6366F1)`,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800
            }}>
              {user.email.charAt(0).toUpperCase()}
            </div>
            <button onClick={clearAuth} title="Logout" style={{
              background: 'transparent', border: 'none', padding: 8, marginLeft: 8,
              cursor: 'pointer', color: textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.1)' : '#FEE2E2'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = textSecondary; }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', position: 'relative' }}>
          <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
