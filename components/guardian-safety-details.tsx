'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  Navigation,
  Clock,
  Activity,
  AlertTriangle,
  MapPin,
  Satellite,
  SatelliteDish,
  Wifi,
  WifiOff,
  Battery,
  BatteryCharging,
  CheckCircle2,
  X,
  Wallet as WalletIcon,
  Users,
  UserCircle,
  Bell,
  Sparkles,
  Mic,
  Bluetooth,
  Radio,
  Watch,
  CloudOff,
  type LucideIcon,
} from 'lucide-react';
import type { Journey, JourneyMonitorState, LocationReading } from '@/lib/types';
import type { JourneyDisplayState } from '@/lib/guardian';
import {
  JOURNEY_STATE_LABELS,
  calculateJourneyDuration,
  calculateRemainingTime,
} from '@/lib/guardian';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Guardian Safety Details — collapsible secondary dashboard
// ─────────────────────────────────────────────────────────────────────────────
// This is the monitoring dashboard, collapsed by default beneath the
// conversational UI. It reuses the exact same widgets that lived in the old
// Guardian panel. No engine logic is duplicated — it only renders data
// computed by the Guardian/Confidence engines and passed in as props.

interface SafetyDetailsProps {
  confidenceScore: number | null;
  activeJourney: Journey | null;
  monitorState: JourneyMonitorState | null;
  displayState: JourneyDisplayState;
  recommendation: string | null;
  currentLocation: LocationReading | null;
  online: boolean;
  gpsActive: boolean;
  gpsPermission: string;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  walletComplete: boolean;
  contactsCount: number;
  profileComplete: boolean;
  unreadNotifications: number;
}

function getConfidenceColor(score: number) {
  if (score >= 80) return { text: 'text-green-400', bg: 'bg-green-500/10', bar: 'bg-green-500', label: 'SAFE' };
  if (score >= 50) return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', bar: 'bg-yellow-500', label: 'CAUTION' };
  if (score >= 25) return { text: 'text-orange-400', bg: 'bg-orange-500/10', bar: 'bg-orange-500', label: 'WARNING' };
  return { text: 'text-red-400', bg: 'bg-red-500/10', bar: 'bg-red-500', label: 'DANGER' };
}

const STATE_CONFIG: Record<JourneyDisplayState, { color: string; bg: string; icon: LucideIcon }> = {
  on_schedule: { color: 'text-green-400', bg: 'bg-green-500/10', icon: ShieldCheck },
  approaching_eta: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  overdue: { color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
  guardian_monitoring: { color: 'text-purple-400', bg: 'bg-purple-500/10', icon: ShieldAlert },
};

function StatusTile({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  status: 'good' | 'warning' | 'danger' | 'neutral';
}) {
  const color =
    status === 'good' ? 'text-green-400'
    : status === 'warning' ? 'text-amber-400'
    : status === 'danger' ? 'text-red-400'
    : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/5 p-2.5">
      <Icon className={cn('h-4 w-4 shrink-0', color)} />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn('truncate text-sm font-medium', color)}>{value}</div>
      </div>
      {status === 'good' && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />}
      {status === 'danger' && <X className="h-4 w-4 shrink-0 text-red-400" />}
    </div>
  );
}

export function GuardianSafetyDetails({
  confidenceScore,
  activeJourney,
  monitorState,
  displayState,
  recommendation,
  online,
  gpsActive,
  gpsPermission,
  batteryLevel,
  batteryCharging,
  walletComplete,
  contactsCount,
  profileComplete,
  unreadNotifications,
}: SafetyDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  const confidenceConfig = confidenceScore !== null ? getConfidenceColor(confidenceScore) : getConfidenceColor(100);
  const batteryPercent = batteryLevel !== null ? Math.round(batteryLevel * 100) : null;
  const batteryColor =
    batteryPercent === null ? 'text-muted-foreground'
    : batteryPercent <= 15 ? 'text-red-400'
    : batteryPercent <= 30 ? 'text-amber-400'
    : 'text-green-400';

  const StateIcon = STATE_CONFIG[displayState].icon;

  const remaining = activeJourney?.expected_arrival
    ? calculateRemainingTime(new Date(activeJourney.expected_arrival).getTime())
    : null;
  const duration = activeJourney
    ? calculateJourneyDuration(new Date(activeJourney.started_at).getTime())
    : null;

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-expanded={expanded}
        aria-controls="guardian-safety-details-panel"
      >
        <Shield className={cn('h-4 w-4', confidenceConfig.text)} />
        <span className="flex-1 text-sm font-medium text-foreground">View Safety Details</span>
        <span className={cn('text-xs font-bold tracking-wider', confidenceConfig.text)}>
          {confidenceScore ?? 100}%
        </span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="guardian-safety-details-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-4 pt-1">
              {/* Confidence Score */}
              <div className={cn('rounded-xl border border-white/5 p-3', confidenceConfig.bg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className={cn('h-4 w-4', confidenceConfig.text)} />
                    <span className="text-sm font-medium text-foreground">Guardian Confidence</span>
                  </div>
                  <span className={cn('text-xl font-bold', confidenceConfig.text)}>{confidenceScore ?? 100}%</span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${confidenceScore ?? 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={cn('h-full rounded-full', confidenceConfig.bar)}
                  />
                </div>
                <div className={cn('mt-1.5 text-xs font-bold tracking-wider', confidenceConfig.text)}>
                  {confidenceConfig.label}
                </div>
              </div>

              {/* Journey */}
              {activeJourney ? (
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-foreground">Current Journey</span>
                    </div>
                    <span className={cn(
                      'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                      STATE_CONFIG[displayState].bg,
                      STATE_CONFIG[displayState].color
                    )}>
                      <StateIcon className="h-3 w-3" />
                      {JOURNEY_STATE_LABELS[displayState]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 text-green-400" />
                    <span className="truncate">{activeJourney.origin}</span>
                    <ChevronDown className="h-3 w-3 -rotate-90" />
                    <MapPin className="h-3 w-3 text-red-400" />
                    <span className="truncate">{activeJourney.destination}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-white/5 p-2">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" /> Duration</div>
                      <div className="mt-0.5 text-xs font-medium text-foreground">{duration?.durationFormatted ?? '—'}</div>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Activity className="h-3 w-3" /> Remaining</div>
                      <div className={cn('mt-0.5 text-xs font-medium', remaining?.overdue ? 'text-red-400' : 'text-foreground')}>
                        {remaining?.remainingFormatted ?? '—'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" /> ETA</div>
                      <div className="mt-0.5 truncate text-xs font-medium text-foreground">
                        {activeJourney.expected_arrival
                          ? new Date(activeJourney.expected_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </div>
                    </div>
                  </div>
                  {monitorState && (
                    <div className={cn(
                      'mt-2 flex items-center gap-2 rounded-lg p-2 text-xs',
                      monitorState === 'normal' ? 'bg-green-500/10 text-green-400'
                      : monitorState === 'watch' ? 'bg-blue-500/10 text-blue-400'
                      : monitorState === 'concern' ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-red-500/10 text-red-400'
                    )}>
                      <Shield className="h-3 w-3" />
                      <span className="text-muted-foreground">Monitoring:</span>
                      <span className="font-medium capitalize">{monitorState.replace('_', ' ')}</span>
                    </div>
                  )}
                  {recommendation && monitorState && monitorState !== 'normal' && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-purple-500/10 p-2 text-xs text-purple-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{recommendation}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">No Active Journey</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground/60">Start one from the Journey Guard page to enable monitoring.</p>
                </div>
              )}

              {/* System Status Grid */}
              <div className="grid grid-cols-2 gap-2">
                <StatusTile
                  icon={gpsActive ? Satellite : SatelliteDish}
                  label="GPS"
                  value={gpsActive ? 'Active' : gpsPermission === 'denied' ? 'Denied' : 'Inactive'}
                  status={gpsActive ? 'good' : gpsPermission === 'denied' ? 'danger' : 'neutral'}
                />
                <StatusTile
                  icon={online ? Wifi : WifiOff}
                  label="Internet"
                  value={online ? 'Online' : 'Offline'}
                  status={online ? 'good' : 'danger'}
                />
                <StatusTile
                  icon={batteryCharging ? BatteryCharging : Battery}
                  label="Battery"
                  value={batteryPercent !== null ? `${batteryPercent}%${batteryCharging ? ' charging' : ''}` : 'N/A'}
                  status={batteryPercent === null ? 'neutral' : batteryPercent <= 15 && !batteryCharging ? 'danger' : batteryPercent <= 30 && !batteryCharging ? 'warning' : 'good'}
                />
                <StatusTile
                  icon={MapPin}
                  label="Location"
                  value={gpsPermission === 'granted' ? 'Granted' : gpsPermission === 'denied' ? 'Denied' : gpsPermission === 'prompt' ? 'Prompt' : 'Unknown'}
                  status={gpsPermission === 'granted' ? 'good' : gpsPermission === 'denied' ? 'danger' : 'neutral'}
                />
                <StatusTile
                  icon={WalletIcon}
                  label="Wallet"
                  value={walletComplete ? 'Complete' : 'Incomplete'}
                  status={walletComplete ? 'good' : 'warning'}
                />
                <StatusTile
                  icon={Users}
                  label="Contacts"
                  value={contactsCount === 0 ? 'None' : `${contactsCount} set`}
                  status={contactsCount === 0 ? 'warning' : 'good'}
                />
                <StatusTile
                  icon={UserCircle}
                  label="Profile"
                  value={profileComplete ? 'Complete' : 'Incomplete'}
                  status={profileComplete ? 'good' : 'warning'}
                />
                <StatusTile
                  icon={Bell}
                  label="Notifications"
                  value={unreadNotifications === 0 ? 'All read' : `${unreadNotifications} unread`}
                  status={unreadNotifications > 0 ? 'warning' : 'good'}
                />
              </div>

              {/* Premium Features — placeholders only, Coming Soon */}
              <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.04] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">Premium Features</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {PREMIUM_FEATURES.map((f) => (
                    <div key={f.label} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2 opacity-70">
                      <f.icon className="h-4 w-4 shrink-0 text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-foreground">{f.label}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{f.description}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">Soon</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const PREMIUM_FEATURES: { label: string; description: string; icon: LucideIcon }[] = [
  { label: 'Voice Mode', description: 'Talk to Guardian hands-free', icon: Mic },
  { label: 'Wake Phrase', description: 'Activate Guardian with your voice', icon: Radio },
  { label: 'Hands-free Guardian', description: 'Full control without touching your phone', icon: Sparkles },
  { label: 'Offline Guardian', description: 'Protection even without internet', icon: CloudOff },
  { label: 'Wearable Integration', description: 'Guardian on your wrist', icon: Watch },
  { label: 'Bluetooth Panic Device', description: 'Trigger SOS from a paired button', icon: Bluetooth },
];
