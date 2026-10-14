'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Siren,
  Clock,
  MapPin,
  Phone,
  User,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getIncomingRequests,
  updateRequestStatus,
  type PartnerEmergencyRequest,
  type PartnerRequestStatus,
} from '@/lib/partners';
import { cn } from '@/lib/utils';

const statusConfig: Record<PartnerRequestStatus, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pending' },
  accepted: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Accepted' },
  declined: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Declined' },
  resolved: { color: 'text-green-400', bg: 'bg-green-500/10', label: 'Resolved' },
  closed: { color: 'text-muted-foreground', bg: 'bg-white/5', label: 'Closed' },
};

const statusFlow: PartnerRequestStatus[] = ['pending', 'accepted', 'declined', 'resolved', 'closed'];

export default function PartnerRequestsPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [requests, setRequests] = useState<PartnerEmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrgId(localStorage.getItem('partnerActiveOrgId'));
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const data = await getIncomingRequests(orgId, 100);
    setRequests(data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleStatusUpdate = async (requestId: string, newStatus: PartnerRequestStatus) => {
    setUpdatingId(requestId);
    await updateRequestStatus(requestId, newStatus);
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: newStatus,
              responded_at: newStatus === 'accepted' || newStatus === 'declined' ? new Date().toISOString() : r.responded_at,
              resolved_at: newStatus === 'resolved' ? new Date().toISOString() : r.resolved_at,
              closed_at: newStatus === 'closed' ? new Date().toISOString() : r.closed_at,
            }
          : r
      )
    );
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Emergency Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Requests members have explicitly directed to your organization.
        </p>
      </div>

      {/* Privacy reminder */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <Lock className="h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-sm text-muted-foreground">
          Each request shows the user\u2019s location at the moment they sent it. This is a point-in-time disclosure \u2014 the location is never updated. You see a request only because the user chose your organization.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card className="glass-card rounded-2xl border-white/5">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No emergency requests yet. When a member explicitly requests help from your organization, it will appear here with their consent.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req, i) => {
            const config = statusConfig[req.status];
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="glass-card rounded-2xl border-white/5 transition-all hover:border-white/10">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', config.bg)}>
                        <Siren className={cn('h-5 w-5', config.color)} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold capitalize text-foreground">
                            {req.emergency_type}
                          </span>
                          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', config.bg, config.color)}>
                            {config.label}
                          </span>
                          <span className="text-xs text-muted-foreground">#{req.id.slice(0, 8)}</span>
                        </div>

                        {/* User snapshot */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="text-foreground">{req.user_snapshot_name || 'Anonymous'}</span>
                          </span>
                          {req.user_snapshot_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <a href={`tel:${req.user_snapshot_phone}`} className="text-primary hover:text-red-400">
                                {req.user_snapshot_phone}
                              </a>
                            </span>
                          )}
                        </div>

                        {/* Location + time */}
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(req.created_at).toLocaleString()}
                          </span>
                          {req.latitude && req.longitude && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {req.latitude.toFixed(4)}, {req.longitude.toFixed(4)}
                            </span>
                          )}
                        </div>

                        {req.message && (
                          <div className="mt-2 rounded-lg bg-white/5 p-2 text-xs text-muted-foreground">
                            {req.message}
                          </div>
                        )}
                      </div>

                      {/* Status control */}
                      <div className="flex shrink-0 items-center gap-2">
                        {updatingId === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : req.status !== 'closed' ? (
                          <Select
                            value={req.status}
                            onValueChange={(v) => handleStatusUpdate(req.id, v as PartnerRequestStatus)}
                          >
                            <SelectTrigger className="w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusFlow.map((s) => (
                                <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">Final</span>
                        )}
                      </div>
                    </div>

                    {/* Quick actions for pending */}
                    {req.status === 'pending' && (
                      <div className="mt-3 flex gap-2 border-t border-white/5 pt-3">
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => handleStatusUpdate(req.id, 'accepted')}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="glass text-red-400 hover:bg-red-500/10"
                          onClick={() => handleStatusUpdate(req.id, 'declined')}
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Decline
                        </Button>
                        {req.user_snapshot_phone && (
                          <a href={`tel:${req.user_snapshot_phone}`} className="ml-auto">
                            <Button size="sm" variant="outline" className="glass text-primary hover:bg-red-500/10">
                              <Phone className="mr-1 h-3.5 w-3.5" /> Call
                            </Button>
                          </a>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
