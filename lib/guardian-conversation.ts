// ─────────────────────────────────────────────────────────────────────────────
// Guardian Conversation Engine
// ─────────────────────────────────────────────────────────────────────────────
// Conversational intent matching and response generation for the Guardian AI.
// Reuses the existing Guardian Response Library (lib/guardian-responses.ts) and
// the Guardian Engine context (lib/guardian.ts) to generate natural, calm,
// professional replies — like ChatGPT, Siri, or Gemini.
//
// Guardian NEVER dispatches SOS, contacts providers, or overrides user
// decisions. It only observes, explains, and recommends.
//
// This module is purely a UI-layer concern: it translates free-text user input
// + the current Guardian context into a natural language reply. It does not
// modify, extend, or bypass any engine logic.

import {
  getGuardianResponse,
  selectGuardianCategory,
  getGreetingResponse,
  type GuardianCategory,
  type GuardianResponse,
} from './guardian-responses';

// ─────────────────────────────────────────────────────────────────────────────
// Personality phrases — calm, protective, never robotic
// ─────────────────────────────────────────────────────────────────────────────
// A small rotating set of Guardian "connective tissue". These give replies a
// human cadence without ever dramatizing or panicking the user.

const OPENERS = [
  "I've got your back.",
  "I'm here.",
  "I'll keep watching.",
  "I'm keeping an eye on things.",
  "I noticed something.",
];

function opener(): string {
  return OPENERS[Math.floor(Math.random() * OPENERS.length)];
}


// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ConversationRole = 'guardian' | 'user';

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  text: string;
  subtext?: string;
  timestamp: number;
  actionLabel?: string;
  actionHref?: string;
  tone?: GuardianResponse['tone'];
  streaming?: boolean;
}

export type ConversationIntent =
  | 'greeting'
  | 'heading_out'
  | 'am_i_safe'
  | 'check_safety'
  | 'start_journey'
  | 'emergency_wallet'
  | 'emergency_contacts'
  | 'notifications'
  | 'safety_score'
  | 'feel_unsafe'
  | 'battery'
  | 'gps'
  | 'internet'
  | 'journey_status'
  | 'what_do_you_know'
  | 'who_are_you'
  | 'share_location'
  | 'call_contact'
  | 'profile'
  | 'help'
  | 'thanks'
  | 'unknown';

export interface IntentMatch {
  intent: ConversationIntent;
  confidence: number;
}

export interface ConversationContext {
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
  firstName: string | null;
  unreadNotifications: number;
  journeyOrigin: string | null;
  journeyDestination: string | null;
  journeyEta: string | null;
  firstContactName: string | null;
  firstContactPhone: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent keyword library
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<ConversationIntent, string[]> = {
  greeting: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'hiya', 'howdy', 'greetings'],
  heading_out: ["i'm heading out", 'heading out', 'im heading out', 'heading off', "i'm off", 'going out', 'on my way out', 'about to leave', 'leaving now'],
  am_i_safe: ['am i safe', 'safe', 'safety', 'how safe', 'is it safe', 'my safety', 'are you sure', 'safe right now'],
  check_safety: ['check my safety', 'check safety', 'safety check', 'check on me', 'check in', 'run a check'],
  start_journey: ['start journey', 'start a journey', 'begin journey', 'new journey', 'start trip', 'begin trip', 'start monitoring', 'begin a journey'],
  emergency_wallet: ['wallet', 'emergency wallet', 'medical', 'blood group', 'medical info', 'my medical', 'health info'],
  emergency_contacts: ['contacts', 'emergency contacts', 'my contacts', 'emergency numbers', 'call someone', 'reach someone'],
  notifications: ['notifications', 'alerts', 'messages', 'any alerts', 'any notifications', 'what happened'],
  safety_score: ['safety score', 'confidence', 'my score', 'readiness', 'safety readiness', 'how ready', 'confidence score'],
  feel_unsafe: ["i feel unsafe", 'feel unsafe', 'not safe', "i'm unsafe", 'im unsafe', 'scared', 'in danger', 'unsafe', 'worried', 'nervous', 'threatened'],
  battery: ['battery', 'charge', 'low battery', 'power', 'charging', 'battery low', 'battery level'],
  gps: ['gps', 'my location', 'position', 'tracking', 'where am i'],
  internet: ['internet', 'online', 'offline', 'connection', 'network', 'wifi', 'data'],
  journey_status: ['journey', 'trip', 'my journey', 'journey status', 'how is my journey', 'where am i going', 'destination', 'eta', 'arrival', 'how long', 'how far'],
  what_do_you_know: ['what do you know about me', 'what do you know', 'what can you see', 'what do you see', 'my info', 'my information', 'tell me about me', 'what do you have on me'],
  who_are_you: ['who are you', 'what are you', 'your name', 'about you', 'what is guardian', 'who is guardian', 'are you ai', 'are you real'],
  share_location: ['share location', 'share my location', 'share live location', 'send location', 'live location', 'share where i am'],
  call_contact: ['call', 'call contact', 'call someone', 'phone a friend', 'call emergency', 'make a call', 'call my contact', 'ring someone'],
  profile: ['profile', 'my profile', 'edit profile', 'update profile', 'my details', 'my account', 'my info'],
  help: ['help', 'what can you do', 'what do you do', 'options', 'commands', 'assist', 'what can i do'],
  thanks: ['thanks', 'thank you', 'appreciate', 'grateful', 'cheers', 'ty'],
  unknown: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Intent matching
// ─────────────────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[.!?,]+$/g, '').replace(/\s+/g, ' ');
}

export function matchIntent(input: string): IntentMatch {
  const normalized = normalize(input);
  if (!normalized) return { intent: 'unknown', confidence: 0 };

  let best: IntentMatch = { intent: 'unknown', confidence: 0 };

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [ConversationIntent, string[]][]) {
    if (intent === 'unknown' || keywords.length === 0) continue;
    for (const keyword of keywords) {
      if (normalized === keyword || normalized.includes(` ${keyword} `) || normalized.startsWith(`${keyword} `) || normalized.endsWith(` ${keyword}`)) {
        const confidence = keyword.length >= 12 ? 0.95 : keyword.length >= 7 ? 0.85 : 0.75;
        if (confidence > best.confidence) {
          best = { intent, confidence };
        }
      }
    }
  }

  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversational response generation
// ─────────────────────────────────────────────────────────────────────────────
// Each intent maps to a natural conversational reply. Where possible we reuse
// the existing Guardian Response Library so voice + tone stay consistent with
// the rest of the app. We enrich responses with live context (confidence score,
// journey state, etc.) so replies feel intelligent and personalized.

function firstName(name: string | null): string {
  return name?.split(' ')[0] || 'there';
}

function describeConfidence(score: number | null): string {
  if (score === null) return 'Everything looks stable on my side.';
  if (score >= 80) return 'Your safety readiness is strong.';
  if (score >= 50) return 'Your safety readiness looks moderate — a couple of things could be stronger.';
  if (score >= 25) return "I don't love what I'm seeing on readiness. I think we should take a couple of precautions before you head out.";
  return 'Your safety readiness is currently low. Let me help you get ready before you travel.';
}

function describeJourney(ctx: ConversationContext): string {
  if (!ctx.hasJourney) {
    return "You don't have an active journey right now. Whenever you're ready to head out, I'll monitor it quietly.";
  }
  switch (ctx.displayState) {
    case 'on_schedule':
      return "Your journey is on schedule. I'm watching quietly in the background.";
    case 'approaching_eta':
      return "You're getting close to your destination. Almost there.";
    case 'overdue':
      return 'Your journey is running a bit longer than expected. Would you like me to check in on you?';
    case 'guardian_monitoring':
      return "I'm actively monitoring your journey. Everything is being watched.";
  }
}

function describeBattery(ctx: ConversationContext): string {
  if (ctx.batteryPercent === null) return "I can't read your battery level right now, but I'm still here.";
  if (ctx.batteryCharging) return `Your battery is charging at ${ctx.batteryPercent}%. You're in good shape.`;
  if (ctx.batteryPercent <= 15) return `Your battery is at ${ctx.batteryPercent}%, which is getting low. I recommend charging soon so I can keep watching over you.`;
  if (ctx.batteryPercent <= 30) return `Your battery looks okay at ${ctx.batteryPercent}%, but keep an eye on it.`;
  return `Your battery looks healthy enough for monitoring.`;
}

function describeGps(ctx: ConversationContext): string {
  if (ctx.gpsPermission === 'denied') return "I can't see your location right now. GPS permission is turned off. I can still be here, but I won't be able to track a journey without it.";
  if (ctx.gpsActive) return 'I can currently see your location clearly.';
  return 'I\'ll be able to see your location once you start a journey.';
}

function describeInternet(ctx: ConversationContext): string {
  if (ctx.online) return 'Your connection is working and I can sync everything in real time.';
  return "You appear to be offline. I'm still watching locally and I'll sync everything the moment you're back online.";
}

function describeContacts(ctx: ConversationContext): string {
  if (ctx.contactsCount === 0) return "You haven't added any emergency contacts yet. It's worth setting up a trusted person so someone can be reached if you ever need help.";
  if (ctx.contactsCount === 1) return 'You have one emergency contact on file. Adding one or two more would give you extra coverage.';
  return `You have ${ctx.contactsCount} emergency contacts on file. That looks solid.`;
}

function describeWallet(ctx: ConversationContext): string {
  if (ctx.walletComplete) return 'Your Emergency Wallet is complete. If ever it were needed, first responders would have what they need.';
  return "I noticed your Emergency Wallet isn't complete yet. Would you like to finish it now? It could save valuable time during an emergency.";
}

function describeProfile(ctx: ConversationContext): string {
  if (ctx.profileComplete) return 'Your profile is complete. You are well set up.';
  return "Your profile has a few missing details. Completing it helps responders assist you faster if ever needed.";
}

function wrap(response: GuardianResponse): ConversationMessage {
  return {
    id: generateId(),
    role: 'guardian',
    text: response.text,
    subtext: response.subtext,
    tone: response.tone,
    actionLabel: response.actionLabel,
    actionHref: response.actionHref,
    timestamp: Date.now(),
  };
}

function textReply(text: string, subtext?: string, tone: GuardianResponse['tone'] = 'safe', actionLabel?: string, actionHref?: string): ConversationMessage {
  return {
    id: generateId(),
    role: 'guardian',
    text,
    subtext,
    tone,
    actionLabel,
    actionHref,
    timestamp: Date.now(),
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main response generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateGreeting(ctx: ConversationContext): ConversationMessage {
  const greeting = getGreetingResponse(ctx.firstName);

  const subtext = pick([
    "I'm watching over your safety. How can I help today?",
    "I'm watching over your safety. What would you like to do?",
    "Everything looks normal on my side. How can I help you today?",
    "I'm here and keeping an eye on things. What can I do for you?",
    "All systems are ready. I am here whenever you need me.",
  ]);

  return {
    id: generateId(),
    role: 'guardian',
    text: `${greeting.text}`,
    subtext,
    tone: 'safe',
    timestamp: Date.now(),
  };
}

export function generateReply(input: string, ctx: ConversationContext): ConversationMessage {
  const { intent } = matchIntent(input);
  const name = firstName(ctx.firstName);

  switch (intent) {
    case 'greeting':
      return textReply(
        pick([
          `Hello ${name}.`,
          `Hi ${name}.`,
          `Hey ${name}, it's good to see you again.`,
        ]),
        pick([
          'Everything looks stable. How can I help?',
          "I'm here and watching over your safety. What would you like to do?",
          'All systems are ready. What can I do for you?',
        ])
      );

    case 'heading_out': {
      const journeyReply = ctx.hasJourney
        ? textReply(
            "You already have an active journey I'm monitoring. I'll keep watching quietly and only speak up if something needs your attention.",
            describeJourney(ctx),
            'safe',
            'View Journey',
            '/dashboard/journey'
          )
        : textReply(
            "Where are you travelling today? I'll quietly monitor your journey and let you know if anything needs your attention. Ready whenever you are.",
            'Share your destination and I will keep an eye on your trip.',
            'safe',
            'Start Journey',
            '/dashboard/journey'
          );
      return journeyReply;
    }

    case 'am_i_safe':
    case 'check_safety':
    case 'safety_score': {
      const confidenceLine = describeConfidence(ctx.confidenceScore);
      const issues: string[] = [];
      if (!ctx.online) issues.push('Your internet is offline');
      if (ctx.gpsPermission === 'denied') issues.push('GPS is off');
      if (ctx.batteryPercent !== null && ctx.batteryPercent <= 20 && !ctx.batteryCharging) issues.push('Your battery is low');
      if (ctx.contactsCount === 0) issues.push('You have no emergency contacts');
      if (!ctx.walletComplete) issues.push('Your Emergency Wallet is incomplete');
      if (!ctx.profileComplete) issues.push('Your profile is missing some details');

      const body = issues.length === 0
        ? 'Based on what I can currently see, everything looks good. If anything changes during your journey, I will let you know calmly.'
        : `Based on what I can see, ${confidenceLine.toLowerCase()} A few things to be aware of: ${issues.join(', ')}. Would you like me to help with any of these?`;

      return textReply(
        confidenceLine,
        body,
        issues.length === 0 ? 'safe' : issues.length <= 2 ? 'caution' : 'warning',
        issues.length > 0 ? 'View Safety Details' : undefined,
        undefined
      );
    }

    case 'start_journey':
      return textReply(
        "Let's get you set up. I'll monitor your journey quietly in the background and only check in if something feels unusual.",
        'Share your destination and expected arrival time, and I will take care of the rest.',
        'safe',
        'Start Journey',
        '/dashboard/journey'
      );

    case 'emergency_wallet':
      return textReply(
        describeWallet(ctx),
        ctx.walletComplete ? 'Your medical information is ready if ever needed.' : 'Completing it improves your readiness.',
        ctx.walletComplete ? 'safe' : 'caution',
        'Open Wallet',
        '/dashboard/wallet'
      );

    case 'emergency_contacts':
      return textReply(
        describeContacts(ctx),
        ctx.contactsCount === 0 ? 'Adding trusted contacts ensures someone is notified if you need help.' : 'You can manage them from the contacts page.',
        ctx.contactsCount === 0 ? 'caution' : 'safe',
        'Manage Contacts',
        '/dashboard/contacts'
      );

    case 'notifications':
      return textReply(
        "Let's take a look at your recent notifications.",
        'You can review all alerts and messages from the notifications page.',
        'safe',
        'View Notifications',
        '/dashboard/notifications'
      );

    case 'feel_unsafe':
      return textReply(
        "I'm here with you. You are not alone.",
        pick([
          'If you feel threatened, I can help you trigger SOS — it will alert your emergency contacts and share your location. You stay in control.',
          'Would you like to start an SOS? It will notify your trusted contacts and share where you are. Only do this if it is safe to do so.',
          'Your safety matters. I can help you send an SOS alert right now, or we can review your safety details together first.',
        ]),
        'danger',
        'Send SOS',
        '/dashboard/sos'
      );

    case 'battery':
      return textReply(describeBattery(ctx), undefined, ctx.batteryPercent !== null && ctx.batteryPercent <= 20 && !ctx.batteryCharging ? 'caution' : 'safe');

    case 'gps':
      return textReply(
        describeGps(ctx),
        ctx.gpsPermission === 'denied' ? 'Enable GPS if you would like me to monitor your journey accurately.' : undefined,
        ctx.gpsPermission === 'denied' ? 'caution' : 'safe',
        ctx.gpsPermission === 'denied' ? 'Enable GPS' : undefined,
        ctx.gpsPermission === 'denied' ? '/dashboard/settings' : undefined
      );

    case 'internet':
      return textReply(describeInternet(ctx), undefined, ctx.online ? 'safe' : 'warning');

    case 'journey_status':
      return textReply(
        describeJourney(ctx),
        ctx.hasJourney ? "I'll keep watching." : 'Start one whenever you are ready.',
        ctx.hasJourney && ctx.displayState === 'overdue' ? 'danger' : 'safe',
        ctx.hasJourney ? 'View Journey' : 'Start Journey',
        ctx.hasJourney ? '/dashboard/journey' : '/dashboard/journey'
      );

    case 'what_do_you_know': {
      const parts: string[] = [];
      parts.push(ctx.hasJourney
        ? `I know you're currently on a journey${ctx.journeyDestination ? ` to ${ctx.journeyDestination}` : ''}.`
        : "I know you don't have an active journey right now.");
      parts.push(`Your safety readiness is ${ctx.confidenceScore !== null ? `${ctx.confidenceScore}%` : 'stable'}.`);
      if (ctx.contactsCount > 0) parts.push(`You have ${ctx.contactsCount} emergency contact${ctx.contactsCount > 1 ? 's' : ''} set up.`);
      else parts.push("You haven't added any emergency contacts yet.");
      parts.push(ctx.walletComplete ? 'Your Emergency Wallet is complete.' : "Your Emergency Wallet isn't complete yet.");
      parts.push(ctx.profileComplete ? 'Your profile is complete.' : 'Your profile is missing a few details.');
      if (ctx.unreadNotifications > 0) parts.push(`You have ${ctx.unreadNotifications} unread notification${ctx.unreadNotifications > 1 ? 's' : ''}.`);

      return textReply(
        `Here's what I can see right now, ${name}:`,
        parts.join(' '),
        'safe'
      );
    }

    case 'who_are_you':
      return textReply(
        "I'm Guardian — your personal safety companion.",
        pick([
          'I watch over your journeys, keep an eye on your safety readiness, and help you act quickly if something feels wrong. I never panic. I only recommend. You always decide.',
          "I'm here to keep you safe. I monitor quietly in the background and only speak up when something needs your attention. You stay in control — I just help you see clearly.",
        ]),
        'safe'
      );

    case 'share_location':
      return textReply(
        "I can help you share your live location with your emergency contacts.",
        'This sends your real-time position so someone you trust can follow along until you arrive safely.',
        'safe',
        'Open SOS',
        '/dashboard/sos'
      );

    case 'call_contact': {
      if (ctx.firstContactName && ctx.firstContactPhone) {
        return textReply(
          `I can help you reach ${ctx.firstContactName}.`,
          'Tap below to call them now.',
          'safe',
          `Call ${ctx.firstContactName}`,
          `tel:${ctx.firstContactPhone}`
        );
      }
      return textReply(
        "You don't have any emergency contacts set up yet.",
        'Add a trusted person first, and I can help you reach them in one tap.',
        'caution',
        'Add Contacts',
        '/dashboard/contacts'
      );
    }

    case 'profile':
      return textReply(
        describeProfile(ctx),
        ctx.profileComplete ? 'You can review or update it anytime.' : 'Completing it helps responders assist you faster.',
        ctx.profileComplete ? 'safe' : 'caution',
        'Open Profile',
        '/dashboard/profile'
      );

    case 'help':
      return textReply(
        'I can help you with a few things:',
        'Start a journey, check your safety score, open your emergency wallet, manage your emergency contacts, share your live location, call a contact, review notifications, or send an SOS if you feel unsafe. Just tell me what you need, or tap a suggestion below.',
        'safe'
      );

    case 'thanks':
      return textReply(
        pick([
          'Anytime. I am always here.',
          'You are welcome. Stay safe out there.',
          'Of course. That is what I am here for.',
          'Always. I will keep watching over you.',
          "Anytime. I've got your back.",
        ]),
        undefined,
        'safe'
      );

    case 'unknown':
    default:
      return textReply(
        pick([
          "I am not quite sure I understood that, but I am still here for you.",
          "I may not have caught that exactly, but I can still help. Try asking about your safety, your journey, or your emergency information.",
          `I am still learning, ${name}. In the meantime, I can help with your safety, journeys, wallet, contacts, and SOS.`,
        ]),
        'You can ask me things like "Am I safe?", "I am heading out", or "Check my safety score".',
        'safe'
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion chips
// ─────────────────────────────────────────────────────────────────────────────

export interface SuggestionChip {
  id: string;
  label: string;
  intent: ConversationIntent;
  href?: string;
  variant: 'default' | 'primary' | 'danger' | 'warning';
}

export const SUGGESTION_CHIPS: SuggestionChip[] = [
  { id: 'am-i-safe', label: 'Am I Safe?', intent: 'am_i_safe', variant: 'default' },
  { id: 'heading-out', label: "I'm Heading Out", intent: 'heading_out', href: '/dashboard/journey', variant: 'primary' },
  { id: 'start-journey', label: 'Start Journey', intent: 'start_journey', href: '/dashboard/journey', variant: 'default' },
  { id: 'feel-unsafe', label: 'I Feel Unsafe', intent: 'feel_unsafe', href: '/dashboard/sos', variant: 'danger' },
  { id: 'check-safety', label: 'Check My Safety', intent: 'check_safety', variant: 'default' },
  { id: 'safety-score', label: 'Safety Score', intent: 'safety_score', variant: 'default' },
  { id: 'emergency-contacts', label: 'Emergency Contacts', intent: 'emergency_contacts', href: '/dashboard/contacts', variant: 'default' },
  { id: 'emergency-wallet', label: 'Emergency Wallet', intent: 'emergency_wallet', href: '/dashboard/wallet', variant: 'default' },
  { id: 'what-do-you-know', label: 'What do you know about me?', intent: 'what_do_you_know', variant: 'default' },
  { id: 'help', label: 'Help', intent: 'help', variant: 'default' },
  { id: 'notifications', label: 'Notifications', intent: 'notifications', href: '/dashboard/notifications', variant: 'default' },
  { id: 'share-location', label: 'Share Live Location', intent: 'share_location', href: '/dashboard/sos', variant: 'default' },
  { id: 'call-contact', label: 'Call Emergency Contact', intent: 'call_contact', variant: 'default' },
];

export function chipsForContext(ctx: ConversationContext): SuggestionChip[] {
  // Always show the core set first, then surface context-relevant chips.
  const ids = new Set<string>(['am-i-safe', 'heading-out', 'feel-unsafe', 'what-do-you-know', 'help']);
  if (ctx.hasJourney) {
    ids.add('check-safety');
    ids.add('safety-score');
    ids.add('notifications');
  } else {
    ids.add('start-journey');
    ids.add('safety-score');
  }
  if (ctx.contactsCount === 0) ids.add('emergency-contacts');
  else ids.add('call-contact');
  if (!ctx.walletComplete) ids.add('emergency-wallet');
  if (ctx.unreadNotifications > 0) ids.add('notifications');
  // Keep the original ordering from SUGGESTION_CHIPS
  return SUGGESTION_CHIPS.filter((c) => ids.has(c.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: turn a selected chip into a reply
// ─────────────────────────────────────────────────────────────────────────────

export function replyForChip(chip: SuggestionChip, ctx: ConversationContext): ConversationMessage {
  return generateReply(chip.label, ctx);
}

export function replyFromSystemCategory(ctx: ConversationContext): ConversationMessage {
  const category = selectGuardianCategory({
    monitorState: ctx.monitorState,
    displayState: ctx.displayState,
    confidenceScore: ctx.confidenceScore,
    gpsActive: ctx.gpsActive,
    gpsPermission: ctx.gpsPermission,
    online: ctx.online,
    hasJourney: ctx.hasJourney,
    batteryPercent: ctx.batteryPercent,
    batteryCharging: ctx.batteryCharging,
    contactsCount: ctx.contactsCount,
    walletComplete: ctx.walletComplete,
    profileComplete: ctx.profileComplete,
    journeyJustStarted: ctx.journeyJustStarted,
    journeyJustCompleted: ctx.journeyJustCompleted,
    isRepeatedRoute: ctx.isRepeatedRoute,
  });
  return wrap(getGuardianResponse(category));
}

export { generateId };
