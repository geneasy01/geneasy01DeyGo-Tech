'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Siren,
  X,
  MapPin,
  Clock,
  Bell,
  Activity,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Users,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { SOSAlert, EmergencyIncident, IncidentStatusHistory } from '@/lib/types';
import {
  createEmergencyIncident,
  updateIncidentStatus,
  getIncidentStatusHistory,
  notifyEmergencyContacts,
  STATUS_FLOW,
  STATUS_LABELS,
} from '@/lib/incidents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type SOSState = 'idle' | 'countdown' | 'sending' | 'sent' | 'error';

const SOS_TIMEOUT_MS = 15000;
const GPS_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

export default function SOSPage() {
  const { user } = useAuth();
  const [sosState, setSosState] = useState<SOSState>('idle');
  const [countdown, setCountdown] = useState(5);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'pending' | 'acquired' | 'denied' | 'timeout' | 'unavailable'>('pending');
  const [recentAlerts, setRecentAlerts] = useState<SOSAlert[]>([]);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [activeIncident, setActiveIncident] = useState<EmergencyIncident | null>(null);
  const [statusHistory, setStatusHistory] = useState<IncidentStatusHistory[]>([]);
  const [contactsNotified, setContactsNotified] = useState(0);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);
  const pendingAlertIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await withTimeout<{
          data: SOSAlert[] | null;
          error: { message: string } | null;
        }>(
          supabase
            .from('sos_alerts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
          SOS_TIMEOUT_MS,
          'Loading recent alerts'
        );
        if (cancelled) return;
        if (error) {
          console.error('Failed to load recent alerts:', error.message);
        } else {
          setRecentAlerts((data || []) as SOSAlert[]);
        }
      } catch (err) {
        if (!cancelled) console.error('Recent alerts fetch failed:', err);
      }
      if (!cancelled) setAlertsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const getLocation = useCallback(() => {
    setLocationStatus('pending');
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('acquired');

        // If alert was already saved without location, update it now
        if (pendingAlertIdRef.current) {
          const alertId = pendingAlertIdRef.current;
          pendingAlertIdRef.current = null;
          supabase
            .from('sos_alerts')
            .update({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              location_status: 'acquired',
            })
            .eq('id', alertId)
            .then(({ error }) => {
              if (error) console.error('[SOS] Failed to update alert with late GPS:', error.message);
            });
        }
      },
      (err) => {
        setLocation(null);
        pendingAlertIdRef.current = null;
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied');
        } else if (err.code === err.TIMEOUT) {
          setLocationStatus('timeout');
        } else {
          setLocationStatus('unavailable');
        }
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 30000 }
    );
  }, []);

  const startSOS = () => {
    getLocation();
    setSosState('countdown');
    setCountdown(5);
    setErrorMessage('');
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          triggerSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelSOS = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSosState('idle');
    setCountdown(5);
    setLocationStatus('pending');
    pendingAlertIdRef.current = null;
  };

  const triggerSOS = async () => {
    if (!user) {
      setErrorMessage('Unable to send SOS — user session not found. Please sign in again.');
      setSosState('error');
      return;
    }
    setSosState('sending');
    setErrorMessage('');

    // Determine location status for the payload
    const locStatus =
      locationStatus === 'acquired' ? 'acquired'
      : locationStatus === 'denied' ? 'denied'
      : locationStatus === 'unavailable' ? 'unavailable'
      : 'GPS Timeout'; // pending or timeout means GPS didn't respond in time

    // Step 1: Save SOS alert immediately — no strict timeout, this is the critical path
    let alertId: string | null = null;
    try {
      const { data, error } = await supabase
        .from('sos_alerts')
        .insert({
          user_id: user.id,
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          location_status: locStatus,
          status: 'active',
          is_duress: false,
        })
        .select()
        .single();

      if (error || !data) throw new Error(error?.message || 'Failed to create SOS alert');
      alertId = data.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMessage(`Failed to send SOS alert: ${msg}. Check your connection and try again.`);
      setSosState('error');
      return;
    }

    // Show success screen immediately — the alert is saved
    setSosState('sent');

    // If GPS was still pending, set up late update when coordinates arrive
    if (locationStatus === 'pending' && alertId) {
      pendingAlertIdRef.current = alertId;
    }

    // Background tasks: incident creation, contact notification, history, refresh
    // These run asynchronously and do not block the success screen
    (async () => {
      // Create emergency incident
      try {
        const incident = await createEmergencyIncident({
          userId: user.id,
          userEmail: user.email,
          emergencyType: 'sos',
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
        });
        if (incident) {
          setIncidentId(incident.id);
          setActiveIncident(incident);

          // Notify emergency contacts
          try {
            const contactResults = await notifyEmergencyContacts(user.id, incident);
            setContactsNotified(contactResults.length);
          } catch (err) {
            console.error('Contact notification failed:', err);
            setContactsNotified(0);
          }

          // Fetch status history
          try {
            const history = await getIncidentStatusHistory(incident.id);
            setStatusHistory(history);
          } catch (err) {
            console.error('Status history fetch failed:', err);
            setStatusHistory([]);
          }
        }
      } catch (err) {
        console.error('Incident creation failed:', err);
      }

      // Refresh recent alerts list
      try {
        const { data: alerts } = await supabase
          .from('sos_alerts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setRecentAlerts((alerts || []) as SOSAlert[]);
      } catch (err) {
        console.error('Alert refresh failed:', err);
      }
    })();
  };

  const resetSOS = () => {
    setSosState('idle');
    setCountdown(5);
    setIncidentId(null);
    setActiveIncident(null);
    setStatusHistory([]);
    setContactsNotified(0);
    setErrorMessage('');
    setLocationStatus('pending');
    pendingAlertIdRef.current = null;
  };

  const resolveAlert = async (id: string) => {
    setResolving(id);
    try {
      await withTimeout(
        supabase
          .from('sos_alerts')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .eq('id', id)
          .then(),
        SOS_TIMEOUT_MS,
        'Alert resolution'
      );

      if (activeIncident && user) {
        try {
          await withTimeout(
            updateIncidentStatus({
              incidentId: activeIncident.id,
              userId: user.id,
              userEmail: user.email,
              newStatus: 'resolved',
              changedBy: 'user',
            }),
            SOS_TIMEOUT_MS,
            'Incident status update'
          );
          const history = await withTimeout(
            getIncidentStatusHistory(activeIncident.id),
            SOS_TIMEOUT_MS,
            'Status history fetch'
          );
          setStatusHistory(history);
        } catch (err) {
          console.error('Incident resolution failed:', err);
        }
      }

      const { data } = await withTimeout<{
        data: SOSAlert[] | null;
        error: { message: string } | null;
      }>(
        supabase
          .from('sos_alerts')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(10),
        SOS_TIMEOUT_MS,
        'Alert refresh'
      );
      setRecentAlerts((data || []) as SOSAlert[]);
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
    setResolving(null);
  };

  // Compute current step index for timeline
  const currentStepIndex = activeIncident
    ? STATUS_FLOW.indexOf(activeIncident.status)
    : -1;

  const locationLabel =
    locationStatus === 'acquired' ? 'GPS Captured'
    : locationStatus === 'denied' ? 'GPS Denied'
    : locationStatus === 'timeout' ? 'GPS Timeout'
    : locationStatus === 'unavailable' ? 'GPS Unavailable'
    : 'GPS Pending';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">SOS Emergency</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Press the button to send an instant emergency alert with your live location.
        </p>
      </div>

      {/* SOS Button Area */}
      <Card className="glass-card rounded-2xl border-white/5">
        <CardContent className="flex flex-col items-center py-12">
          <AnimatePresence mode="wait">
            {/* Idle state */}
            {sosState === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center"
              >
                <div className="relative">
                  <div className="absolute inset-0 animate-pulse-red rounded-full" />
                  <button
                    onClick={startSOS}
                    className="relative flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-glow-red-lg transition-transform hover:scale-105 active:scale-95"
                  >
                    <div className="flex flex-col items-center">
                      <Siren className="h-16 w-16 text-white" />
                      <span className="mt-2 text-2xl font-bold tracking-wider text-white">
                        SOS
                      </span>
                    </div>
                  </button>
                </div>
                <p className="mt-8 text-sm text-muted-foreground">
                  Press to send emergency alert
                </p>
              </motion.div>
            )}

            {/* Countdown state */}
            {sosState === 'countdown' && (
              <motion.div
                key="countdown"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center"
              >
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-glow-red-lg"
                  >
                    <div className="text-7xl font-bold text-white">{countdown}</div>
                  </motion.div>
                </div>
                <p className="mt-8 text-lg font-semibold text-red-400">
                  Sending SOS in {countdown} second{countdown !== 1 ? 's' : ''}...
                </p>
                <Button
                  onClick={cancelSOS}
                  size="lg"
                  variant="outline"
                  className="mt-4 glass"
                >
                  <X className="mr-2 h-5 w-5" />
                  Cancel
                </Button>
              </motion.div>
            )}

            {/* Sending state */}
            {sosState === 'sending' && (
              <motion.div
                key="sending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <div className="flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-glow-red-lg">
                  <Loader2 className="h-16 w-16 animate-spin text-white" />
                </div>
                <p className="mt-8 text-lg font-semibold text-foreground">
                  Sending SOS...
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {locationStatus === 'acquired'
                    ? 'GPS location captured. Sending alert...'
                    : locationStatus === 'denied'
                    ? 'GPS permission denied. Sending without location...'
                    : locationStatus === 'timeout'
                    ? 'GPS timed out. Sending without location...'
                    : locationStatus === 'unavailable'
                    ? 'GPS unavailable. Sending without location...'
                    : 'Acquiring GPS location...'}
                </p>
              </motion.div>
            )}

            {/* Sent state */}
            {sosState === 'sent' && (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-700"
                >
                  <CheckCircle2 className="h-16 w-16 text-white" />
                </motion.div>
                <p className="mt-8 text-lg font-semibold text-green-400">
                  SOS Alert Sent
                </p>
                {incidentId && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Incident ID: {incidentId.slice(0, 8)}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {[
                    { icon: MapPin, label: locationLabel },
                    { icon: Clock, label: 'Time Logged' },
                    { icon: Bell, label: 'You Notified' },
                    { icon: Users, label: `${contactsNotified} Contacts Prepared` },
                    { icon: Activity, label: incidentId ? 'Incident Created' : 'Alert Created' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="glass-card flex items-center gap-2 rounded-full px-3 py-1.5"
                    >
                      <item.icon className={`h-4 w-4 ${
                        item.label.includes('Denied') || item.label.includes('Unavailable') || item.label.includes('Timeout')
                          ? 'text-amber-400'
                          : 'text-green-400'
                      }`} />
                      <span className="text-xs text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={resetSOS} className="mt-6 bg-primary text-white hover:bg-red-600">
                  Done
                </Button>
              </motion.div>
            )}

            {/* Error state */}
            {sosState === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <div className="flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-800">
                  <AlertCircle className="h-16 w-16 text-white" />
                </div>
                <p className="mt-8 text-lg font-semibold text-red-400">
                  SOS Failed
                </p>
                <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                  {errorMessage}
                </p>
                <div className="mt-6 flex gap-3">
                  <Button onClick={resetSOS} variant="outline" className="glass">
                    Dismiss
                  </Button>
                  <Button
                    onClick={startSOS}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    <Siren className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Incident Status Timeline (shown after SOS is sent) */}
      {activeIncident && sosState === 'sent' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="glass-strong rounded-2xl border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Incident Status Timeline</CardTitle>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {STATUS_LABELS[activeIncident.status]}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {STATUS_FLOW.map((status, i) => {
                  const isComplete = i < currentStepIndex;
                  const isCurrent = i === currentStepIndex;
                  const isFuture = i > currentStepIndex;
                  const historyEntry = statusHistory.find((h) => h.to_status === status);

                  return (
                    <div key={status} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                            isComplete
                              ? 'border-green-500 bg-green-500/10'
                              : isCurrent
                              ? 'border-primary bg-primary/10 animate-pulse'
                              : 'border-white/10 bg-white/5'
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                          ) : isCurrent ? (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                          )}
                        </div>
                        {i < STATUS_FLOW.length - 1 && (
                          <div
                            className={`w-0.5 h-8 ${
                              isComplete ? 'bg-green-500/30' : 'bg-white/5'
                            }`}
                          />
                        )}
                      </div>

                      <div className="flex-1 pb-2">
                        <div
                          className={`text-sm font-medium ${
                            isComplete || isCurrent
                              ? 'text-foreground'
                              : 'text-muted-foreground/50'
                          }`}
                        >
                          {STATUS_LABELS[status]}
                        </div>
                        {historyEntry ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(historyEntry.created_at).toLocaleString()}
                            {historyEntry.changed_by === 'admin' && ' · by admin'}
                          </div>
                        ) : isFuture ? (
                          <div className="mt-0.5 text-xs text-muted-foreground/40">
                            Pending
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeIncident.status !== 'resolved' && activeIncident.status !== 'closed' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-500/10 p-3">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="flex-1 text-sm text-muted-foreground">
                    Safe now? Mark this incident as resolved.
                  </span>
                  <Button
                    size="sm"
                    className="bg-green-600 text-white hover:bg-green-700"
                    disabled={resolving === activeIncident.id}
                    onClick={() => resolveAlert(activeIncident.id)}
                  >
                    {resolving === activeIncident.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Resolve'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-amber-400">Note:</span> When SOS is
          triggered, DEYGO saves your GPS location, logs the time, creates an
          emergency incident, and prepares notifications for your trusted
          contacts. In a real emergency, also call 112.
        </div>
      </div>

      {/* Recent Incidents */}
      <Card className="glass-card rounded-2xl border-white/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent SOS Alerts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : recentAlerts.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Siren className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No incidents yet. Stay safe!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
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
                  {alert.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="glass text-xs"
                      disabled={resolving === alert.id}
                      onClick={() => resolveAlert(alert.id)}
                    >
                      {resolving === alert.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Resolve'
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
