'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Users,
  Siren,
  Navigation,
  CreditCard,
  Activity,
  Shield,
  LogOut,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Crown,
  LayoutDashboard,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AdminStats {
  totalUsers: number;
  totalSOS: number;
  activeSOS: number;
  totalJourneys: number;
  activeJourneys: number;
  premiumSubs: number;
  totalContacts: number;
}

interface AdminSOS {
  id: string;
  status: string;
  triggered_at: string;
  latitude: number | null;
  longitude: number | null;
  is_duress: boolean;
  user_id: string;
}

interface AdminJourney {
  id: string;
  origin: string;
  destination: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  user_id: string;
}

interface AdminUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string;
}

interface AdminSub {
  id: string;
  plan: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  user_id: string;
}

type Tab = 'overview' | 'users' | 'sos' | 'journeys' | 'subscriptions';

export default function AdminDashboardPage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [data, setData] = useState<{
    stats: AdminStats;
    recentSOS: AdminSOS[];
    recentJourneys: AdminJourney[];
    allUsers: AdminUser[];
    allSubscriptions: AdminSub[];
  } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/admin');
    }
    if (!loading && user && profile && profile.role !== 'admin') {
      setAccessDenied(true);
    }
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;
    (async () => {
      setFetching(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL}/functions/v1/admin-stats?resource=stats`;
        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            setAccessDenied(true);
          }
          return;
        }

        const json = await response.json();
        setData(json);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
      }
      setFetching(false);
    })();
  }, [user, profile]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/admin');
  };

  if (loading || (fetching && !data)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Logo size="lg" />
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="glass-strong max-w-md rounded-2xl border-red-500/20 text-center">
          <CardContent className="p-8">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Access Denied</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You need admin privileges to access this dashboard.
            </p>
            <Link href="/" className="mt-6 block">
              <Button className="bg-primary text-white hover:bg-red-600">
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'sos', label: 'SOS Alerts', icon: Siren },
    { id: 'journeys', label: 'Journeys', icon: Navigation },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  ];

  const statCards = [
    {
      label: 'Total Users',
      value: data.stats.totalUsers,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'SOS Alerts',
      value: data.stats.totalSOS,
      sublabel: `${data.stats.activeSOS} active`,
      icon: Siren,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Journeys',
      value: data.stats.totalJourneys,
      sublabel: `${data.stats.activeJourneys} active`,
      icon: Navigation,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    {
      label: 'Premium Subs',
      value: data.stats.premiumSubs,
      icon: Crown,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-navy/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary sm:inline-flex">
              <Shield className="h-3 w-3" />
              Admin Panel
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/incidents">
              <Button variant="outline" size="sm" className="glass text-xs">
                <Siren className="mr-1.5 h-3.5 w-3.5" />
                Incidents
              </Button>
            </Link>
            <div className="hidden text-sm text-muted-foreground sm:block">
              {profile?.full_name || user?.email}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="glass text-red-400 hover:bg-red-500/10"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {statCards.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="glass-card rounded-2xl border-white/5">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                          <stat.icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                        <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                      <div className="mt-3 text-2xl font-bold text-foreground">
                        {stat.value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stat.label}
                        {stat.sublabel && (
                          <span className="ml-1 text-primary">{stat.sublabel}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Recent SOS Alerts */}
            <Card className="glass-card rounded-2xl border-white/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent SOS Alerts</CardTitle>
                  <button
                    onClick={() => setActiveTab('sos')}
                    className="text-xs text-primary hover:text-red-400"
                  >
                    View all →
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {data.recentSOS.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No SOS alerts recorded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.recentSOS.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center gap-3 rounded-xl bg-white/5 p-3"
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            alert.status === 'active'
                              ? 'bg-red-500/10'
                              : 'bg-green-500/10'
                          }`}
                        >
                          <Siren
                            className={`h-4.5 w-4.5 ${
                              alert.status === 'active' ? 'text-red-400' : 'text-green-400'
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">
                            SOS {alert.status === 'active' ? 'Active' : 'Resolved'}
                            {alert.is_duress && (
                              <span className="ml-2 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                                Duress
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(alert.triggered_at).toLocaleString()}
                            </span>
                            {alert.latitude && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {alert.latitude.toFixed(2)}, {alert.longitude?.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Journeys */}
            <Card className="glass-card rounded-2xl border-white/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent Journeys</CardTitle>
                  <button
                    onClick={() => setActiveTab('journeys')}
                    className="text-xs text-primary hover:text-red-400"
                  >
                    View all →
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {data.recentJourneys.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No journeys recorded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.recentJourneys.slice(0, 5).map((journey) => (
                      <div
                        key={journey.id}
                        className="flex items-center gap-3 rounded-xl bg-white/5 p-3"
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            journey.status === 'active'
                              ? 'bg-blue-500/10'
                              : journey.status === 'completed'
                              ? 'bg-green-500/10'
                              : 'bg-red-500/10'
                          }`}
                        >
                          <Navigation
                            className={`h-4.5 w-4.5 ${
                              journey.status === 'active'
                                ? 'text-blue-400'
                                : journey.status === 'completed'
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">
                            {journey.origin} → {journey.destination}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(journey.started_at).toLocaleString()}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            journey.status === 'active'
                              ? 'bg-blue-500/10 text-blue-400'
                              : journey.status === 'completed'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {journey.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-card rounded-2xl border-white/5">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  All Users ({data.allUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                        <th className="pb-3 pr-4 font-medium">Name</th>
                        <th className="pb-3 pr-4 font-medium">Email</th>
                        <th className="pb-3 pr-4 font-medium">Phone</th>
                        <th className="pb-3 pr-4 font-medium">Role</th>
                        <th className="pb-3 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.allUsers.map((u) => (
                        <tr
                          key={u.id}
                          className="border-b border-white/5 text-sm last:border-0"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-red-700 text-xs font-bold text-white">
                                {u.full_name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <span className="text-foreground">
                                {u.full_name || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">{u.email}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{u.phone || '—'}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                u.role === 'admin'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-white/5 text-muted-foreground'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* SOS Tab */}
        {activeTab === 'sos' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-card rounded-2xl border-white/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    SOS Alerts ({data.recentSOS.length})
                  </CardTitle>
                  <Link href="/admin/incidents">
                    <button className="text-xs text-primary hover:text-red-400">
                      View Incidents →
                    </button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {data.recentSOS.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No SOS alerts recorded.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.recentSOS.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center gap-3 rounded-xl bg-white/5 p-4"
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            alert.status === 'active'
                              ? 'bg-red-500/10'
                              : 'bg-green-500/10'
                          }`}
                        >
                          <Siren
                            className={`h-5 w-5 ${
                              alert.status === 'active' ? 'text-red-400' : 'text-green-400'
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              SOS {alert.status === 'active' ? 'Active' : 'Resolved'}
                            </span>
                            {alert.is_duress && (
                              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                                Duress
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(alert.triggered_at).toLocaleString()}
                            </span>
                            {alert.latitude && alert.longitude && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            alert.status === 'active'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-green-500/10 text-green-400'
                          }`}
                        >
                          {alert.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Journeys Tab */}
        {activeTab === 'journeys' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-card rounded-2xl border-white/5">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  All Journeys ({data.recentJourneys.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentJourneys.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No journeys recorded.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.recentJourneys.map((journey) => (
                      <div
                        key={journey.id}
                        className="flex items-center gap-3 rounded-xl bg-white/5 p-4"
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            journey.status === 'active'
                              ? 'bg-blue-500/10'
                              : journey.status === 'completed'
                              ? 'bg-green-500/10'
                              : 'bg-red-500/10'
                          }`}
                        >
                          <Navigation
                            className={`h-5 w-5 ${
                              journey.status === 'active'
                                ? 'text-blue-400'
                                : journey.status === 'completed'
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">
                            {journey.origin} → {journey.destination}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Started: {new Date(journey.started_at).toLocaleString()}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            journey.status === 'active'
                              ? 'bg-blue-500/10 text-blue-400'
                              : journey.status === 'completed'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {journey.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-card rounded-2xl border-white/5">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Subscriptions ({data.allSubscriptions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.allSubscriptions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No subscriptions recorded.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                          <th className="pb-3 pr-4 font-medium">Plan</th>
                          <th className="pb-3 pr-4 font-medium">Status</th>
                          <th className="pb-3 pr-4 font-medium">Started</th>
                          <th className="pb-3 font-medium">Expires</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.allSubscriptions.map((sub) => (
                          <tr
                            key={sub.id}
                            className="border-b border-white/5 text-sm last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  sub.plan === 'premium'
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-white/5 text-muted-foreground'
                                }`}
                              >
                                {sub.plan === 'premium' && <Crown className="h-3 w-3" />}
                                {sub.plan}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`flex items-center gap-1.5 text-xs ${
                                  sub.status === 'active'
                                    ? 'text-green-400'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {sub.status}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {new Date(sub.started_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {sub.expires_at
                                ? new Date(sub.expires_at).toLocaleDateString()
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
