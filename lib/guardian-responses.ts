import type { LucideIcon } from 'lucide-react';
import {
  ShieldCheck,
  Navigation,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BatteryLow,
  SatelliteDish,
  WifiOff,
  Users,
  Wallet,
  UserCircle,
  Sparkles,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Guardian Response Library
// ─────────────────────────────────────────────────────────────────────────────
// Categorized response libraries for the Guardian AI companion.
// Guardian randomly rotates responses within each category to feel natural
// and non-repetitive. Each category maps to a specific situational context.
//
// Categories:
//   greetings, journey_started, monitoring, approaching_eta, overdue,
//   arrival, battery, gps, internet, contacts, emergency_wallet,
//   profile_completion, safety_check, repeated_journey
//
// Voice Mode placeholders (Premium, not enabled):
//   voice_mode, wake_word, duress_phrase, voice_commands

export type GuardianTone = 'safe' | 'caution' | 'warning' | 'danger';

export interface GuardianResponse {
  text: string;
  subtext?: string;
  tone: GuardianTone;
  icon: LucideIcon;
  actionLabel?: string;
  actionHref?: string;
}

export type GuardianCategory =
  | 'greetings'
  | 'journey_started'
  | 'monitoring'
  | 'approaching_eta'
  | 'overdue'
  | 'arrival'
  | 'battery'
  | 'gps'
  | 'internet'
  | 'contacts'
  | 'emergency_wallet'
  | 'profile_completion'
  | 'safety_check'
  | 'repeated_journey'
  | 'all_clear'
  | 'before_journey';

// ─────────────────────────────────────────────────────────────────────────────
// Response Libraries
// ─────────────────────────────────────────────────────────────────────────────

export const GUARDIAN_RESPONSES: Record<GuardianCategory, GuardianResponse[]> = {
  // ── Greetings (shown once per session) ──
  greetings: [
    {
      text: 'Good morning',
      subtext: "Everything looks good today. Let's make sure you arrive safely.",
      tone: 'safe',
      icon: Sparkles,
    },
    {
      text: 'Good morning',
      subtext: "I'm here and watching over things. Have a calm and safe day.",
      tone: 'safe',
      icon: Sparkles,
    },
    {
      text: 'Good morning',
      subtext: 'All systems are ready. I will be here whenever you need me.',
      tone: 'safe',
      icon: Sparkles,
    },
    {
      text: 'Good afternoon',
      subtext: "Everything looks good today. Let's make sure you arrive safely.",
      tone: 'safe',
      icon: Sparkles,
    },
    {
      text: 'Good evening',
      subtext: "I'm here if you need me. Stay safe out there.",
      tone: 'safe',
      icon: Sparkles,
    },
  ],

  // ── Before Journey ──
  before_journey: [
    {
      text: 'Heading somewhere?',
      subtext: "I'll quietly monitor your trip and check in only if something feels unusual.",
      tone: 'safe',
      icon: ShieldCheck,
      actionLabel: 'Start Journey',
      actionHref: '/dashboard/journey',
    },
    {
      text: 'Planning a trip?',
      subtext: 'Share your destination and I will keep an eye on your journey.',
      tone: 'safe',
      icon: ShieldCheck,
      actionLabel: 'Start Journey',
      actionHref: '/dashboard/journey',
    },
    {
      text: 'Let me know when you are ready to set off.',
      subtext: 'I will monitor quietly in the background.',
      tone: 'safe',
      icon: ShieldCheck,
      actionLabel: 'Start Journey',
      actionHref: '/dashboard/journey',
    },
  ],

  // ── Journey Started ──
  journey_started: [
    {
      text: 'Journey started.',
      subtext: "I'll monitor your progress in the background.",
      tone: 'safe',
      icon: Navigation,
    },
    {
      text: 'Safe travels.',
      subtext: 'I am watching your journey quietly. No need to check in unless something feels off.',
      tone: 'safe',
      icon: Navigation,
    },
    {
      text: 'On our way.',
      subtext: 'Your trip is being monitored. Focus on the road.',
      tone: 'safe',
      icon: Navigation,
    },
  ],

  // ── Monitoring (active journey, normal state) ──
  monitoring: [
    {
      text: "I'm actively monitoring your journey.",
      subtext: 'Everything is being watched. Tap if you need anything.',
      tone: 'warning',
      icon: ShieldCheck,
    },
    {
      text: 'GPS is active. Your journey is being tracked.',
      subtext: 'Everything looks good so far.',
      tone: 'safe',
      icon: ShieldCheck,
    },
    {
      text: 'You are on your way. I am keeping watch.',
      subtext: 'No concerns at the moment.',
      tone: 'safe',
      icon: ShieldCheck,
    },
  ],

  // ── Approaching ETA ──
  approaching_eta: [
    {
      text: "You're getting close to your destination.",
      subtext: 'Almost there.',
      tone: 'caution',
      icon: Clock,
    },
    {
      text: 'Nearly at your destination.',
      subtext: 'A few minutes to go.',
      tone: 'caution',
      icon: Clock,
    },
    {
      text: 'Almost there.',
      subtext: 'Your ETA is approaching.',
      tone: 'caution',
      icon: Clock,
    },
  ],

  // ── Overdue ──
  overdue: [
    {
      text: 'You appear overdue.',
      subtext: 'Would you like me to start a safety check?',
      tone: 'danger',
      icon: AlertTriangle,
      actionLabel: 'Start Safety Check',
      actionHref: '/dashboard/journey',
    },
    {
      text: 'You are past your expected arrival time.',
      subtext: 'Tap to confirm you are safe, or I can start a safety check.',
      tone: 'danger',
      icon: AlertTriangle,
      actionLabel: 'Start Safety Check',
      actionHref: '/dashboard/journey',
    },
    {
      text: 'Your journey is running longer than expected.',
      subtext: 'Would you like me to check in on you?',
      tone: 'danger',
      icon: AlertTriangle,
      actionLabel: 'Start Safety Check',
      actionHref: '/dashboard/journey',
    },
  ],

  // ── Arrival ──
  arrival: [
    {
      text: 'Welcome back.',
      subtext: 'Glad you arrived safely.',
      tone: 'safe',
      icon: CheckCircle2,
    },
    {
      text: 'Great news. You have safely completed another journey.',
      subtext: 'Well done. I will be here when you need me again.',
      tone: 'safe',
      icon: CheckCircle2,
    },
    {
      text: 'You have arrived.',
      subtext: 'Journey completed safely.',
      tone: 'safe',
      icon: CheckCircle2,
    },
  ],

  // ── Battery Low ──
  battery: [
    {
      text: 'Your battery is getting low.',
      subtext: 'If possible, consider charging soon so Guardian can continue monitoring.',
      tone: 'caution',
      icon: BatteryLow,
    },
    {
      text: 'Battery running low.',
      subtext: 'I can only watch over you while your device is on. Consider charging soon.',
      tone: 'caution',
      icon: BatteryLow,
    },
  ],

  // ── GPS Disabled ──
  gps: [
    {
      text: "I can't access your location.",
      subtext: 'Enable GPS if you would like me to monitor your journey accurately.',
      tone: 'caution',
      icon: SatelliteDish,
      actionLabel: 'Enable GPS',
      actionHref: '/dashboard/settings',
    },
    {
      text: 'Location access is off.',
      subtext: 'I can still be here, but I cannot track your journey without GPS.',
      tone: 'caution',
      icon: SatelliteDish,
      actionLabel: 'Enable GPS',
      actionHref: '/dashboard/settings',
    },
  ],

  // ── Internet Offline ──
  internet: [
    {
      text: 'Your internet connection appears unavailable.',
      subtext: "I'll continue monitoring locally and sync once you're back online.",
      tone: 'warning',
      icon: WifiOff,
    },
    {
      text: 'You appear to be offline.',
      subtext: 'I am still watching locally. Your data will sync when you reconnect.',
      tone: 'warning',
      icon: WifiOff,
    },
  ],

  // ── Emergency Contacts Missing ──
  contacts: [
    {
      text: "You haven't added any emergency contacts yet.",
      subtext: 'Would you like to set them up now?',
      tone: 'caution',
      icon: Users,
      actionLabel: 'Add Contacts',
      actionHref: '/dashboard/contacts',
    },
    {
      text: 'No emergency contacts on file.',
      subtext: 'Adding trusted contacts ensures someone is notified if you need help.',
      tone: 'caution',
      icon: Users,
      actionLabel: 'Add Contacts',
      actionHref: '/dashboard/contacts',
    },
  ],

  // ── Emergency Wallet Incomplete ──
  emergency_wallet: [
    {
      text: 'Your Emergency Wallet is still incomplete.',
      subtext: 'Adding important medical information could help first responders during an emergency.',
      tone: 'caution',
      icon: Wallet,
      actionLabel: 'Complete Wallet',
      actionHref: '/dashboard/wallet',
    },
    {
      text: 'Your medical profile is missing some details.',
      subtext: 'Completing your Emergency Wallet improves your readiness.',
      tone: 'caution',
      icon: Wallet,
      actionLabel: 'Complete Wallet',
      actionHref: '/dashboard/wallet',
    },
  ],

  // ── Profile Incomplete ──
  profile_completion: [
    {
      text: "Your emergency profile isn't fully completed yet.",
      subtext: 'Finishing it improves your emergency readiness.',
      tone: 'caution',
      icon: UserCircle,
      actionLabel: 'Complete Profile',
      actionHref: '/dashboard/profile',
    },
    {
      text: 'Your profile has some missing details.',
      subtext: 'A complete profile helps responders assist you faster.',
      tone: 'caution',
      icon: UserCircle,
      actionLabel: 'Complete Profile',
      actionHref: '/dashboard/profile',
    },
  ],

  // ── Safety Check ──
  safety_check: [
    {
      text: 'Are you safe?',
      subtext: 'Take your time to respond.',
      tone: 'danger',
      icon: AlertTriangle,
      actionLabel: 'Start Safety Check',
      actionHref: '/dashboard/journey',
    },
    {
      text: 'Need more time, or do you need help?',
      subtext: 'I am here. Take your time to respond.',
      tone: 'danger',
      icon: AlertTriangle,
      actionLabel: 'Start Safety Check',
      actionHref: '/dashboard/journey',
    },
    {
      text: "I haven't detected progress for a while. Are you okay?",
      subtext: 'No rush — just checking in.',
      tone: 'danger',
      icon: AlertTriangle,
      actionLabel: 'Start Safety Check',
      actionHref: '/dashboard/journey',
    },
  ],

  // ── Repeated Journey ──
  repeated_journey: [
    {
      text: "I've noticed you travel this route often.",
      subtext: 'Would you like to save it as one of your regular journeys?',
      tone: 'safe',
      icon: Navigation,
      actionLabel: 'View Journeys',
      actionHref: '/dashboard/journey',
    },
    {
      text: 'This looks like a familiar route.',
      subtext: 'You have traveled this way before. Want to save it for quick access?',
      tone: 'safe',
      icon: Navigation,
      actionLabel: 'View Journeys',
      actionHref: '/dashboard/journey',
    },
  ],

  // ── All Clear (default) ──
  all_clear: [
    {
      text: 'Everything looks good today.',
      subtext: "Let's make sure you arrive safely.",
      tone: 'safe',
      icon: ShieldCheck,
    },
    {
      text: 'All systems are ready.',
      subtext: 'I am here whenever you need me.',
      tone: 'safe',
      icon: ShieldCheck,
    },
    {
      text: 'You are all set.',
      subtext: 'Stay safe out there.',
      tone: 'safe',
      icon: ShieldCheck,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Premium Voice Mode Placeholders (NOT ENABLED)
// ─────────────────────────────────────────────────────────────────────────────

export const VOICE_MODE_PREMIUM = {
  voice_mode: {
    label: 'Voice Mode',
    description: 'Talk to Guardian using natural voice commands.',
    premium: true,
    enabled: false,
    placeholder: true,
  },
  wake_word: {
    label: 'Wake Word',
    description: 'Activate Guardian hands-free with a custom wake word.',
    premium: true,
    enabled: false,
    placeholder: true,
  },
  duress_phrase: {
    label: 'Duress Phrase',
    description: 'A secret phrase that silently triggers SOS without alerting anyone nearby.',
    premium: true,
    enabled: false,
    placeholder: true,
  },
  voice_commands: {
    label: 'Voice Commands',
    description: 'Control DEYGO with voice: start journey, send SOS, call contact.',
    premium: true,
    enabled: false,
    placeholder: true,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Response Selection Engine
// ─────────────────────────────────────────────────────────────────────────────

const lastResponseIndex: Record<GuardianCategory, number> = {} as Record<GuardianCategory, number>;

export function getGuardianResponse(category: GuardianCategory): GuardianResponse {
  const responses = GUARDIAN_RESPONSES[category];
  if (!responses || responses.length === 0) {
    return GUARDIAN_RESPONSES.all_clear[0];
  }

  if (responses.length === 1) return responses[0];

  // Rotate randomly, avoiding repeating the same one consecutively
  let index = Math.floor(Math.random() * responses.length);
  if (index === lastResponseIndex[category]) {
    index = (index + 1) % responses.length;
  }
  lastResponseIndex[category] = index;
  return responses[index];
}

export function getGreetingResponse(name: string | null): GuardianResponse {
  const hour = new Date().getHours();
  const firstName = name?.split(' ')[0] || 'there';

  let category: GuardianCategory = 'greetings';
  if (hour >= 12 && hour < 17) {
    // Use afternoon greeting — find one with "afternoon"
    const afternoon = GUARDIAN_RESPONSES.greetings.find((g) => g.text.includes('afternoon'));
    if (afternoon) {
      return {
        ...afternoon,
        text: `Good afternoon ${firstName}.`,
        subtext: "Everything looks good today. Let's make sure you arrive safely.",
      };
    }
  } else if (hour >= 17) {
    const evening = GUARDIAN_RESPONSES.greetings.find((g) => g.text.includes('evening'));
    if (evening) {
      return {
        ...evening,
        text: `Good evening ${firstName}.`,
      };
    }
  }

  const morning = GUARDIAN_RESPONSES.greetings[0];
  return {
    ...morning,
    text: `Good morning ${firstName}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Context-based category selection
// ─────────────────────────────────────────────────────────────────────────────

export interface GuardianContextInput {
  monitorState: 'normal' | 'watch' | 'concern' | 'alert' | null;
  displayState: 'on_schedule' | 'approaching_eta' | 'overdue' | 'guardian_monitoring';
  confidenceScore: number | null;
  gpsActive: boolean;
  gpsPermission: string;
  online: boolean;
  hasJourney: boolean;
  batteryPercent: number | null;
  batteryCharging: boolean | null;
  contactsCount: number;
  walletComplete: boolean;
  profileComplete: boolean;
  journeyJustStarted: boolean;
  journeyJustCompleted: boolean;
  isRepeatedRoute: boolean;
}

export function selectGuardianCategory(ctx: GuardianContextInput): GuardianCategory {
  // Critical system issues first
  if (!ctx.online) return 'internet';
  if (ctx.gpsPermission === 'denied') return 'gps';

  // Battery warning (only when not charging and low)
  if (ctx.batteryPercent !== null && ctx.batteryPercent <= 20 && !ctx.batteryCharging) {
    return 'battery';
  }

  // Journey lifecycle events
  if (ctx.journeyJustStarted) return 'journey_started';
  if (ctx.journeyJustCompleted) return 'arrival';

  // Active journey monitoring
  if (ctx.hasJourney) {
    if (ctx.monitorState === 'alert' || (ctx.confidenceScore !== null && ctx.confidenceScore <= 9)) {
      return 'safety_check';
    }
    if (ctx.monitorState === 'concern' || (ctx.confidenceScore !== null && ctx.confidenceScore < 25)) {
      return 'safety_check';
    }
    if (ctx.displayState === 'overdue') return 'overdue';
    if (ctx.displayState === 'guardian_monitoring') return 'monitoring';
    if (ctx.displayState === 'approaching_eta') return 'approaching_eta';
    if (ctx.monitorState === 'watch') return 'monitoring';
    return 'monitoring';
  }

  // No active journey — check onboarding gaps
  if (ctx.contactsCount === 0) return 'contacts';
  if (!ctx.walletComplete) return 'emergency_wallet';
  if (!ctx.profileComplete) return 'profile_completion';
  if (ctx.isRepeatedRoute) return 'repeated_journey';

  return 'all_clear';
}
