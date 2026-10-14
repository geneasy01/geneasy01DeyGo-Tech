import type {
  ConfidenceRuleId,
  ConfidenceRuleResult,
  ConfidenceScore,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Score Engine
// ─────────────────────────────────────────────────────────────────────────────
// A modular scoring engine that calculates a safety confidence score (0-100)
// based on a set of independent rules. Each rule evaluates a specific signal
// and contributes a weighted penalty when triggered. The engine only
// calculates — it never triggers actions (that's Guardian AI's job).
//
// Score interpretation:
//   80-100  → safe (green)
//   50-79   → caution (yellow)
//   25-49   → warning (orange)
//   0-24    → danger (red)
//
// Usage:
//   const score = calculateConfidenceScore({
//     rules: [
//       evaluateJourneyOverdue({ overdueMinutes: 15 }),
//       evaluateGpsUnavailable({ gpsAvailable: false }),
//     ],
//   });

export interface ConfidenceRuleInput {
  ruleId: ConfidenceRuleId;
  triggered: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
}

// Weight lookup by severity — how many points a triggered rule subtracts.
const SEVERITY_WEIGHTS: Record<ConfidenceRuleResult['severity'], number> = {
  low: 10,
  medium: 20,
  high: 35,
  critical: 50,
};

export function calculateConfidenceScore(
  inputs: ConfidenceRuleInput[]
): ConfidenceScore {
  const triggeredRules: ConfidenceRuleResult[] = [];
  let penalty = 0;

  for (const input of inputs) {
    if (!input.triggered) continue;
    const weight = SEVERITY_WEIGHTS[input.severity];
    const result: ConfidenceRuleResult = {
      ruleId: input.ruleId,
      triggered: true,
      severity: input.severity,
      weight,
      detail: input.detail,
    };
    triggeredRules.push(result);
    penalty += weight;
  }

  const score = Math.max(0, 100 - penalty);
  const level = scoreToLevel(score);

  return {
    score,
    level,
    triggeredRules,
    timestamp: Date.now(),
  };
}

function scoreToLevel(score: number): ConfidenceScore['level'] {
  if (score >= 80) return 'safe';
  if (score >= 50) return 'caution';
  if (score >= 25) return 'warning';
  return 'danger';
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Rule Evaluators
// ─────────────────────────────────────────────────────────────────────────────
// Each evaluator returns a ConfidenceRuleInput. Callers pass the results
// into calculateConfidenceScore(). This keeps rules composable and testable.

export function evaluateJourneyOverdue(params: {
  overdueMinutes: number;
}): ConfidenceRuleInput {
  const mins = params.overdueMinutes;
  if (mins <= 0) {
    return { ruleId: 'journey_overdue', triggered: false, severity: 'low', detail: '' };
  }
  let severity: ConfidenceRuleResult['severity'];
  if (mins >= 30) severity = 'critical';
  else if (mins >= 15) severity = 'high';
  else if (mins >= 5) severity = 'medium';
  else severity = 'low';
  return {
    ruleId: 'journey_overdue',
    triggered: true,
    severity,
    detail: `Journey is ${mins} minute(s) past expected arrival.`,
  };
}

export function evaluateGpsUnavailable(params: {
  gpsAvailable: boolean;
}): ConfidenceRuleInput {
  if (params.gpsAvailable) {
    return { ruleId: 'gps_unavailable', triggered: false, severity: 'low', detail: '' };
  }
  return {
    ruleId: 'gps_unavailable',
    triggered: true,
    severity: 'high',
    detail: 'GPS is unavailable. Last known location may be stale.',
  };
}

export function evaluateNoMovement(params: {
  minutesSinceMovement: number;
  thresholdMinutes?: number;
}): ConfidenceRuleInput {
  const threshold = params.thresholdMinutes ?? 10;
  if (params.minutesSinceMovement < threshold) {
    return { ruleId: 'no_movement', triggered: false, severity: 'low', detail: '' };
  }
  let severity: ConfidenceRuleResult['severity'];
  if (params.minutesSinceMovement >= 30) severity = 'critical';
  else if (params.minutesSinceMovement >= 20) severity = 'high';
  else severity = 'medium';
  return {
    ruleId: 'no_movement',
    triggered: true,
    severity,
    detail: `No movement detected for ${Math.round(params.minutesSinceMovement)} minute(s).`,
  };
}

export function evaluateSafetyCheckIgnored(params: {
  ignoredCount: number;
}): ConfidenceRuleInput {
  if (params.ignoredCount === 0) {
    return { ruleId: 'safety_check_ignored', triggered: false, severity: 'low', detail: '' };
  }
  let severity: ConfidenceRuleResult['severity'];
  if (params.ignoredCount >= 3) severity = 'critical';
  else if (params.ignoredCount === 2) severity = 'high';
  else severity = 'medium';
  return {
    ruleId: 'safety_check_ignored',
    triggered: true,
    severity,
    detail: `${params.ignoredCount} safety check(s) ignored by user.`,
  };
}

export function evaluateDeviceOffline(params: {
  online: boolean;
}): ConfidenceRuleInput {
  if (params.online) {
    return { ruleId: 'device_offline', triggered: false, severity: 'low', detail: '' };
  }
  return {
    ruleId: 'device_offline',
    triggered: true,
    severity: 'critical',
    detail: 'Device is offline. Cannot receive or send updates.',
  };
}

export function evaluateDuressPinActivated(params: {
  duressActive: boolean;
}): ConfidenceRuleInput {
  if (!params.duressActive) {
    return { ruleId: 'duress_pin_activated', triggered: false, severity: 'low', detail: '' };
  }
  return {
    ruleId: 'duress_pin_activated',
    triggered: true,
    severity: 'critical',
    detail: 'Duress PIN has been activated. User may be under coercion.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: evaluate all rules from a single input object
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfidenceEvaluationInput {
  overdueMinutes?: number;
  gpsAvailable?: boolean;
  minutesSinceMovement?: number | null;
  safetyChecksIgnored?: number;
  online?: boolean;
  duressActive?: boolean;
}

export function evaluateAllRules(input: ConfidenceEvaluationInput): ConfidenceScore {
  const rules: ConfidenceRuleInput[] = [
    evaluateJourneyOverdue({ overdueMinutes: input.overdueMinutes ?? 0 }),
    evaluateGpsUnavailable({ gpsAvailable: input.gpsAvailable ?? true }),
    evaluateNoMovement({
      minutesSinceMovement: input.minutesSinceMovement ?? 0,
    }),
    evaluateSafetyCheckIgnored({ ignoredCount: input.safetyChecksIgnored ?? 0 }),
    evaluateDeviceOffline({ online: input.online ?? true }),
    evaluateDuressPinActivated({ duressActive: input.duressActive ?? false }),
  ];
  return calculateConfidenceScore(rules);
}
