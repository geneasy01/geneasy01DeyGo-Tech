// ─────────────────────────────────────────────────────────────────────────────
// Guardian First-Time Onboarding
// ─────────────────────────────────────────────────────────────────────────────
// Evaluates a brand-new user's setup progress and produces NATURAL
// conversational guidance — not a checklist UI.
//
// Guardian becomes the user's personal guide:
//   1. Welcome by first name.
//   2. One friendly sentence about DEYGO.
//   3. Speak naturally about what's missing.
//   4. Recommend ONE action at a time.
//   5. Celebrate, then move to the next step.
//   6. When everything is ready, deliver the readiness line.
//
// The checklist itself stays internal. Only Guardian's words are visible.
// No raw percentages, no confidence math, no GPS/battery state unless the
// user asks.
//
// This module is purely additive. It reads the same ConversationContext the
// orchestrator already builds. It does NOT modify any engine, schema, or
// existing service.

import type { ConversationContext } from './guardian-conversation';

// ─────────────────────────────────────────────────────────────────────────────
// Setup checklist — internal only
// ─────────────────────────────────────────────────────────────────────────────

export type SetupStepId =
  | 'profile'
  | 'contacts'
  | 'wallet'
  | 'notifications'
  | 'location'
  | 'subscription'
  | 'journey_guard';

export interface SetupStep {
  id: SetupStepId;
  complete: boolean;
  // Natural-language description of the gap (shown via Guardian, never raw).
  gapPhrase: string;
  // The single call-to-action Guardian recommends for this step.
  actionLabel: string;
  actionHref: string;
  // A friendly label for Guardian's internal ordering only.
  label: string;
}

export interface OnboardingState {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  // The single next step Guardian should recommend (or null if all done).
  nextStep: SetupStep | null;
  // True only when the user has finished every step this session.
  justCompleted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inputs — the orchestrator extends ConversationContext with two extra
// signals that the conversation engine doesn't natively track.
// ─────────────────────────────────────────────────────────────────────────────

export interface OnboardingInput extends ConversationContext {
  notificationPermission: 'granted' | 'denied' | 'default' | 'unknown';
  subscriptionActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluate the checklist
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateOnboarding(input: OnboardingInput): OnboardingState {
  const profileComplete = !!input.profileComplete;
  const contactsComplete = input.contactsCount > 0;
  const walletComplete = !!input.walletComplete;
  const notificationsComplete =
    input.notificationPermission === 'granted' ||
    input.notificationPermission === 'unknown';
  const locationComplete =
    input.gpsPermission === 'granted' || input.gpsPermission === 'unknown';
  const subscriptionComplete = input.subscriptionActive;
  const journeyGuardComplete = locationComplete && input.gpsActive !== false;

  const steps: SetupStep[] = [
    {
      id: 'profile',
      complete: profileComplete,
      gapPhrase: 'Your profile is still missing a few details.',
      actionLabel: 'Complete Profile',
      actionHref: '/dashboard/profile',
      label: 'profile',
    },
    {
      id: 'contacts',
      complete: contactsComplete,
      gapPhrase: "You haven't added any emergency contacts yet.",
      actionLabel: 'Add Emergency Contact',
      actionHref: '/dashboard/contacts',
      label: 'emergency contacts',
    },
    {
      id: 'wallet',
      complete: walletComplete,
      gapPhrase: 'Your Emergency Wallet is still empty.',
      actionLabel: 'Prepare Emergency Wallet',
      actionHref: '/dashboard/wallet',
      label: 'emergency wallet',
    },
    {
      id: 'notifications',
      complete: notificationsComplete,
      gapPhrase: 'Notifications are disabled.',
      actionLabel: 'Enable Notifications',
      actionHref: '/dashboard/settings',
      label: 'notifications',
    },
    {
      id: 'location',
      complete: locationComplete,
      gapPhrase: 'Location permission is not enabled.',
      actionLabel: 'Enable Location',
      actionHref: '/dashboard/settings',
      label: 'location permission',
    },
    {
      id: 'subscription',
      complete: subscriptionComplete,
      gapPhrase: 'You are on the Free plan.',
      actionLabel: 'See Premium',
      actionHref: '/dashboard/subscription',
      label: 'subscription',
    },
    {
      id: 'journey_guard',
      complete: journeyGuardComplete,
      gapPhrase: 'Journey Guard is ready once location is on.',
      actionLabel: 'Try Journey Guard',
      actionHref: '/dashboard/journey',
      label: 'Journey Guard',
    },
  ];

  const completedCount = steps.filter((s) => s.complete).length;
  const incomplete = steps.filter((s) => !s.complete);
  const isComplete = incomplete.length === 0;
  const nextStep = isComplete ? null : incomplete[0] ?? null;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    isComplete,
    nextStep,
    justCompleted: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversational guidance — natural, one step at a time
// ─────────────────────────────────────────────────────────────────────────────

function pickRotating(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Step 1 + 2: the welcome a brand-new user sees on their very first Guardian
 * open. Greets by name and explains DEYGO in one friendly sentence.
 */
export function onboardingWelcome(firstName: string | null): string {
  const name = firstName?.split(' ')[0] || 'there';
  return `Hi ${name}. I'm Guardian — I'm here to help you stay prepared before emergencies happen.`;
}

/**
 * Step 3 + 4: the first actionable onboarding message. Speaks naturally
 * about the single most important gap and recommends exactly one action.
 */
export function onboardingNextStep(state: OnboardingState): {
  text: string;
  subtext?: string;
  actionLabel?: string;
  actionHref?: string;
} {
  if (state.isComplete || !state.nextStep) {
    return { text: onboardingCompleteLine() };
  }

  const step = state.nextStep;
  const remaining = state.totalCount - state.completedCount;

  const intro = pickRotating([
    "Before you head out, let's get a few things ready.",
    "Let's get you set up so I can look after you properly.",
    "I'd like to help you get prepared first.",
    "A little setup now means I can help you faster later.",
  ]);

  let body: string;
  switch (step.id) {
    case 'profile':
      body = "Let's start by completing your profile. It helps responders assist you faster if you ever need help.";
      break;
    case 'contacts':
      body = "Let's start by adding one emergency contact — someone you trust who should be reached if you're ever in trouble.";
      break;
    case 'wallet':
      body = "Now let's prepare your Emergency Wallet. Add your blood group and any medical conditions so first responders have what they need.";
      break;
    case 'notifications':
      body = 'Turn on notifications so I can alert you the moment something needs your attention.';
      break;
    case 'location':
      body = 'Enable location permission so I can watch over your journeys accurately. I only see your location when you start a journey.';
      break;
    case 'subscription':
      body = 'You are on the Free plan. Premium unlocks Voice Mode and priority response — worth knowing about.';
      break;
    case 'journey_guard':
      body = 'Finally, try Journey Guard. Share your destination and I will quietly watch over your trip.';
      break;
  }

  const urgency =
    remaining <= 2
      ? pickRotating(['Almost there.', "You're nearly ready.", 'Just a bit more.'])
      : '';

  const text = urgency ? `${urgency} ${body}` : `${intro} ${body}`;

  return {
    text,
    subtext: step.gapPhrase,
    actionLabel: step.actionLabel,
    actionHref: step.actionHref,
  };
}

/**
 * Step 4 (after completion): acknowledge the step just finished, then move on.
 * `justCompletedId` is the step the user finished; `newState` is the freshly
 * re-evaluated checklist.
 */
export function onboardingAcknowledge(
  justCompletedId: SetupStepId | null,
  newState: OnboardingState,
): {
  text: string;
  subtext?: string;
  actionLabel?: string;
  actionHref?: string;
} {
  if (newState.isComplete) {
    return { text: onboardingCompleteLine() };
  }

  const praise = pickRotating([
    'Great.',
    'Excellent.',
    'Nice work.',
    "That's done.",
    'Perfect.',
  ]);

  if (justCompletedId) {
    const finishedLabel = labelForAcknowledge(justCompletedId);
    const next = onboardingNextStep(newState);
    return {
      text: `${praise} Your ${finishedLabel} is set. ${next.text}`,
      subtext: next.subtext,
      actionLabel: next.actionLabel,
      actionHref: next.actionHref,
    };
  }

  return onboardingNextStep(newState);
}

function labelForAcknowledge(id: SetupStepId): string {
  switch (id) {
    case 'profile': return 'profile';
    case 'contacts': return 'emergency contacts';
    case 'wallet': return 'Emergency Wallet';
    case 'notifications': return 'notifications';
    case 'location': return 'location permission';
    case 'subscription': return 'subscription';
    case 'journey_guard': return 'Journey Guard';
  }
}

/**
 * Step 5: the readiness line delivered when every step is complete.
 */
export function onboardingCompleteLine(): string {
  return "You're ready. If an emergency happens, I'll help you reach the right people quickly.";
}

/**
 * A short progress hint Guardian can drop in naturally (never a percentage).
 * Returns null if there's nothing useful to say.
 */
export function onboardingProgressHint(state: OnboardingState): string | null {
  if (state.isComplete) return null;
  if (state.completedCount === 0) return null;
  const remaining = state.totalCount - state.completedCount;
  if (remaining === 1) return "Your emergency profile is almost complete.";
  if (state.completedCount >= 4) return "Your emergency profile is becoming stronger.";
  return null;
}
