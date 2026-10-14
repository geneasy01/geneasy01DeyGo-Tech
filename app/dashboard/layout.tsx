'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Siren,
  Navigation,
  Users,
  Wallet,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
  Shield,
  Lock,
  Bell,
  Settings,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { GuardianAssistant } from '@/components/guardian-assistant';
import { NotificationBell } from '@/components/notification-bell';
import { registerDeviceForPush } from '@/lib/fcm';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/sos', label: 'SOS', icon: Siren },
  { href: '/dashboard/incidents', label: 'Incident History', icon: Activity },
  { href: '/dashboard/journey', label: 'Journey Guard', icon: Navigation },
  { href: '/dashboard/contacts', label: 'Emergency Contacts', icon: Users },
  { href: '/dashboard/wallet', label: 'Emergency Wallet', icon: Wallet },
  { href: '/dashboard/duress', label: 'Duress Mode', icon: Lock },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/settings', label: 'Notification Settings', icon: Settings },
  { href: '/dashboard/subscription', label: 'Subscription', icon: CreditCard },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Register device for FCM push notifications on mount
  useEffect(() => {
    if (!user) return;
    registerDeviceForPush(user.id, 'web').catch((err) => {
      console.warn('[FCM] Device registration skipped:', err);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse">
          <Logo size="lg" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-white/5 bg-navy-light transition-transform duration-300 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* User info */}
          <div className="border-b border-white/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-red-700 text-sm font-bold text-white">
                {profile?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {profile?.full_name || 'User'}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                profile?.role === 'admin'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-white/5 text-muted-foreground'
              )}>
                <Shield className="h-3 w-3" />
                {profile?.role === 'admin' ? 'Admin' : 'Member'}
              </span>
              {isAdmin && (
                <Link href="/admin" className="text-xs text-primary hover:text-red-400">
                  Admin Panel →
                </Link>
              )}
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  )}
                >
                  <item.icon className={cn('h-4.5 w-4.5', active && 'text-primary')} />
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="active-indicator"
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sign out */}
          <div className="border-t border-white/5 p-3">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="md:pl-72">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-navy/80 px-4 py-3 backdrop-blur-lg md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl glass border border-white/5 active:scale-95 transition-transform">
            <Menu className="h-5 w-5 text-foreground" />
          </button>
          <Logo size="sm" />
          <NotificationBell />
        </header>

        {/* Desktop top bar */}
        <div className="hidden items-center justify-end gap-3 px-8 pt-6 md:flex">
          <NotificationBell />
        </div>

        <main className="min-h-screen p-4 md:p-8 md:pt-4">{children}</main>
      </div>
      <GuardianAssistant />
    </div>
  );
}
