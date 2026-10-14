export type SubscriptionPlan = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled';
export type JourneyStatus = 'active' | 'completed' | 'cancelled';
export type SOSStatus = 'active' | 'resolved';
export type ContactCategory =
  | 'family'
  | 'friend'
  | 'doctor'
  | 'lawyer'
  | 'neighbour';
export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  blood_group: string | null;
  genotype: string | null;
  duress_pin: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string | null;
  category: ContactCategory;
  created_at: string;
}

export interface Journey {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  expected_arrival: string | null;
  status: JourneyStatus;
  started_at: string;
  completed_at: string | null;
  contact_ids: string[];
}

export interface SOSAlert {
  id: string;
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  status: SOSStatus;
  triggered_at: string;
  resolved_at: string | null;
  notes: string | null;
  is_duress: boolean;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  blood_group: string | null;
  genotype: string | null;
  medical_conditions: string | null;
  allergies: string | null;
  current_medication: string | null;
  insurance: string | null;
  emergency_notes: string | null;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
}

export interface Report {
  id: string;
  user_id: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Admin {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, unknown>;
  created_at: string;
}

export type IncidentStatus =
  | 'pending'
  | 'accepted'
  | 'responder_en_route'
  | 'arrived'
  | 'resolved'
  | 'closed';

export type EmergencyType = 'sos' | 'duress' | 'medical' | 'accident' | 'fire' | 'other';

export interface EmergencyIncident {
  id: string;
  user_id: string;
  emergency_type: EmergencyType;
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
}

export interface IncidentStatusHistory {
  id: string;
  incident_id: string;
  user_id: string | null;
  from_status: IncidentStatus | null;
  to_status: IncidentStatus;
  changed_by: string;
  notes: string | null;
  created_at: string;
}

export type NotificationType = 'sos' | 'journey' | 'security' | 'system';

export interface NotificationSettings {
  id: string;
  user_id: string;
  sos_alerts: boolean;
  journey_alerts: boolean;
  emergency_contact_notifications: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  marketing_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface AuthSession {
  user: Profile | null;
  session: import('@supabase/supabase-js').Session | null;
  loading: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Location Service Types
// ─────────────────────────────────────────────────────────────────────────────

export type LocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface LocationReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
  heading: number | null;
}

export type LocationErrorCode = 'permission_denied' | 'position_unavailable' | 'timeout' | 'unsupported';

export interface LocationError {
  code: LocationErrorCode;
  message: string;
}

export type LocationTrackingState = 'idle' | 'tracking' | 'error' | 'stopped';

// ─────────────────────────────────────────────────────────────────────────────
// System Health Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemHealthSnapshot {
  gpsAvailable: boolean;
  gpsPermission: LocationPermissionState;
  online: boolean;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  backgroundTrackingCapable: boolean;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Score Engine Types
// ─────────────────────────────────────────────────────────────────────────────

export type ConfidenceRuleId =
  | 'journey_overdue'
  | 'gps_unavailable'
  | 'no_movement'
  | 'safety_check_ignored'
  | 'device_offline'
  | 'duress_pin_activated';

export interface ConfidenceRuleResult {
  ruleId: ConfidenceRuleId;
  triggered: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number;
  detail: string;
}

export interface ConfidenceScore {
  score: number;
  level: 'safe' | 'caution' | 'warning' | 'danger';
  triggeredRules: ConfidenceRuleResult[];
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardian AI Types
// ─────────────────────────────────────────────────────────────────────────────

export type SafetyCheckStatus =
  | 'pending'
  | 'acknowledged'
  | 'ignored'
  | 'expired'
  | 'need_time'
  | 'help';

export interface SafetyCheck {
  id: string;
  journeyId: string;
  userId: string;
  message: string;
  status: SafetyCheckStatus;
  createdAt: number;
  expiresAt: number;
  respondedAt: number | null;
}

export type JourneyMonitorState = 'normal' | 'watch' | 'concern' | 'alert';

export interface JourneyMonitorSnapshot {
  journeyId: string;
  userId: string;
  state: JourneyMonitorState;
  confidence: ConfidenceScore;
  lastLocation: LocationReading | null;
  lastMovementAt: number | null;
  overdue: boolean;
  safetyCheckPending: boolean;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escalation Engine Types
// ─────────────────────────────────────────────────────────────────────────────

export type EscalationLevel = 'normal' | 'watch' | 'concern' | 'high_risk' | 'critical';

export interface EscalationRecommendation {
  level: EscalationLevel;
  score: number;
  shouldEscalate: boolean;
  shouldSendSafetyCheck: boolean;
  shouldNotifyContacts: boolean;
  shouldDispatchProviders: boolean;
  reason: string;
  triggeredRules: ConfidenceRuleResult[];
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Emergency Provider Types
// ─────────────────────────────────────────────────────────────────────────────

export type EmergencyProviderType =
  | 'police'
  | 'fire_service'
  | 'frsc'
  | 'ambulance'
  | 'hospital'
  | 'estate_security'
  | 'private_security'
  | 'roadside_assistance';

export interface EmergencyProviderInfo {
  type: EmergencyProviderType;
  name: string;
  phone: string | null;
  jurisdiction: string | null;
  averageResponseMinutes: number | null;
  available247: boolean;
}

export interface ProviderDispatchRequest {
  incidentId: string;
  userId: string;
  latitude: number | null;
  longitude: number | null;
  emergencyType: EmergencyType;
  notes: string | null;
}

export interface ProviderDispatchResult {
  providerType: EmergencyProviderType;
  accepted: boolean;
  estimatedArrivalMinutes: number | null;
  referenceId: string | null;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Device Token Types (FCM Push Notifications)
// ─────────────────────────────────────────────────────────────────────────────

export type DevicePlatform = 'web' | 'android' | 'ios';

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: DevicePlatform;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
