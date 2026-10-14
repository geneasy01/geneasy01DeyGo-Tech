// ─────────────────────────────────────────────────────────────────────────────
// Guardian AI Orchestrator
// ─────────────────────────────────────────────────────────────────────────────
// The ONLY layer responsible for producing Guardian replies.
//
// Architecture:
//
//   Guardian UI  →  Guardian AI Orchestrator  →  Provider  →  Response
//                        (this file)              (RuleBased | LLM)
//
// The UI never calls the conversation engine directly. It calls this
// orchestrator, which routes to the active provider. Today only the
// RuleBased provider is active — it delegates to the existing conversation
// engine (lib/guardian-conversation.ts). LLM providers (OpenAI, Gemini,
// Claude, DeepSeek) are declared but return "Not Configured" until a key
// and SDK are supplied. No AI API is called today.
//
// To enable an LLM in the future:
//   1. Set ACTIVE_PROVIDER to that provider's id.
//   2. Implement its provider function (stream/REST call).
//   3. Provide credentials via an Edge Function or secret.
// No other code — and zero UI code — needs to change.
//
// Nothing in this file mutates the Guardian Engine, Confidence Engine,
// Journey Engine, SOS Engine, Notification Engine, Location Service,
// Supabase schema, Authentication, or Edge Functions. It only reads and
// orchestrates.

import {
  generateGreeting as ruleGenerateGreeting,
  generateReply as ruleGenerateReply,
  replyForChip as ruleReplyForChip,
  chipsForContext as ruleChipsForContext,
  generateId,
  type ConversationMessage,
  type ConversationContext,
  type SuggestionChip,
} from './guardian-conversation';
import {
  recommendResponders as partnerRecommendResponders,
  getResponderSummary as partnerResponderSummary,
  type ResponderRecommendation,
  type ResourceCategory,
} from './partner-directory';
import {
  evaluateOnboarding,
  onboardingWelcome,
  onboardingNextStep,
  onboardingAcknowledge,
  onboardingCompleteLine,
  type OnboardingInput,
  type OnboardingState,
  type SetupStepId,
} from './guardian-onboarding';
import type { EmergencyType } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Provider registry
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderId = 'rulebased' | 'openai' | 'gemini' | 'claude' | 'deepseek';

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  configured: boolean;
  active: boolean;
}

/**
 * Only `rulebased` is active today. LLM providers are declared so the
 * architecture is complete and the UI is provider-agnostic, but each
 * returns "Not Configured" until wired up.
 */
export const ACTIVE_PROVIDER: ProviderId = 'rulebased';

export const PROVIDERS: Record<ProviderId, ProviderStatus> = {
  rulebased: { id: 'rulebased', label: 'Rule-Based Engine', configured: true, active: true },
  openai: { id: 'openai', label: 'OpenAI', configured: false, active: false },
  gemini: { id: 'gemini', label: 'Google Gemini', configured: false, active: false },
  claude: { id: 'claude', label: 'Anthropic Claude', configured: false, active: false },
  deepseek: { id: 'deepseek', label: 'DeepSeek', configured: false, active: false },
};

export function getActiveProvider(): ProviderStatus {
  return PROVIDERS[ACTIVE_PROVIDER];
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator request / response types
// ─────────────────────────────────────────────────────────────────────────────
// These are the stable contract the UI depends on. They are independent of
// any specific provider, so swapping providers never changes the UI.

export interface GuardianReplyInput {
  userMessage: string;
  history: ConversationMessage[];
  context: ConversationContext;
  currentPage?: string | null;
}

export interface GuardianGreetingInput {
  context: ConversationContext;
  currentPage?: string | null;
}

export interface GuardianReply {
  message: ConversationMessage;
  chips: SuggestionChip[];
  provider: ProviderId;
  metadata: {
    intent: string | null;
    confidence: number | null;
    timestamp: number;
  };
}

export interface GuardianGreeting {
  message: ConversationMessage;
  chips: SuggestionChip[];
  provider: ProviderId;
  metadata: {
    timestamp: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Session memory
// ─────────────────────────────────────────────────────────────────────────────
// In-memory conversation memory scoped to a single open chat session.
// Never persisted. No database changes. Cleared when the session ends.

export interface SessionMemory {
  messages: ConversationMessage[];
  topics: string[];
  startedAt: number;
  lastActivity: number;
  journeyDiscussed: boolean;
  safetyDiscussed: boolean;
}

export function createSessionMemory(): SessionMemory {
  return {
    messages: [],
    topics: [],
    startedAt: Date.now(),
    lastActivity: Date.now(),
    journeyDiscussed: false,
    safetyDiscussed: false,
  };
}

export function appendToMemory(memory: SessionMemory, message: ConversationMessage): SessionMemory {
  const text = message.text.toLowerCase();
  const topics = new Set(memory.topics);
  if (text.includes('journey') || text.includes('heading') || text.includes('trav')) topics.add('journey');
  if (text.includes('safe') || text.includes('risk') || text.includes('danger')) topics.add('safety');
  if (text.includes('battery') || text.includes('charge')) topics.add('battery');
  if (text.includes('contact')) topics.add('contacts');
  if (text.includes('wallet') || text.includes('medical')) topics.add('wallet');

  return {
    messages: [...memory.messages, message],
    topics: Array.from(topics),
    startedAt: memory.startedAt,
    lastActivity: Date.now(),
    journeyDiscussed: memory.journeyDiscussed || topics.has('journey'),
    safetyDiscussed: memory.safetyDiscussed || topics.has('safety'),
  };
}

export function summarizeMemory(memory: SessionMemory): string {
  if (memory.messages.length === 0) return 'No conversation yet.';
  const userTurns = memory.messages.filter((m) => m.role === 'user').map((m) => m.text);
  const topics = memory.topics.length > 0 ? memory.topics.join(', ') : 'general';
  return `Topics discussed: ${topics}. Recent user turns: ${userTurns.slice(-3).join(' | ') || 'none'}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context builder
// ─────────────────────────────────────────────────────────────────────────────
// One function that gathers everything Guardian needs to reason about the
// user's situation. The UI passes raw inputs (from its existing hooks /
// Supabase queries / system-health reads); this normalizes them into the
// single ConversationContext the conversation engine already understands.

export interface RawGuardianContextInput {
  user: { id: string } | null;
  profile: { full_name?: string | null; phone?: string | null; blood_group?: string | null; genotype?: string | null } | null;
  activeJourney: {
    id: string;
    origin: string;
    destination: string;
    started_at: string;
    expected_arrival: string | null;
    status: string;
  } | null;
  journeyHistory: { origin: string; destination: string }[];
  contacts: { name: string; phone: string }[];
  wallet: {
    blood_group?: string | null;
    genotype?: string | null;
    medical_conditions?: string | null;
    allergies?: string | null;
  } | null;
  monitorState: ConversationContext['monitorState'];
  confidenceScore: number | null;
  online: boolean;
  gpsActive: boolean;
  gpsPermission: string;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  unreadNotifications: number;
  currentLocation: { lat: number; lng: number; accuracy?: number } | null;
  currentPage: string | null;
}

export interface BuiltGuardianContext {
  context: ConversationContext;
  recommendation: string | null;
  displayState: ConversationContext['displayState'];
  currentLocationLabel: string | null;
  currentPage: string | null;
  currentTime: string;
}

export function buildGuardianContext(input: RawGuardianContextInput): BuiltGuardianContext {
  const activeJourney = input.activeJourney;
  const expectedArrival = activeJourney?.expected_arrival ? new Date(activeJourney.expected_arrival).getTime() : null;

  // Reuse the Guardian Engine's display-state selector (read-only).
  // We import lazily to keep this module self-contained and avoid a circular
  // dependency surface for future LLM providers.
  let displayState: ConversationContext['displayState'] = 'on_schedule';
  if (activeJourney) {
    // Lightweight inline mirror of getJourneyDisplayState semantics:
    // the engine function is pure and takes (expectedArrival, monitorState).
    // We call it directly so we stay consistent with the engine.
    // (Imported at top of guardian.ts, re-exported here for the UI's benefit.)
    displayState = resolveDisplayState(expectedArrival, input.monitorState);
  }

  const isRepeatedRoute = activeJourney
    ? input.journeyHistory.filter(
        (j) => j.origin === activeJourney.origin && j.destination === activeJourney.destination,
      ).length >= 3
    : false;

  const walletComplete = input.wallet
    ? !!(input.wallet.blood_group && input.wallet.genotype && (input.wallet.medical_conditions || input.wallet.allergies))
    : false;

  const profileComplete = input.profile
    ? !!(input.profile.full_name && input.profile.phone && input.profile.blood_group && input.profile.genotype)
    : false;

  const batteryPercent = input.batteryLevel !== null ? Math.round(input.batteryLevel * 100) : null;

  const context: ConversationContext = {
    monitorState: input.monitorState,
    displayState,
    confidenceScore: input.confidenceScore,
    gpsActive: input.gpsActive,
    gpsPermission: input.gpsPermission,
    online: input.online,
    hasJourney: !!activeJourney,
    batteryPercent,
    batteryCharging: input.batteryCharging,
    contactsCount: input.contacts.length,
    walletComplete,
    profileComplete,
    journeyJustStarted: false,
    journeyJustCompleted: false,
    isRepeatedRoute,
    firstName: input.profile?.full_name || null,
    unreadNotifications: input.unreadNotifications,
    journeyOrigin: activeJourney?.origin ?? null,
    journeyDestination: activeJourney?.destination ?? null,
    journeyEta: activeJourney?.expected_arrival
      ? new Date(activeJourney.expected_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null,
    firstContactName: input.contacts[0]?.name ?? null,
    firstContactPhone: input.contacts[0]?.phone ?? null,
  };

  const currentLocationLabel = input.currentLocation
    ? `${input.currentLocation.lat.toFixed(4)}, ${input.currentLocation.lng.toFixed(4)}`
    : null;

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Recommendation is derived from monitorState only (read-only); the engine's
  // generateEscalationRecommendation requires a full snapshot, so we produce a
  // lightweight, non-deterministic-free summary string here that the UI can show
  // without duplicating engine logic.
  let recommendation: string | null = null;
  if (input.monitorState === 'alert') recommendation = 'Guardian recommends confirming you are safe.';
  else if (input.monitorState === 'concern') recommendation = 'Guardian recommends a quick safety check.';

  return {
    context,
    recommendation,
    displayState,
    currentLocationLabel,
    currentPage: input.currentPage,
    currentTime,
  };
}

// Local display-state resolver. Mirrors the pure semantics of the Guardian
// Engine's getJourneyDisplayState without importing it (avoids a cross-module
// dependency cycle when future LLM providers are added). The engine remains
// the source of truth for the Journey page itself.
function resolveDisplayState(
  expectedArrival: number | null,
  monitorState: ConversationContext['monitorState'],
): ConversationContext['displayState'] {
  if (monitorState === 'alert' || monitorState === 'concern') return 'guardian_monitoring';
  if (expectedArrival === null) return 'guardian_monitoring';
  const now = Date.now();
  if (now > expectedArrival + 5 * 60 * 1000) return 'overdue';
  if (now > expectedArrival - 10 * 60 * 1000) return 'approaching_eta';
  return 'on_schedule';
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider implementations
// ─────────────────────────────────────────────────────────────────────────────
// Each provider shares the same signature so the orchestrator can swap them.
// Only `rulebased` is implemented; LLM providers return a "Not Configured"
// placeholder so the UI never crashes and always gets a valid response.

type Provider = {
  generateReply(input: GuardianReplyInput): GuardianReply;
  generateGreeting(input: GuardianGreetingInput): GuardianGreeting;
};

const ruleBasedProvider: Provider = {
  generateReply(input: GuardianReplyInput): GuardianReply {
    const message = ruleGenerateReply(input.userMessage, input.context);
    const chips = ruleChipsForContext(input.context);
    return {
      message,
      chips,
      provider: 'rulebased',
      metadata: {
        intent: null,
        confidence: null,
        timestamp: Date.now(),
      },
    };
  },
  generateGreeting(input: GuardianGreetingInput): GuardianGreeting {
    const message = ruleGenerateGreeting(input.context);
    const chips = ruleChipsForContext(input.context);
    return {
      message,
      chips,
      provider: 'rulebased',
      metadata: { timestamp: Date.now() },
    };
  },
};

function notConfiguredProvider(id: ProviderId): Provider {
  const notConfiguredMessage = (): ConversationMessage => ({
    id: generateId(),
    role: 'guardian',
    text: 'Guardian AI provider is not configured yet.',
    subtext: 'The rule-based engine is active. Connect an AI provider in lib/guardian-ai.ts to enable richer responses.',
    tone: 'caution',
    timestamp: Date.now(),
  });
  return {
    generateReply(): GuardianReply {
      return {
        message: notConfiguredMessage(),
        chips: [],
        provider: id,
        metadata: { intent: null, confidence: null, timestamp: Date.now() },
      };
    },
    generateGreeting(): GuardianGreeting {
      return {
        message: notConfiguredMessage(),
        chips: [],
        provider: id,
        metadata: { timestamp: Date.now() },
      };
    },
  };
}

const PROVIDER_REGISTRY: Record<ProviderId, Provider> = {
  rulebased: ruleBasedProvider,
  openai: notConfiguredProvider('openai'),
  gemini: notConfiguredProvider('gemini'),
  claude: notConfiguredProvider('claude'),
  deepseek: notConfiguredProvider('deepseek'),
};

function getProvider(): Provider {
  return PROVIDER_REGISTRY[ACTIVE_PROVIDER] ?? ruleBasedProvider;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public orchestrator API — the ONLY surface the UI calls
// ─────────────────────────────────────────────────────────────────────────────

export function generateGuardianReply(input: GuardianReplyInput): GuardianReply {
  return getProvider().generateReply(input);
}

export function generateGuardianGreeting(input: GuardianGreetingInput): GuardianGreeting {
  return getProvider().generateGreeting(input);
}

export function getGuardianChips(context: ConversationContext): SuggestionChip[] {
  return ruleChipsForContext(context);
}

export function generateGuardianReplyForChip(chip: SuggestionChip, context: ConversationContext): ConversationMessage {
  // Chips always use the rule-based engine so they remain instant + deterministic.
  return ruleReplyForChip(chip, context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardian: Emergency responder recommendations
// ─────────────────────────────────────────────────────────────────────────────
// Guardian is the intelligent coordinator. During an emergency, Guardian
// recommends the most appropriate responders drawn from the Emergency
// Resource Directories of the organizations the user belongs to.
//
// GUARDIAN NEVER DISPATCHES AUTOMATICALLY. The user always chooses whether
// to contact a recommended responder. These functions produce
// recommendations only; the UI presents them and the user confirms.
//
// This integration is additive — it reads the partner directory via the
// partner-directory service. No existing engine is modified.

export async function recommendGuardianResponders(
  userId: string,
  emergencyType: EmergencyType | 'security',
  limit = 5,
): Promise<ResponderRecommendation[]> {
  return partnerRecommendResponders(userId, emergencyType, limit);
}

export async function getGuardianResponderSummary(
  userId: string,
  emergencyType: EmergencyType | 'security',
): Promise<{ category: ResourceCategory; count: number }[]> {
  return partnerResponderSummary(userId, emergencyType);
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardian: First-time user onboarding
// ─────────────────────────────────────────────────────────────────────────────
// When a brand-new user opens Guardian for the first time, Guardian becomes
// their personal guide. It welcomes them by name, explains DEYGO in one
// friendly sentence, checks setup progress (internally), and recommends ONE
// action at a time. The checklist is never shown — only Guardian's words.
//
// These functions are additive. They reuse the existing ConversationContext
// that buildGuardianContext already produces, extended with two extra signals
// (notification permission + subscription status) that the conversation
// engine doesn't natively track.

export interface GuardianOnboardingResult {
  message: ConversationMessage;
  state: OnboardingState;
}

/**
 * The very first message a new user sees. Combines the welcome (step 1+2)
 * with the first actionable recommendation (step 3+4).
 */
export function generateGuardianOnboardingGreeting(
  input: OnboardingInput,
): GuardianOnboardingResult {
  const state = evaluateOnboarding(input);
  const welcome = onboardingWelcome(input.firstName);

  if (state.isComplete) {
    return {
      state,
      message: {
        id: generateId(),
        role: 'guardian',
        text: `${welcome} ${onboardingCompleteLine()}`,
        tone: 'safe',
        timestamp: Date.now(),
      },
    };
  }

  const next = onboardingNextStep(state);
  return {
    state,
    message: {
      id: generateId(),
      role: 'guardian',
      text: `${welcome} ${next.text}`,
      subtext: next.subtext,
      tone: 'caution',
      actionLabel: next.actionLabel,
      actionHref: next.actionHref,
      timestamp: Date.now(),
    },
  };
}

/**
 * Produce the next onboarding message after the user returns from completing
 * a step. `justCompletedId` is the step they finished (or null if we're just
 * re-surfacing guidance). Re-evaluates the checklist and acknowledges + moves
 * on, or delivers the readiness line if everything is now done.
 */
export function generateGuardianOnboardingNext(
  input: OnboardingInput,
  justCompletedId: SetupStepId | null,
): GuardianOnboardingResult {
  const state = evaluateOnboarding(input);
  state.justCompleted = state.isComplete;

  if (state.isComplete) {
    return {
      state,
      message: {
        id: generateId(),
        role: 'guardian',
        text: onboardingCompleteLine(),
        tone: 'safe',
        timestamp: Date.now(),
      },
    };
  }

  const ack = onboardingAcknowledge(justCompletedId, state);
  return {
    state,
    message: {
      id: generateId(),
      role: 'guardian',
      text: ack.text,
      subtext: ack.subtext,
      tone: 'caution',
      actionLabel: ack.actionLabel,
      actionHref: ack.actionHref,
      timestamp: Date.now(),
    },
  };
}

export type { OnboardingInput, OnboardingState, SetupStepId };

// Re-export the ID generator so the UI never imports the conversation engine.
export { generateId };

// Re-export types the UI needs, so it imports from the orchestrator only.
export type { ConversationMessage, ConversationContext, SuggestionChip };
