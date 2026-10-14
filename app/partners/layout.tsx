'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BookUser,
  QrCode,
  Siren,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getUserPartnerships,
  PARTNER_TYPE_LABELS,
  type PartnerOrganization,
} from '@/lib/partners';

const navItems = [
  { href: '/partners/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/partners/directory', label: 'Resource Directory', icon: BookUser },
  { href: '/partners/invitations', label: 'Invitations & QR', icon: QrCode },
  { href: '/partners/requests', label: 'Emergency Requests', icon: Siren },
];

export default function PartnerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgs, setOrgs] = useState<PartnerOrganization[]>([]);
  const [activeOrg, setActiveOrg] = useState<PartnerOrganization | null>(null);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/partners');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      const partnerships = await getUserPartnerships(user.id);
      if (cancelled) return;
      const list = partnerships
        .filter((p) => p.membership.role === 'admin')
        .map((p) => p.organization);
      setOrgs(list);
      const stored = typeof window !== 'undefined' ? localStorage.getItem('partnerActiveOrgId') : null;
      const initial = list.find((o) => o.id === stored) ?? list[0] ?? null;
      setActiveOrg(initial);
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const switchOrg = (org: PartnerOrganization) => {
    setActiveOrg(org);
    setOrgMenuOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('partnerActiveOrgId', org.id);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/partners');
  };

  if (loading || (fetching && !activeOrg)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Logo size="lg" />
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (orgs.length === 0 && !fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h1 className="mt-4 text-xl font-bold text-foreground">No Partner Organizations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are not an administrator of any partner organization yet.
          </p>
          <Link href="/partners" className="mt-6 block">
            <Button className="bg-primary text-white hover:bg-red-600">
              Register an Organization
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
            <Link href="/partners">
              <Logo />
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Org switcher */}
          <div className="border-b border-white/5 px-4 py-4">
            <div className="relative">
              <button
                onClick={() => orgs.length > 1 ? setOrgMenuOpen(!orgMenuOpen) : undefined}
                className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left transition-colors hover:bg-white/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {activeOrg?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeOrg.logo_url} alt="" className="h-full w-full rounded-lg object-cover" />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {activeOrg?.name ?? 'Select organization'}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {activeOrg ? PARTNER_TYPE_LABELS[activeOrg.type] : ''}
                  </div>
                </div>
                {orgs.length > 1 && (
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', orgMenuOpen && 'rotate-180')} />
                )}
              </button>

              <AnimatePresence>
                {orgMenuOpen && orgs.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute left-0 right-0 top-full z-10 mt-1 space-y-1 rounded-xl border border-white/5 bg-navy-light p-1.5 shadow-lg"
                  >
                    {orgs.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => switchOrg(o)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm transition-colors',
                          o.id === activeOrg?.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-white/5'
                        )}
                      >
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="truncate">{o.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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
                      layoutId="partner-active-indicator"
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer links */}
          <div className="space-y-1 border-t border-white/5 p-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <LayoutDashboard className="h-4.5 w-4.5" />
              User Dashboard
            </Link>
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
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl glass border border-white/5 active:scale-95 transition-transform"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </button>
          <Logo size="sm" />
          <div className="w-10" />
        </header>

        <main className="min-h-screen p-4 md:p-8">
          {activeOrg ? children : <div className="text-sm text-muted-foreground">No organization selected.</div>}
        </main>
      </div>
    </div>
  );
}
