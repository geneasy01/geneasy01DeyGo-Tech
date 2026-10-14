'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation,
  MapPin,
  Clock,
  Users,
  Flag,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Battery,
  BatteryCharging,
  Satellite,
  SatelliteDish,
  AlertTriangle,
  Timer,
  Gauge,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Heart,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { LocationService } from '@/lib/location-service';
import {
  calculateJourneyDuration,
  calculateRemainingTime,
  assessJourney,
  createSafetyCheck,
  resolveSafetyCheck,
  generateEscalationRecommendation,
  getJourneyDisplayState,
  JOURNEY_STATE_LABELS,
} from '@/lib/guardian';
import type { JourneyDisplayState } from '@/lib/guardian';
import { getBatteryState, isOnline } from '@/lib/system-health';
import type { Journey, Contact, LocationReading, SafetyCheck as SafetyCheckRecord } from '@/lib/types';
import { JourneyMap } from '@/components/journey-map';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type GpsStatus = 'idle' | 'searching' | 'active' | 'denied' | 'error';
type SignalQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

interface SafetyCheckRow {
  id: string;
  journey_id: string;
  user_id: string;
  message: string;
  status: string;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
}

interface TimelineEvent {
  label: string;
  time: string;
  icon: typeof Clock;
  color: string;
}

export default function JourneyPage() {
  const { user } = useAuth();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [eta, setEta] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [pastJourneys, setPastJourneys] = useState<Journey[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Journey state management
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [signalQuality, setSignalQuality] = useState<SignalQuality>('unknown');
  const [currentLocation, setCurrentLocation] = useState<LocationReading | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Guardian monitoring
  const [monitorState, setMonitorState] = useState<'normal' | 'watch' | 'concern' | 'alert' | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [safetyCheck, setSafetyCheck] = useState<SafetyCheckRow | null>(null);
  const [ignoredChecks, setIgnoredChecks] = useState(0);
  const [expandedJourney, setExpandedJourney] = useState<string | null>(null);
  const [journeySafetyChecks, setJourneySafetyChecks] = useState<Record<string, SafetyCheckRow[]>>({});

  const locationServiceRef = useRef<LocationService | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─────────────────────────────────────────────────────────────────────
  // Initial data load
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [contactsRes, activeRes, pastRes] = await Promise.all([
        supabase.from('contacts').select('*').eq('user_id', user.id),
        supabase
          .from('journeys')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('journeys')
          .select('*')
          .eq('user_id', user.id)
          .neq('status', 'active')
          .order('started_at', { ascending: false })
          .limit(10),
      ]);

      setContacts((contactsRes.data || []) as Contact[]);
      setActiveJourney(activeRes.data as Journey | null);
      setPastJourneys((pastRes.data || []) as Journey[]);
      setLoading(false);
    })();
  }, [user]);

  // ─────────────────────────────────────────────────────────────────────
  // Online/offline monitoring
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setOnline(isOnline());
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // Battery monitoring
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const battery = await getBatteryState();
      if (cancelled) return;
      setBatteryLevel(battery.level);
      setBatteryCharging(battery.charging);
    })();
    return () => { cancelled = true; };
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // Start GPS tracking when an active journey exists
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeJourney) {
      setGpsStatus('idle');
      setSignalQuality('unknown');
      setCurrentLocation(null);
      setMonitorState(null);
      setConfidenceScore(null);
      setSafetyCheck(null);
      setIgnoredChecks(0);
      return;
    }

    const service = new LocationService();
    locationServiceRef.current = service;
    setGpsStatus('searching');

    service.onReading((reading) => {
      setGpsStatus('active');
      setCurrentLocation(reading);
      setSignalQuality(service.getSignalQuality());
    });

    service.onError((err) => {
      if (err.code === 'permission_denied') {
        setGpsStatus('denied');
      } else {
        setGpsStatus('error');
      }
    });

    service.onStateChange((state) => {
      if (state === 'stopped' || state === 'idle') {
        setGpsStatus('idle');
      }
    });

    service.startTracking({ enableHighAccuracy: true, intervalMs: 5000 }).catch(() => {
      setGpsStatus('error');
    });

    return () => {
      service.destroy();
      locationServiceRef.current = null;
    };
  }, [activeJourney]);

  // ─────────────────────────────────────────────────────────────────────
  // Journey duration ticker + Guardian monitoring loop
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeJourney) {
      setElapsedMs(0);
      if (tickRef.current) clearInterval(tickRef.current);
      if (monitorRef.current) clearInterval(monitorRef.current);
      return;
    }
    const startedAt = new Date(activeJourney.started_at).getTime();
    setElapsedMs(Date.now() - startedAt);

    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);

    // Guardian monitoring loop — runs every 15 seconds
    const runMonitoring = async () => {
      if (!activeJourney || !locationServiceRef.current || !user) return;

      const expectedArrival = activeJourney.expected_arrival
        ? new Date(activeJourney.expected_arrival).getTime()
        : null;

      const snapshot = assessJourney({
        journeyId: activeJourney.id,
        userId: user.id,
        startedAt,
        expectedArrival,
        locationService: locationServiceRef.current,
        safetyChecksIgnored: ignoredChecks,
      });

      setMonitorState(snapshot.state);
      setConfidenceScore(snapshot.confidence.score);

      // Check if we need to send a safety check
      const recommendation = generateEscalationRecommendation(snapshot);

      if (recommendation.shouldSendSafetyCheck && !safetyCheck) {
        // Create a safety check in the database
        const check = createSafetyCheck({
          journeyId: activeJourney.id,
          userId: user.id,
          message: 'Are you safe? Tap to confirm.',
          timeoutMinutes: 5,
        });

        const { data, error: insertError } = await supabase
          .from('safety_checks')
          .insert({
            id: check.id,
            journey_id: activeJourney.id,
            user_id: user.id,
            message: check.message,
            status: 'pending',
            expires_at: new Date(check.expiresAt).toISOString(),
          })
          .select()
          .single();

        if (!insertError && data) {
          setSafetyCheck(data as SafetyCheckRow);
        }
      }
    };

    // Run immediately, then every 15 seconds
    runMonitoring();
    monitorRef.current = setInterval(runMonitoring, 15000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (monitorRef.current) clearInterval(monitorRef.current);
    };
  }, [activeJourney, user, ignoredChecks, safetyCheck]);

  // ─────────────────────────────────────────────────────────────────────
  // Safety check expiry monitor
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!safetyCheck) return;
    const expiryMs = new Date(safetyCheck.expires_at).getTime();
    const now = Date.now();
    if (now >= expiryMs) {
      handleSafetyCheckExpire();
      return;
    }
    const timer = setTimeout(handleSafetyCheckExpire, expiryMs - now);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safetyCheck]);

  // ─────────────────────────────────────────────────────────────────────
  // Journey actions
  // ─────────────────────────────────────────────────────────────────────
  const startJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!origin.trim() || !destination.trim()) {
      setError('Please enter origin and destination');
      return;
    }
    setStarting(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('journeys')
      .insert({
        user_id: user.id,
        origin: origin.trim(),
        destination: destination.trim(),
        expected_arrival: eta || null,
        status: 'active',
        contact_ids: selectedContacts,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setStarting(false);
    } else {
      setActiveJourney(data as Journey);
      setOrigin('');
      setDestination('');
      setEta('');
      setSelectedContacts([]);
      setStarting(false);
    }
  };

  const endJourney = async (status: 'completed' | 'cancelled') => {
    if (!activeJourney) return;
    await supabase
      .from('journeys')
      .update({
        status,
        completed_at: new Date().toISOString(),
      })
      .eq('id', activeJourney.id);

    setPastJourneys([activeJourney, ...pastJourneys]);
    setActiveJourney(null);
  };

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  // ─────────────────────────────────────────────────────────────────────
  // Safety check actions
  // ─────────────────────────────────────────────────────────────────────
  const respondToSafetyCheck = async (response: 'acknowledged' | 'need_time' | 'help') => {
    if (!safetyCheck || !user) return;

    await supabase
      .from('safety_checks')
      .update({
        status: response,
        responded_at: new Date().toISOString(),
      })
      .eq('id', safetyCheck.id);

    setSafetyCheck(null);

    if (response === 'acknowledged') {
      // Reset monitoring — user confirmed safe
      setMonitorState('normal');
      setIgnoredChecks(0);
    } else if (response === 'need_time') {
      // User needs more time — reset the clock but keep monitoring
      setMonitorState('watch');
    } else if (response === 'help') {
      // User needs help — escalate monitoring to alert
      setMonitorState('alert');
    }
  };

  const handleSafetyCheckExpire = async () => {
    if (!safetyCheck || !user) return;

    await supabase
      .from('safety_checks')
      .update({
        status: 'expired',
        responded_at: new Date().toISOString(),
      })
      .eq('id', safetyCheck.id);

    setSafetyCheck(null);
    setIgnoredChecks((prev) => prev + 1);
  };

  // ─────────────────────────────────────────────────────────────────────
  // Journey timeline expansion
  // ─────────────────────────────────────────────────────────────────────
  const toggleJourneyExpand = async (journeyId: string) => {
    if (expandedJourney === journeyId) {
      setExpandedJourney(null);
      return;
    }
    setExpandedJourney(journeyId);

    if (!journeySafetyChecks[journeyId]) {
      const { data } = await supabase
        .from('safety_checks')
        .select('*')
        .eq('journey_id', journeyId)
        .order('created_at', { ascending: true });

      setJourneySafetyChecks((prev) => ({
        ...prev,
        [journeyId]: (data || []) as SafetyCheckRow[],
      }));
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────────────
  const duration = activeJourney
    ? calculateJourneyDuration(new Date(activeJourney.started_at).getTime())
    : null;

  const remaining = activeJourney?.expected_arrival
    ? calculateRemainingTime(new Date(activeJourney.expected_arrival).getTime())
    : null;

  const displayState: JourneyDisplayState = activeJourney
    ? getJourneyDisplayState({
        expectedArrival: activeJourney.expected_arrival
          ? new Date(activeJourney.expected_arrival).getTime()
          : null,
        monitorState,
      })
    : 'on_schedule';

  // ─────────────────────────────────────────────────────────────────────
  // Indicator helpers
  // ─────────────────────────────────────────────────────────────────────
  const gpsStatusConfig: Record<GpsStatus, { label: string; color: string; icon: typeof Satellite }> = {
    idle: { label: 'Idle', color: 'text-muted-foreground', icon: Satellite },
    searching: { label: 'Searching…', color: 'text-amber-400', icon: SatelliteDish },
    active: { label: 'GPS Active', color: 'text-green-400', icon: Satellite },
    denied: { label: 'Permission Denied', color: 'text-red-400', icon: AlertTriangle },
    error: { label: 'GPS Error', color: 'text-red-400', icon: AlertTriangle },
  };

  const signalConfig: Record<SignalQuality, { label: string; color: string }> = {
    excellent: { label: 'Excellent', color: 'text-green-400' },
    good: { label: 'Good', color: 'text-green-400' },
    fair: { label: 'Fair', color: 'text-amber-400' },
    poor: { label: 'Poor', color: 'text-red-400' },
    unknown: { label: 'Unknown', color: 'text-muted-foreground' },
  };

  const stateConfig: Record<JourneyDisplayState, { label: string; color: string; bg: string; icon: typeof Shield }> = {
    on_schedule: { label: JOURNEY_STATE_LABELS.on_schedule, color: 'text-green-400', bg: 'bg-green-500/10', icon: ShieldCheck },
    approaching_eta: { label: JOURNEY_STATE_LABELS.approaching_eta, color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
    overdue: { label: JOURNEY_STATE_LABELS.overdue, color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
    guardian_monitoring: { label: JOURNEY_STATE_LABELS.guardian_monitoring, color: 'text-purple-400', bg: 'bg-purple-500/10', icon: ShieldAlert },
  };

  const batteryPercent = batteryLevel !== null ? Math.round(batteryLevel * 100) : null;
  const batteryColor =
    batteryPercent === null
      ? 'text-muted-foreground'
      : batteryPercent <= 15
      ? 'text-red-400'
      : batteryPercent <= 30
      ? 'text-amber-400'
      : 'text-green-400';

  const GpsIcon = gpsStatusConfig[gpsStatus].icon;
  const StateIcon = stateConfig[displayState].icon;

  // ─────────────────────────────────────────────────────────────────────
  // Timeline builder for past journeys
  // ─────────────────────────────────────────────────────────────────────
  const buildTimeline = (journey: Journey, checks: SafetyCheckRow[]): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    events.push({
      label: `Journey started from ${journey.origin}`,
      time: new Date(journey.started_at).toLocaleString(),
      icon: Navigation,
      color: 'text-blue-400',
    });

    checks.forEach((check) => {
      const statusLabel =
        check.status === 'acknowledged' ? 'confirmed safe'
        : check.status === 'need_time' ? 'requested more time'
        : check.status === 'help' ? 'requested help'
        : check.status === 'expired' ? 'expired (no response)'
        : check.status;

      events.push({
        label: `Guardian safety check: ${statusLabel}`,
        time: new Date(check.created_at).toLocaleString(),
        icon: check.status === 'help' ? AlertTriangle : check.status === 'expired' ? AlertTriangle : Shield,
        color: check.status === 'acknowledged' ? 'text-green-400'
          : check.status === 'help' ? 'text-red-400'
          : check.status === 'expired' ? 'text-amber-400'
          : 'text-purple-400',
      });
    });

    if (journey.completed_at) {
      events.push({
        label: journey.status === 'completed' ? 'Arrived safely' : 'Journey cancelled',
        time: new Date(journey.completed_at).toLocaleString(),
        icon: journey.status === 'completed' ? CheckCircle2 : XCircle,
        color: journey.status === 'completed' ? 'text-green-400' : 'text-red-400',
      });
    }

    return events;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Journey Guard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your trip details and let DEYGO monitor your journey for safety.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {activeJourney ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-strong overflow-hidden rounded-2xl border-blue-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Navigation className="h-5 w-5 text-blue-400" />
                    Active Journey
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${stateConfig[displayState].bg} ${stateConfig[displayState].color}`}>
                      <StateIcon className="h-3.5 w-3.5" />
                      {stateConfig[displayState].label}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Live Map */}
                <JourneyMap
                  origin={activeJourney.origin}
                  destination={activeJourney.destination}
                  currentLocation={currentLocation}
                  displayState={displayState}
                  etaLabel={remaining?.remainingFormatted}
                  confidenceScore={confidenceScore}
                />

                {/* Guardian Safety Check Prompt */}
                <AnimatePresence>
                  {safetyCheck && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20">
                          <ShieldAlert className="h-5 w-5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-foreground">
                            Guardian Safety Check
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {safetyCheck.message}
                          </p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <Button
                              size="sm"
                              className="bg-green-600 text-white hover:bg-green-700"
                              onClick={() => respondToSafetyCheck('acknowledged')}
                            >
                              <CheckCircle2 className="mr-1.5 h-4 w-4" />
                              Yes, I&apos;m Safe
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="glass border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                              onClick={() => respondToSafetyCheck('need_time')}
                            >
                              <Clock className="mr-1.5 h-4 w-4" />
                              Need More Time
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-600 text-white hover:bg-red-700"
                              onClick={() => respondToSafetyCheck('help')}
                            >
                              <HelpCircle className="mr-1.5 h-4 w-4" />
                              I Need Help
                            </Button>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground/60">
                            Expires in {Math.max(0, Math.round((new Date(safetyCheck.expires_at).getTime() - Date.now()) / 60000))} min
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* System indicators */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* GPS Status */}
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <GpsIcon className={`h-3.5 w-3.5 ${gpsStatusConfig[gpsStatus].color}`} />
                      GPS
                    </div>
                    <div className={`mt-1 text-sm font-medium ${gpsStatusConfig[gpsStatus].color}`}>
                      {gpsStatusConfig[gpsStatus].label}
                    </div>
                  </div>

                  {/* Signal Quality */}
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <SatelliteDish className={`h-3.5 w-3.5 ${signalConfig[signalQuality].color}`} />
                      Signal
                    </div>
                    <div className={`mt-1 text-sm font-medium ${signalConfig[signalQuality].color}`}>
                      {signalConfig[signalQuality].label}
                    </div>
                    {currentLocation && (
                      <div className="mt-0.5 text-xs text-muted-foreground/60">
                        ±{currentLocation.accuracy.toFixed(0)}m
                      </div>
                    )}
                  </div>

                  {/* Battery */}
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {batteryCharging ? (
                        <BatteryCharging className={`h-3.5 w-3.5 ${batteryColor}`} />
                      ) : (
                        <Battery className={`h-3.5 w-3.5 ${batteryColor}`} />
                      )}
                      Battery
                    </div>
                    <div className={`mt-1 text-sm font-medium ${batteryColor}`}>
                      {batteryPercent !== null ? `${batteryPercent}%` : 'N/A'}
                    </div>
                  </div>

                  {/* Connection */}
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {online ? (
                        <Wifi className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-red-400" />
                      )}
                      Connection
                    </div>
                    <div
                      className={`mt-1 text-sm font-medium ${
                        online ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>

                {/* Journey details */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> From
                    </div>
                    <div className="mt-1 truncate text-sm font-medium text-foreground">
                      {activeJourney.origin}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Flag className="h-3 w-3" /> To
                    </div>
                    <div className="mt-1 truncate text-sm font-medium text-foreground">
                      {activeJourney.destination}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Timer className="h-3 w-3" /> Duration
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {duration?.durationFormatted ?? '—'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> Contacts
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {activeJourney.contact_ids?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Remaining time / ETA */}
                {activeJourney.expected_arrival && remaining && (
                  <div
                    className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
                      remaining.overdue
                        ? 'bg-red-500/10 text-red-400'
                        : remaining.remainingMinutes <= 10
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-blue-500/10 text-blue-400'
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    <span className="text-muted-foreground">
                      {remaining.overdue ? 'Overdue by:' : 'Time remaining:'}
                    </span>
                    <span className="font-medium">
                      {remaining.remainingFormatted}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      ETA: {new Date(activeJourney.expected_arrival).toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Guardian confidence indicator */}
                {confidenceScore !== null && monitorState && (
                  <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
                    monitorState === 'normal' ? 'bg-green-500/10 text-green-400'
                    : monitorState === 'watch' ? 'bg-blue-500/10 text-blue-400'
                    : monitorState === 'concern' ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-red-500/10 text-red-400'
                  }`}>
                    <Shield className="h-4 w-4" />
                    <span className="text-muted-foreground">Guardian confidence:</span>
                    <span className="font-medium">{confidenceScore}/100</span>
                    <span className="ml-auto text-xs capitalize">{monitorState.replace('_', ' ')}</span>
                  </div>
                )}

                {/* Current coordinates */}
                {currentLocation && (
                  <div className="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-blue-400" />
                    <span>
                      {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                    </span>
                    {currentLocation.speed !== null && currentLocation.speed > 0 && (
                      <span className="ml-auto flex items-center gap-1">
                        <Gauge className="h-3.5 w-3.5" />
                        {(currentLocation.speed * 3.6).toFixed(0)} km/h
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="flex-1 bg-green-600 text-white hover:bg-green-700"
                    onClick={() => endJourney('completed')}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    I&apos;ve Arrived Safely
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 glass text-red-400 hover:bg-red-500/10"
                    onClick={() => endJourney('cancelled')}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Journey
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-card rounded-2xl border-white/5">
              <CardHeader>
                <CardTitle className="text-lg">Start a New Journey</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
                <form onSubmit={startJourney} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="origin">Origin</Label>
                      <div className="relative">
                        <Circle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-400" />
                        <Input
                          id="origin"
                          placeholder="Starting point"
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="destination">Destination</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-400" />
                        <Input
                          id="destination"
                          placeholder="Where are you going?"
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eta">Expected Arrival Time</Label>
                    <Input
                      id="eta"
                      type="datetime-local"
                      value={eta}
                      onChange={(e) => setEta(e.target.value)}
                    />
                  </div>

                  {/* Contact selection */}
                  <div className="space-y-2">
                    <Label>Emergency Contacts to Notify</Label>
                    {contacts.length === 0 ? (
                      <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                        <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          No contacts added yet.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/60">
                          Add contacts to notify them during your journey.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {contacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => toggleContact(contact.id)}
                            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                              selectedContacts.includes(contact.id)
                                ? 'border-blue-500/30 bg-blue-500/10'
                                : 'border-white/5 bg-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-red-700 text-xs font-bold text-white">
                              {contact.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {contact.name}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {contact.relationship || contact.category}
                              </div>
                            </div>
                            {selectedContacts.includes(contact.id) && (
                              <CheckCircle2 className="h-4 w-4 text-blue-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary text-white hover:bg-red-600"
                    disabled={starting}
                  >
                    {starting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Navigation className="mr-2 h-4 w-4" />
                        Start Journey
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Past Journeys with Timeline */}
      <Card className="glass-card rounded-2xl border-white/5">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Past Journeys</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : pastJourneys.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Navigation className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No past journeys yet.</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Start a journey to see it here after completion.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastJourneys.map((journey) => {
                const isExpanded = expandedJourney === journey.id;
                const checks = journeySafetyChecks[journey.id] || [];
                const timeline = isExpanded ? buildTimeline(journey, checks) : [];

                return (
                  <div
                    key={journey.id}
                    className="rounded-xl bg-white/5"
                  >
                    <button
                      onClick={() => toggleJourneyExpand(journey.id)}
                      className="flex w-full items-center gap-3 p-4 text-left"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          journey.status === 'completed'
                            ? 'bg-green-500/10'
                            : 'bg-red-500/10'
                        }`}
                      >
                        {journey.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {journey.origin} → {journey.destination}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(journey.started_at).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          journey.status === 'completed'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {journey.status}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-white/5 px-4 py-4">
                            {/* Timeline */}
                            <div className="space-y-1">
                              {timeline.map((event, i) => (
                                <div key={i} className="flex items-start gap-3">
                                  <div className="flex flex-col items-center">
                                    <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/10 bg-white/5`}>
                                      <event.icon className={`h-3.5 w-3.5 ${event.color}`} />
                                    </div>
                                    {i < timeline.length - 1 && (
                                      <div className="w-0.5 h-6 bg-white/5" />
                                    )}
                                  </div>
                                  <div className="pb-2">
                                    <div className="text-sm text-foreground">
                                      {event.label}
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                      {event.time}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Journey metadata */}
                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                              <div className="rounded-lg bg-white/5 p-2.5">
                                <div className="text-xs text-muted-foreground">Start</div>
                                <div className="mt-0.5 text-sm text-foreground">{journey.origin}</div>
                              </div>
                              <div className="rounded-lg bg-white/5 p-2.5">
                                <div className="text-xs text-muted-foreground">Destination</div>
                                <div className="mt-0.5 text-sm text-foreground">{journey.destination}</div>
                              </div>
                              <div className="rounded-lg bg-white/5 p-2.5">
                                <div className="text-xs text-muted-foreground">Guardian Interventions</div>
                                <div className="mt-0.5 text-sm text-foreground">{checks.length}</div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
