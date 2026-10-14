'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  BookUser,
  QrCode,
  Siren,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Shield,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getPartnerStats,
  getIncomingRequests,
  type PartnerStats,
  type PartnerEmergencyRequest,
} from '@/lib/partners';
import { PARTNER_TYPE_LABELS } from '@/lib/partners';

export default function PartnerDashboardPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<PartnerEmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrgId(localStorage.getItem('partnerActiveOrgId'));
    }
  }, []);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [s, reqs] = await Promise.all([
        getPartnerStats(orgId),
        getIncomingRequests(orgId, 5),
      ]);
      if (cancelled) return;
      setStats(s);
      setRecentRequests(reqs);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (!orgId || loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    { label: 'Active Members', value: stats.activeMembers, sub: `${stats.totalMembers} total`, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Directory Entries', value: stats.directoryEntries, icon: BookUser, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Invitation Joins', value: stats.invitationJoins, sub: `${stats.totalInvitations} links`, icon: QrCode, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Emergency Requests', value: stats.incomingRequests, sub: `${stats.pendingRequests} pending`, icon: Siren, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Onboarding statistics and recent emergency requests for your organization.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
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
                <div className="mt-3 text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">
                  {stat.label}
                  {stat.sub && <span className="ml-1 text-primary">{stat.sub}</span>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Privacy banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass-strong rounded-2xl border-emerald-500/20">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <Lock className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Privacy First</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You only see emergency requests when a user explicitly sends one to your organization.
                You never receive live tracking, journey data, or member locations. This is permanent.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent requests */}
      <Card className="glass-card rounded-2xl border-white/5">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Emergency Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No emergency requests yet. When a member explicitly requests help from your organization, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 rounded-xl bg-white/5 p-3"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      req.status === 'pending' ? 'bg-amber-500/10' : req.status === 'resolved' || req.status === 'closed' ? 'bg-green-500/10' : 'bg-blue-500/10'
                    }`}
                  >
                    {req.status === 'pending' ? (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium capitalize text-foreground">
                      {req.emergency_type} request
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      req.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : req.status === 'resolved' || req.status === 'closed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
