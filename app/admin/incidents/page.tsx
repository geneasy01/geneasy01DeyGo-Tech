'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Siren,
  Clock,
  MapPin,
  Search,
  Filter,
  Loader2,
  AlertTriangle,
  Shield,
  LogOut,
  User,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STATUS_FLOW, STATUS_LABELS } from '@/lib/incidents';
import type { IncidentStatus } from '@/lib/types';

interface AdminIncident {
  id: string;
  user_id: string;
  emergency_type: string;
  status: IncidentStatus;
  latitude: number | null;
  longitude: number | null;
  assigned_responder: string | null;
  notes: string | null;
  triggered_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

const statusConfig: Record<IncidentStatus, { color: string; bg: string }> = {
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  accepted: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  responder_en_route: { color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  arrived: { color: 'text-green-400', bg: 'bg-green-500/10' },
  resolved: { color: 'text-green-400', bg: 'bg-green-500/10' },
  closed: { color: 'text-muted-foreground', bg: 'bg-white/5' },
};

export default function AdminIncidentsPage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<AdminIncident[]>([]);
  const [fetching, setFetching] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL}/functions/v1/admin-stats?resource=incidents`;
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) setAccessDenied(true);
        return;
      }

      const json = await response.json();
      setIncidents(json.incidents || []);
    } catch (err) {
      console.error('Failed to fetch admin incidents:', err);
    }
    setFetching(false);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/admin');
    if (!loading && user && profile && profile.role !== 'admin') setAccessDenied(true);
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (user && profile?.role === 'admin') fetchIncidents();
  }, [user, profile, fetchIncidents]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/admin');
  };

  const handleStatusUpdate = async (
    incidentId: string,
    newStatus: IncidentStatus,
    userId: string
  ) => {
    setUpdatingId(incidentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL}/functions/v1/admin-stats?resource=incidents`;
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ incidentId, status: newStatus }),
      });

      if (response.ok) {
        setIncidents((prev) =>
          prev.map((inc) =>
            inc.id === incidentId
              ? {
                  ...inc,
                  status: newStatus,
                  resolved_at: newStatus === 'resolved' ? new Date().toISOString() : inc.resolved_at,
                  closed_at: newStatus === 'closed' ? new Date().toISOString() : inc.closed_at,
                }
              : inc
          )
        );
      }
    } catch (err) {
      console.error('Failed to update incident:', err);
    }
    setUpdatingId(null);
  };

  // Filter logic
  const filtered = incidents.filter((inc) => {
    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    const matchesSearch =
      !search ||
      inc.id.toLowerCase().includes(search.toLowerCase()) ||
      inc.emergency_type.toLowerCase().includes(search.toLowerCase()) ||
      inc.user?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      inc.user?.email?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (loading || (fetching && incidents.length === 0)) {
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
              You need admin privileges to access this page.
            </p>
            <Link href="/" className="mt-6 block">
              <Button className="bg-primary text-white hover:bg-red-600">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-navy/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <Logo />
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary sm:inline-flex">
              <Shield className="h-3 w-3" />
              Admin Panel
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm" className="glass text-xs">
                Dashboard
              </Button>
            </Link>
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Emergency Incidents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage all SOS incidents across the platform.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by incident ID, type, user name, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_FLOW.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Incidents list */}
        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="glass-card rounded-2xl border-white/5">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Siren className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                {incidents.length === 0
                  ? 'No emergency incidents recorded.'
                  : 'No incidents match your filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((incident, i) => {
              const config = statusConfig[incident.status];
              return (
                <motion.div
                  key={incident.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                >
                  <Card className="glass-card rounded-2xl border-white/5 transition-all hover:border-white/10">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        {/* Status icon */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bg}`}>
                          <Siren className={`h-5 w-5 ${config.color}`} />
                        </div>

                        {/* Main info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold capitalize text-foreground">
                              {incident.emergency_type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              #{incident.id.slice(0, 8)}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                              {STATUS_LABELS[incident.status]}
                            </span>
                          </div>

                          {/* User info */}
                          {incident.user && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="text-foreground">{incident.user.full_name || 'Unknown'}</span>
                              <span>·</span>
                              <span>{incident.user.email}</span>
                              {incident.user.phone && (
                                <>
                                  <span>·</span>
                                  <span>{incident.user.phone}</span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Timestamps and location */}
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(incident.triggered_at).toLocaleString()}
                            </span>
                            {incident.latitude && incident.longitude && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                              </span>
                            )}
                            {incident.assigned_responder && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {incident.assigned_responder}
                              </span>
                            )}
                          </div>

                          {incident.notes && (
                            <div className="mt-2 rounded-lg bg-white/5 p-2 text-xs text-muted-foreground">
                              {incident.notes}
                            </div>
                          )}
                        </div>

                        {/* Status update control */}
                        <div className="flex shrink-0 items-center gap-2">
                          {updatingId === incident.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : incident.status !== 'closed' ? (
                            <Select
                              value={incident.status}
                              onValueChange={(v) =>
                                handleStatusUpdate(incident.id, v as IncidentStatus, incident.user_id)
                              }
                            >
                              <SelectTrigger className="w-40 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_FLOW.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {STATUS_LABELS[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">Final</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Summary footer */}
        {!fetching && filtered.length > 0 && (
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Showing {filtered.length} of {incidents.length} incidents
          </div>
        )}
      </div>
    </div>
  );
}
