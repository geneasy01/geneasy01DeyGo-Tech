'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Siren,
  Clock,
  Activity,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Guardian Activity Timeline
// ─────────────────────────────────────────────────────────────────────────────
// Reuses existing Guardian and Incident data — no duplicated logic.
// Fetches journeys, safety checks, and SOS incidents, then merges them
// into a unified chronological activity feed.

interface ActivityEvent {
  id: string;
  type: 'journey_started' | 'journey_completed' | 'journey_cancelled' | 'guardian_monitoring' | 'safety_check_sent' | 'user_responded_safe' | 'user_responded_help' | 'user_responded_need_time' | 'safety_check_expired' | 'incident_created' | 'incident_closed';
  label: string;
  description: string;
  timestamp: string;
  icon: LucideIcon;
  color: string;
}

const EVENT_CONFIG: Record<ActivityEvent['type'], { icon: LucideIcon; color: string }> = {
  journey_started: { icon: Navigation, color: 'text-blue-400' },
  journey_completed: { icon: CheckCircle2, color: 'text-green-400' },
  journey_cancelled: { icon: XCircle, color: 'text-red-400' },
  guardian_monitoring: { icon: Shield, color: 'text-purple-400' },
  safety_check_sent: { icon: ShieldAlert, color: 'text-amber-400' },
  user_responded_safe: { icon: ShieldCheck, color: 'text-green-400' },
  user_responded_help: { icon: ShieldAlert, color: 'text-red-400' },
  user_responded_need_time: { icon: Clock, color: 'text-amber-400' },
  safety_check_expired: { icon: Clock, color: 'text-orange-400' },
  incident_created: { icon: Siren, color: 'text-red-400' },
  incident_closed: { icon: CheckCircle2, color: 'text-green-400' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function GuardianActivity({ limit = 20 }: { limit?: number }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [journeysRes, safetyChecksRes, incidentsRes] = await Promise.all([
      supabase
        .from('journeys')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(15),
      supabase
        .from('safety_checks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('emergency_incidents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const allEvents: ActivityEvent[] = [];

    // Journey events
    for (const journey of (journeysRes.data || []) as any[]) {
      allEvents.push({
        id: `journey-start-${journey.id}`,
        type: 'journey_started',
        label: `${journey.origin} → ${journey.destination}`,
        description: 'Journey started',
        timestamp: journey.started_at,
        ...EVENT_CONFIG.journey_started,
      });

      if (journey.status === 'completed' && journey.completed_at) {
        allEvents.push({
          id: `journey-complete-${journey.id}`,
          type: 'journey_completed',
          label: 'Arrived safely',
          description: `${journey.origin} → ${journey.destination}`,
          timestamp: journey.completed_at,
          ...EVENT_CONFIG.journey_completed,
        });
      } else if (journey.status === 'cancelled' && journey.completed_at) {
        allEvents.push({
          id: `journey-cancel-${journey.id}`,
          type: 'journey_cancelled',
          label: 'Journey cancelled',
          description: `${journey.origin} → ${journey.destination}`,
          timestamp: journey.completed_at,
          ...EVENT_CONFIG.journey_cancelled,
        });
      }
    }

    // Safety check events
    for (const check of (safetyChecksRes.data || []) as any[]) {
      allEvents.push({
        id: `check-sent-${check.id}`,
        type: 'safety_check_sent',
        label: 'Guardian safety check',
        description: check.message || 'Are you safe?',
        timestamp: check.created_at,
        ...EVENT_CONFIG.safety_check_sent,
      });

      if (check.status === 'acknowledged' && check.responded_at) {
        allEvents.push({
          id: `check-safe-${check.id}`,
          type: 'user_responded_safe',
          label: 'User confirmed safe',
          description: 'Safety check response',
          timestamp: check.responded_at,
          ...EVENT_CONFIG.user_responded_safe,
        });
      } else if (check.status === 'help' && check.responded_at) {
        allEvents.push({
          id: `check-help-${check.id}`,
          type: 'user_responded_help',
          label: 'User requested help',
          description: 'Safety check response',
          timestamp: check.responded_at,
          ...EVENT_CONFIG.user_responded_help,
        });
      } else if (check.status === 'need_time' && check.responded_at) {
        allEvents.push({
          id: `check-time-${check.id}`,
          type: 'user_responded_need_time',
          label: 'User needs more time',
          description: 'Safety check response',
          timestamp: check.responded_at,
          ...EVENT_CONFIG.user_responded_need_time,
        });
      } else if (check.status === 'expired' && check.responded_at) {
        allEvents.push({
          id: `check-expired-${check.id}`,
          type: 'safety_check_expired',
          label: 'Safety check expired',
          description: 'No response from user',
          timestamp: check.responded_at,
          ...EVENT_CONFIG.safety_check_expired,
        });
      }
    }

    // Incident events
    for (const incident of (incidentsRes.data || []) as any[]) {
      allEvents.push({
        id: `incident-created-${incident.id}`,
        type: 'incident_created',
        label: `${incident.emergency_type?.toUpperCase()} incident`,
        description: 'Emergency incident created',
        timestamp: incident.created_at,
        ...EVENT_CONFIG.incident_created,
      });

      if (incident.status === 'closed' && incident.closed_at) {
        allEvents.push({
          id: `incident-closed-${incident.id}`,
          type: 'incident_closed',
          label: 'Incident closed',
          description: `${incident.emergency_type?.toUpperCase()} incident resolved`,
          timestamp: incident.closed_at,
          ...EVENT_CONFIG.incident_closed,
        });
      }
    }

    // Sort by timestamp descending and limit
    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEvents(allEvents.slice(0, limit));
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return (
    <Card className="glass-card rounded-2xl border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          Guardian Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Guardian activity will appear here as you use DEYGO
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
                  className="flex items-start gap-3 py-2"
                >
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white/10 bg-white/5">
                      <event.icon className={cn('h-3.5 w-3.5', event.color)} />
                    </div>
                    {i < events.length - 1 && (
                      <div className="mt-1 h-full w-0.5 flex-1 bg-white/5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <div className="text-sm font-medium text-foreground">
                      {event.label}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {event.description}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground/60">
                      {timeAgo(event.timestamp)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
