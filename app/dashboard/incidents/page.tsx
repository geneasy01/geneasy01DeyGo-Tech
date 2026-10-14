'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Siren,
  Clock,
  MapPin,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Activity,
  Navigation,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getUserIncidents, getIncidentStatusHistory, STATUS_FLOW, STATUS_LABELS } from '@/lib/incidents';
import type { EmergencyIncident, IncidentStatusHistory, IncidentStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const statusConfig: Record<IncidentStatus, { color: string; bg: string; icon: typeof Siren }> = {
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  accepted: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Activity },
  responder_en_route: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: Navigation },
  arrived: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
  resolved: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
  closed: { color: 'text-muted-foreground', bg: 'bg-white/5', icon: CheckCircle2 },
};

export default function IncidentHistoryPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<string, IncidentStatusHistory[]>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await getUserIncidents(user.id);
      setIncidents(data);
      setLoading(false);
    })();
  }, [user]);

  const toggleExpand = async (incident: EmergencyIncident) => {
    if (expandedId === incident.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(incident.id);
    if (!historyMap[incident.id]) {
      const history = await getIncidentStatusHistory(incident.id);
      setHistoryMap((prev) => ({ ...prev, [incident.id]: history }));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Incident History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A complete record of your emergency incidents and their resolution.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : incidents.length === 0 ? (
        <Card className="glass-card rounded-2xl border-white/5">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Siren className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No incidents recorded. Stay safe!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {incidents.map((incident, i) => {
              const config = statusConfig[incident.status];
              const isExpanded = expandedId === incident.id;
              const history = historyMap[incident.id] || [];
              const currentStepIndex = STATUS_FLOW.indexOf(incident.status);

              return (
                <motion.div
                  key={incident.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card className="glass-card rounded-2xl border-white/5 transition-all hover:border-white/10">
                    <CardContent className="p-4">
                      {/* Summary row */}
                      <button
                        onClick={() => toggleExpand(incident)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bg}`}>
                          <config.icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold capitalize text-foreground">
                              {incident.emergency_type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              #{incident.id.slice(0, 8)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(incident.triggered_at).toLocaleString()}
                            </span>
                            {incident.latitude && incident.longitude && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {incident.latitude.toFixed(2)}, {incident.longitude.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                            {STATUS_LABELS[incident.status]}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Expanded timeline */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 border-t border-white/5 pt-4">
                              {/* Incident details */}
                              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-xl bg-white/5 p-3">
                                  <div className="text-xs text-muted-foreground">Type</div>
                                  <div className="mt-1 text-sm font-medium capitalize text-foreground">
                                    {incident.emergency_type}
                                  </div>
                                </div>
                                <div className="rounded-xl bg-white/5 p-3">
                                  <div className="text-xs text-muted-foreground">Responder</div>
                                  <div className="mt-1 text-sm font-medium text-foreground">
                                    {incident.assigned_responder || 'Unassigned'}
                                  </div>
                                </div>
                                <div className="rounded-xl bg-white/5 p-3">
                                  <div className="text-xs text-muted-foreground">Resolved</div>
                                  <div className="mt-1 text-sm font-medium text-foreground">
                                    {incident.resolved_at
                                      ? new Date(incident.resolved_at).toLocaleDateString()
                                      : '—'}
                                  </div>
                                </div>
                                <div className="rounded-xl bg-white/5 p-3">
                                  <div className="text-xs text-muted-foreground">Closed</div>
                                  <div className="mt-1 text-sm font-medium text-foreground">
                                    {incident.closed_at
                                      ? new Date(incident.closed_at).toLocaleDateString()
                                      : '—'}
                                  </div>
                                </div>
                              </div>

                              {incident.notes && (
                                <div className="mb-4 flex items-start gap-2 rounded-xl bg-white/5 p-3">
                                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
                                  <div className="text-sm text-muted-foreground">
                                    {incident.notes}
                                  </div>
                                </div>
                              )}

                              {/* Status timeline */}
                              <div className="space-y-1">
                                {STATUS_FLOW.map((status, si) => {
                                  const isComplete = si < currentStepIndex;
                                  const isCurrent = si === currentStepIndex;
                                  const isFuture = si > currentStepIndex;
                                  const entry = history.find((h) => h.to_status === status);
                                  const StatusIcon = statusConfig[status].icon;

                                  return (
                                    <div key={status} className="flex items-start gap-3">
                                      <div className="flex flex-col items-center">
                                        <div
                                          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                                            isComplete
                                              ? 'border-green-500 bg-green-500/10'
                                              : isCurrent
                                              ? 'border-primary bg-primary/10'
                                              : 'border-white/10 bg-white/5'
                                          }`}
                                        >
                                          {isComplete ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                          ) : isCurrent ? (
                                            <StatusIcon className={`h-3.5 w-3.5 ${statusConfig[status].color}`} />
                                          ) : (
                                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                                          )}
                                        </div>
                                        {si < STATUS_FLOW.length - 1 && (
                                          <div className={`w-0.5 h-6 ${isComplete ? 'bg-green-500/30' : 'bg-white/5'}`} />
                                        )}
                                      </div>
                                      <div className="pb-2">
                                        <div className={`text-sm font-medium ${isFuture ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                                          {STATUS_LABELS[status]}
                                        </div>
                                        {entry ? (
                                          <div className="mt-0.5 text-xs text-muted-foreground">
                                            {new Date(entry.created_at).toLocaleString()}
                                            {entry.changed_by === 'admin' && ' · by admin'}
                                          </div>
                                        ) : isFuture ? (
                                          <div className="mt-0.5 text-xs text-muted-foreground/40">Pending</div>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
