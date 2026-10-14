import { LocationService } from './location-service';
import { evaluateAllRules } from './confidence-score';
import { isOnline, isGpsAvailable } from './system-health';
import type {
  SafetyCheck,
  SafetyCheckStatus,
  JourneyMonitorSnapshot,
  JourneyMonitorState,
  ConfidenceScore,
  LocationReading,
  EscalationRecommendation,
  EscalationLevel,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Guardian AI Foundation
// ─────────────────────────────────────────────────────────────────────────────
// Reusable backend logic that monitors active journeys and calculates safety
// confidence scores. This module does NOT:
//   - Dispatch emergencies automatically
//   - Generate AI responses
//   - Render any UI
//
// It provides the functions that future modules (Journey Guard, Live Dispatch,
// the escalation engine) will call to assess the current safety state.
//
// Architecture:
//   1. assessJourney() — takes journey + location data, returns a snapshot
//      with a confidence score and monitor state (normal/watch/concern/alert)
//   2. createSafetyCheck() / resolveSafetyCheck() — manages safety check
//      lifecycle (sent to user, user acknowledges or ignores)
//   3. shouldEscalate() — pure function that decides whether the current
//      monitor state warrants escalation (the actual escalation is NOT
//      performed here — that's the future escalation engine's job)

// ─────────────────────────────────────────────────────────────────────────────
// Journey Assessment
// ─────────────────────────────────────────────────────────────────────────────

export interface JourneyAssessmentInput {
  journeyId: string;
  userId: string;
  startedAt: number;
  expectedArrival: number | null;
  locationService: LocationService;
  safetyChecksIgnored?: number;
  duressActive?: boolean;
}

export function assessJourney(input: JourneyAssessmentInput): JourneyMonitorSnapshot {
  const now = Date.now();

  // Calculate overdue minutes
  let overdueMinutes = 0;
  if (input.expectedArrival && now > input.expectedArrival) {
    overdueMinutes = (now - input.expectedArrival) / 60000;
  }

  // Calculate minutes since last movement
  const msSinceMovement = input.locationService.timeSinceLastMovement(10);
  const minutesSinceMovement = msSinceMovement !== null ? msSinceMovement / 60000 : 0;

  // Evaluate all confidence rules
  const confidence = evaluateAllRules({
    overdueMinutes,
    gpsAvailable: isGpsAvailable(),
    minutesSinceMovement,
    safetyChecksIgnored: input.safetyChecksIgnored ?? 0,
    online: isOnline(),
    duressActive: input.duressActive ?? false,
  });

  // Determine monitor state from confidence level
  const state = confidenceLevelToMonitorState(confidence.level);

  return {
    journeyId: input.journeyId,
    userId: input.userId,
    state,
    confidence,
    lastLocation: input.locationService.getLastReading(),
    lastMovementAt: msSinceMovement !== null ? now - msSinceMovement : null,
    overdue: overdueMinutes > 0,
    safetyCheckPending: false,
    timestamp: now,
  };
}

function confidenceLevelToMonitorState(
  level: ConfidenceScore['level']
): JourneyMonitorState {
  switch (level) {
    case 'safe':
      return 'normal';
    case 'caution':
      return 'watch';
    case 'warning':
      return 'concern';
    case 'danger':
      return 'alert';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety Check Lifecycle
// ─────────────────────────────────────────────────────────────────────────────
// Safety checks are periodic prompts sent to the user during a journey
// ("Are you safe?"). The user acknowledges or ignores them. Ignored checks
// feed into the confidence score engine.

export function createSafetyCheck(params: {
  journeyId: string;
  userId: string;
  message?: string;
  timeoutMinutes?: number;
}): SafetyCheck {
  const now = Date.now();
  const timeoutMs = (params.timeoutMinutes ?? 5) * 60000;
  return {
    id: crypto.randomUUID(),
    journeyId: params.journeyId,
    userId: params.userId,
    message: params.message ?? 'Are you safe? Tap to confirm.',
    status: 'pending',
    createdAt: now,
    expiresAt: now + timeoutMs,
    respondedAt: null,
  };
}

export function resolveSafetyCheck(
  check: SafetyCheck,
  status: 'acknowledged' | 'ignored' | 'need_time' | 'help'
): SafetyCheck {
  if (check.status !== 'pending') return check;
  return {
    ...check,
    status,
    respondedAt: Date.now(),
  };
}

export function expireSafetyCheck(check: SafetyCheck): SafetyCheck {
  if (check.status !== 'pending') return check;
  if (Date.now() < check.expiresAt) return check;
  return {
    ...check,
    status: 'expired',
    respondedAt: Date.now(),
  };
}

export function isSafetyCheckExpired(check: SafetyCheck): boolean {
  return check.status === 'pending' && Date.now() >= check.expiresAt;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escalation Engine
// ─────────────────────────────────────────────────────────────────────────────
// Receives Guardian decisions and confidence scores, evaluates them, and
// returns a structured escalation recommendation. The engine does NOT:
//   - Contact providers
//   - Dispatch responders
//   - Send notifications
//
// It only returns what SHOULD be done. The caller decides whether to act.
//
// Escalation levels:
//   normal     → Score 80-100, no action needed
//   watch      → Score 50-79, monitor closely
//   concern    → Score 25-49, send a safety check
//   high_risk  → Score 10-24, notify contacts + prepare dispatch
//   critical   → Score 0-9, dispatch recommended (but NOT performed)

export function generateEscalationRecommendation(
  snapshot: JourneyMonitorSnapshot
): EscalationRecommendation {
  const { score, level, triggeredRules } = snapshot.confidence;

  let escalationLevel: EscalationLevel;
  let shouldEscalate = false;
  let shouldSendSafetyCheck = false;
  let shouldNotifyContacts = false;
  let shouldDispatchProviders = false;
  let reason: string;

  switch (level) {
    case 'safe':
      escalationLevel = 'normal';
      shouldEscalate = false;
      reason = 'All safety signals normal.';
      break;

    case 'caution':
      escalationLevel = 'watch';
      shouldEscalate = true;
      reason = 'Confidence dropped. Monitoring closely.';
      break;

    case 'warning':
      escalationLevel = 'concern';
      shouldEscalate = true;
      shouldSendSafetyCheck = !snapshot.safetyCheckPending;
      reason = 'Confidence in warning range. Safety check recommended.';
      break;

    case 'danger':
      if (score <= 9) {
        escalationLevel = 'critical';
        shouldEscalate = true;
        shouldSendSafetyCheck = !snapshot.safetyCheckPending;
        shouldNotifyContacts = true;
        shouldDispatchProviders = true;
        reason = 'Confidence in critical range. Immediate action recommended.';
      } else {
        escalationLevel = 'high_risk';
        shouldEscalate = true;
        shouldSendSafetyCheck = !snapshot.safetyCheckPending;
        shouldNotifyContacts = true;
        reason = 'Confidence in high-risk range. Notify emergency contacts.';
      }
      break;
  }

  return {
    level: escalationLevel,
    score,
    shouldEscalate,
    shouldSendSafetyCheck,
    shouldNotifyContacts,
    shouldDispatchProviders,
    reason,
    triggeredRules,
    timestamp: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy escalation decision (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason: string | null;
  urgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export function shouldEscalate(snapshot: JourneyMonitorSnapshot): EscalationDecision {
  const rec = generateEscalationRecommendation(snapshot);
  const urgencyMap: Record<EscalationLevel, 'none' | 'low' | 'medium' | 'high' | 'critical'> = {
    normal: 'none',
    watch: 'low',
    concern: 'medium',
    high_risk: 'high',
    critical: 'critical',
  };
  return {
    shouldEscalate: rec.shouldEscalate,
    reason: rec.reason,
    urgency: urgencyMap[rec.level],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Movement Analysis Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function calculateJourneyProgress(params: {
  readings: LocationReading[];
  startLat: number | null;
  startLng: number | null;
  destLat: number | null;
  destLng: number | null;
}): { distanceTraveled: number; distanceRemaining: number; progressPercent: number } {
  const { readings, startLat, startLng, destLat, destLng } = params;

  // If we don't have destination coordinates, we can't calculate progress
  if (destLat === null || destLng === null) {
    return { distanceTraveled: 0, distanceRemaining: 0, progressPercent: 0 };
  }

  // Total route distance (start → destination)
  const totalDistance =
    startLat !== null && startLng !== null
      ? LocationService.distanceMeters(startLat, startLng, destLat, destLng)
      : 0;

  if (totalDistance === 0) {
    return { distanceTraveled: 0, distanceRemaining: 0, progressPercent: 0 };
  }

  // Distance from current position to destination
  const last = readings[readings.length - 1];
  if (!last) {
    return { distanceTraveled: 0, distanceRemaining: totalDistance, progressPercent: 0 };
  }

  const distanceRemaining = LocationService.distanceMeters(
    last.latitude,
    last.longitude,
    destLat,
    destLng
  );

  const distanceTraveled = Math.max(0, totalDistance - distanceRemaining);
  const progressPercent = Math.min(100, Math.round((distanceTraveled / totalDistance) * 100));

  return { distanceTraveled, distanceRemaining, progressPercent };
}

// ─────────────────────────────────────────────────────────────────────────────
// Journey Duration Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function calculateJourneyDuration(startedAt: number): {
  durationMs: number;
  durationMinutes: number;
  durationFormatted: string;
} {
  const durationMs = Date.now() - startedAt;
  const durationMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durationFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return { durationMs, durationMinutes, durationFormatted };
}

export function calculateRemainingTime(expectedArrival: number | null): {
  remainingMs: number;
  remainingMinutes: number;
  remainingFormatted: string;
  overdue: boolean;
} {
  if (!expectedArrival) {
    return { remainingMs: 0, remainingMinutes: 0, remainingFormatted: '—', overdue: false };
  }
  const remainingMs = expectedArrival - Date.now();
  const overdue = remainingMs < 0;
  const absMinutes = Math.abs(Math.round(remainingMs / 60000));
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  const remainingFormatted = overdue
    ? `${hours > 0 ? `${hours}h ` : ''}${mins}m overdue`
    : `${hours > 0 ? `${hours}h ` : ''}${mins}m left`;
  return { remainingMs, remainingMinutes: Math.round(remainingMs / 60000), remainingFormatted, overdue };
}

// ─────────────────────────────────────────────────────────────────────────────
// Journey State Helper
// ─────────────────────────────────────────────────────────────────────────────
// Returns the display state for a journey based on time relative to ETA
// and the Guardian monitor state.

export type JourneyDisplayState =
  | 'on_schedule'
  | 'approaching_eta'
  | 'overdue'
  | 'guardian_monitoring';

export function getJourneyDisplayState(params: {
  expectedArrival: number | null;
  monitorState: JourneyMonitorState | null;
}): JourneyDisplayState {
  const { expectedArrival, monitorState } = params;

  // If Guardian is actively monitoring (concern or alert), that takes precedence
  if (monitorState === 'concern' || monitorState === 'alert') {
    return 'guardian_monitoring';
  }

  if (!expectedArrival) {
    return 'on_schedule';
  }

  const remaining = calculateRemainingTime(expectedArrival);

  if (remaining.overdue) {
    return 'overdue';
  }

  // Approaching ETA = within 10 minutes of expected arrival
  if (remaining.remainingMinutes <= 10) {
    return 'approaching_eta';
  }

  return 'on_schedule';
}

export const JOURNEY_STATE_LABELS: Record<JourneyDisplayState, string> = {
  on_schedule: 'On Schedule',
  approaching_eta: 'Approaching ETA',
  overdue: 'Overdue',
  guardian_monitoring: 'Guardian Monitoring',
};
