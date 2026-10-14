'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  X,
  Send,
  Mic,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { LocationService } from '@/lib/location-service';
import { getBatteryState, isOnline, getGpsPermission } from '@/lib/system-health';
import {
  assessJourney,
  generateEscalationRecommendation,
} from '@/lib/guardian';
import type { Journey, Contact, LocationReading, JourneyMonitorState, Wallet, Profile, NotificationRecord, Subscription } from '@/lib/types';
import { cn } from '@/lib/utils';
import { GuardianSafetyDetails } from './guardian-safety-details';
// Guardian UI talks ONLY to the AI orchestrator — never to the conversation
// engine directly. This keeps the UI provider-agnostic so an LLM can be
// enabled in lib/guardian-ai.ts without touching this component.
import {
  generateGuardianReply,
  generateGuardianGreeting,
  generateGuardianReplyForChip,
  getGuardianChips,
  buildGuardianContext,
  createSessionMemory,
  appendToMemory,
  generateId,
  generateGuardianOnboardingGreeting,
  generateGuardianOnboardingNext,
  type ConversationMessage,
  type ConversationContext,
  type SuggestionChip,
  type SessionMemory,
  type OnboardingInput,
  type OnboardingState,
  type SetupStepId,
} from '@/lib/guardian-ai';
import { evaluateOnboarding } from '@/lib/guardian-onboarding';

// ─────────────────────────────────────────────────────────────────────────────
// Guardian Assistant — conversational AI companion
// ─────────────────────────────────────────────────────────────────────────────
// The Guardian panel is now a conversation-first experience, like ChatGPT,
// Siri, or Gemini. Guardian speaks first with a natural greeting. The system
// dashboard is collapsed beneath "View Safety Details".
//
// The monitoring engine (Guardian Engine, Confidence Engine, Location Service)
// runs exactly as before — its outputs silently feed the conversation context
// so Guardian's replies are intelligent and personalized, but the raw system
// data is no longer the primary surface.
//
// Guardian NEVER dispatches SOS or contacts providers. It only recommends.

export function GuardianAssistant() {
  const { user, profile } = useAuth();
  const router = useRouter();

  // Panel state
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Conversation
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const greetingShownRef = useRef(false);
  // Session memory — in-memory only, never persisted, cleared on close.
  const memoryRef = useRef<SessionMemory>(createSessionMemory());

  // System health state — silently monitored
  const [online, setOnline] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState<boolean | null>(null);
  const [gpsPermission, setGpsPermission] = useState<string>('unknown');
  const [gpsActive, setGpsActive] = useState(false);

  // Journey state
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [journeyHistory, setJourneyHistory] = useState<Journey[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Guardian monitoring — runs silently
  const [monitorState, setMonitorState] = useState<JourneyMonitorState | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  // First-time onboarding — Guardian becomes a personal guide for new users.
  // The checklist stays internal; only Guardian's words are visible.
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'default' | 'unknown'>('unknown');
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [lastCompletedStep, setLastCompletedStep] = useState<SetupStepId | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const onboardingGreetingShownRef = useRef(false);

  const locationServiceRef = useRef<LocationService | null>(null);
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

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
  // Battery + GPS permission
  // ─────────────────────────────────────────────────────────────────────
  const refreshSystemHealth = useCallback(async () => {
    const battery = await getBatteryState();
    setBatteryLevel(battery.level);
    setBatteryCharging(battery.charging);
    const perm = await getGpsPermission();
    setGpsPermission(perm);
  }, []);

  useEffect(() => {
    refreshSystemHealth();
  }, [refreshSystemHealth]);

  // ─────────────────────────────────────────────────────────────────────
  // Load active journey, contacts, wallet, history
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [journeyRes, contactsRes, walletRes, historyRes, notifRes, subRes] = await Promise.all([
        supabase.from('journeys').select('*').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
        supabase.from('contacts').select('*').eq('user_id', user.id).limit(5),
        supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('journeys').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(20),
        supabase.from('notifications').select('*').eq('user_id', user.id).eq('read', false).limit(50),
        supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (cancelled) return;
      setActiveJourney(journeyRes.data as Journey | null);
      setContacts((contactsRes.data || []) as Contact[]);
      setWallet(walletRes.data as Wallet | null);
      setJourneyHistory((historyRes.data || []) as Journey[]);
      setUnreadNotifications((notifRes.data || []).length);
      setSubscription(subRes.data as Subscription | null);
    })();

    return () => { cancelled = true; };
  }, [user]);

  // ─────────────────────────────────────────────────────────────────────
  // GPS tracking — only when a journey is active
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeJourney) {
      setGpsActive(false);
      setMonitorState(null);
      setConfidenceScore(null);
      setRecommendation(null);
      if (locationServiceRef.current) {
        locationServiceRef.current.destroy();
        locationServiceRef.current = null;
      }
      return;
    }

    const service = new LocationService();
    locationServiceRef.current = service;
    service.onReading(() => setGpsActive(true));
    service.onError(() => setGpsActive(false));
    service.startTracking({ enableHighAccuracy: true, intervalMs: 10000 }).catch(() => setGpsActive(false));

    return () => {
      service.destroy();
      locationServiceRef.current = null;
    };
  }, [activeJourney]);

  // ─────────────────────────────────────────────────────────────────────
  // Guardian monitoring loop — runs silently, feeds conversation context
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeJourney || !locationServiceRef.current || !user) {
      if (monitorRef.current) {
        clearInterval(monitorRef.current);
        monitorRef.current = null;
      }
      return;
    }

    const runAssessment = () => {
      if (!activeJourney || !locationServiceRef.current || !user) return;
      const startedAt = new Date(activeJourney.started_at).getTime();
      const expectedArrival = activeJourney.expected_arrival ? new Date(activeJourney.expected_arrival).getTime() : null;

      const snapshot = assessJourney({
        journeyId: activeJourney.id,
        userId: user.id,
        startedAt,
        expectedArrival,
        locationService: locationServiceRef.current,
      });

      setMonitorState(snapshot.state);
      setConfidenceScore(snapshot.confidence.score);
      setRecommendation(generateEscalationRecommendation(snapshot).reason);
    };

    runAssessment();
    monitorRef.current = setInterval(runAssessment, 15000);
    return () => {
      if (monitorRef.current) {
        clearInterval(monitorRef.current);
        monitorRef.current = null;
      }
    };
  }, [activeJourney, user]);

  // ─────────────────────────────────────────────────────────────────────
  // Derived context — silently feeds Guardian's intelligence
  // ─────────────────────────────────────────────────────────────────────
  // Derived context — built via the orchestrator's single context builder.
  // The UI no longer computes displayState/walletComplete/etc itself; it
  // hands raw inputs to buildGuardianContext and receives the normalized
  // ConversationContext that every provider understands.
  // ─────────────────────────────────────────────────────────────────────
  const built = useMemo(
    () => buildGuardianContext({
      user: user ? { id: user.id } : null,
      profile: profile ? {
        full_name: profile.full_name,
        phone: profile.phone,
        blood_group: profile.blood_group,
        genotype: profile.genotype,
      } : null,
      activeJourney: activeJourney ? {
        id: activeJourney.id,
        origin: activeJourney.origin,
        destination: activeJourney.destination,
        started_at: activeJourney.started_at,
        expected_arrival: activeJourney.expected_arrival,
        status: activeJourney.status,
      } : null,
      journeyHistory: journeyHistory.map((j) => ({ origin: j.origin, destination: j.destination })),
      contacts: contacts.map((c) => ({ name: c.name, phone: c.phone })),
      wallet: wallet ? {
        blood_group: wallet.blood_group,
        genotype: wallet.genotype,
        medical_conditions: wallet.medical_conditions,
        allergies: wallet.allergies,
      } : null,
      monitorState,
      confidenceScore,
      online,
      gpsActive,
      gpsPermission,
      batteryLevel,
      batteryCharging,
      unreadNotifications,
      currentLocation: null,
      currentPage: null,
    }),
    [user, profile, activeJourney, journeyHistory, contacts, wallet, monitorState, confidenceScore, online, gpsActive, gpsPermission, batteryLevel, batteryCharging, unreadNotifications],
  );

  const conversationContext = built.context;
  const displayState = built.displayState;
  const walletComplete = conversationContext.walletComplete;
  const profileComplete = conversationContext.profileComplete;

  const chips = useMemo(() => getGuardianChips(conversationContext), [conversationContext]);

  // ─────────────────────────────────────────────────────────────────────
  // Notification permission signal (for onboarding checklist)
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unknown');
      return;
    }
    setNotificationPermission(Notification.permission as 'granted' | 'denied' | 'default');
  }, [open]);

  // Build the onboarding input from the orchestrator context + two extra signals.
  const onboardingInput: OnboardingInput = useMemo(
    () => ({
      ...conversationContext,
      notificationPermission,
      subscriptionActive: subscription?.status === 'active' && subscription?.plan === 'premium',
    }),
    [conversationContext, notificationPermission, subscription],
  );

  // ─────────────────────────────────────────────────────────────────────
  // Greeting — Guardian speaks first, once per open session.
  // For first-time users, Guardian becomes a personal onboarding guide:
  // welcome by name, one friendly sentence about DEYGO, then ONE recommended
  // action at a time. The checklist stays internal; only Guardian's words
  // are visible.
  // ─────────────────────────────────────────────────────────────────────
  const onboardingComplete = typeof window !== 'undefined' && localStorage.getItem('deygo_onboarding_complete') === 'true';

  useEffect(() => {
    if (!open || messages.length > 0 || greetingShownRef.current) return;
    greetingShownRef.current = true;
    setIsTyping(true);

    const timer = setTimeout(() => {
      if (!onboardingComplete) {
        // First-time user — Guardian guides them through setup conversationally.
        const result = generateGuardianOnboardingGreeting(onboardingInput);
        setOnboardingState(result.state);
        setOnboardingActive(!result.state.isComplete);
        if (result.state.isComplete) {
          localStorage.setItem('deygo_onboarding_complete', 'true');
        }
        setMessages([result.message]);
        memoryRef.current = appendToMemory(memoryRef.current, result.message);
      } else {
        // Returning user — standard greeting.
        const result = generateGuardianGreeting({ context: conversationContext });
        setMessages([result.message]);
        memoryRef.current = appendToMemory(memoryRef.current, result.message);
      }
      setIsTyping(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [open, messages.length, conversationContext, onboardingInput, onboardingComplete]);

  // ─────────────────────────────────────────────────────────────────────
  // Onboarding progression — when the user reopens Guardian after completing
  // a step, Guardian acknowledges it and recommends the next one. If
  // everything is now done, deliver the readiness line + confetti.
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !onboardingActive || messages.length === 0 || isTyping) return;
    if (onboardingGreetingShownRef.current === false) {
      onboardingGreetingShownRef.current = true;
      return; // greeting effect already handled the first message
    }

    const prevState = onboardingState;
    if (!prevState) return;
    const newState = evaluateOnboarding(onboardingInput);

    // Detect what just got completed (if anything).
    let justCompleted: SetupStepId | null = null;
    for (const step of newState.steps) {
      const prev = prevState.steps.find((s) => s.id === step.id);
      if (prev && !prev.complete && step.complete) {
        justCompleted = step.id;
      }
    }

    // Only proceed if something changed.
    if (!justCompleted && newState.completedCount === prevState.completedCount) return;

    setIsTyping(true);
    const timer = setTimeout(() => {
      const result = generateGuardianOnboardingNext(onboardingInput, justCompleted);
      setOnboardingState(result.state);
      setLastCompletedStep(justCompleted);

      if (result.state.isComplete) {
        localStorage.setItem('deygo_onboarding_complete', 'true');
        setOnboardingActive(false);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4500);
      }

      setMessages((prev) => [...prev, result.message]);
      memoryRef.current = appendToMemory(memoryRef.current, result.message);
      setIsTyping(false);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onboardingActive, onboardingInput.profileComplete, onboardingInput.contactsCount, onboardingInput.walletComplete, onboardingInput.notificationPermission, onboardingInput.gpsPermission, onboardingInput.subscriptionActive]);

  // Reset greeting flag + session memory when panel closes
  useEffect(() => {
    if (!open) {
      greetingShownRef.current = false;
      memoryRef.current = createSessionMemory();
    }
  }, [open]);

  // ─────────────────────────────────────────────────────────────────────
  // Auto-scroll to latest message
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
      return () => clearTimeout(t);
    }
  }, [messages, isTyping, open]);

  // ─────────────────────────────────────────────────────────────────────
  // Focus management + Esc to close
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && panelRef.current) {
      const t = setTimeout(() => panelRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    if (!open && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // ─────────────────────────────────────────────────────────────────────
  // Conversation actions
  // ─────────────────────────────────────────────────────────────────────
  const appendUserMessage = (text: string) => {
    const msg: ConversationMessage = {
      id: generateId(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    memoryRef.current = appendToMemory(memoryRef.current, msg);
  };

  // Stream Guardian's reply word-by-word for a natural, ChatGPT-like feel.
  // The full message is committed up front so action buttons render after the
  // text finishes streaming. We progressively reveal the text via a local
  // streaming flag stored on the message.
  const streamGuardianReply = (reply: ConversationMessage) => {
    const words = reply.text.split(' ');
    const id = reply.id;
    setMessages((prev) => [...prev, { ...reply, text: '', streaming: true }]);
    memoryRef.current = appendToMemory(memoryRef.current, { ...reply, streaming: false });
    let i = 0;
    const step = () => {
      i += 1;
      const partial = words.slice(0, i).join(' ');
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: partial } : m)));
      if (i < words.length) {
        setTimeout(step, 28 + Math.random() * 45);
      } else {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, streaming: false } : m)));
        setIsTyping(false);
      }
    };
    step();
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;
    appendUserMessage(trimmed);
    setInput('');
    setIsTyping(true);
    const delay = 500 + Math.min(trimmed.length * 10, 800);
    setTimeout(() => {
      // Single call into the orchestrator — the UI never knows which provider answered.
      const result = generateGuardianReply({
        userMessage: trimmed,
        history: memoryRef.current.messages,
        context: conversationContext,
        currentPage: null,
      });
      streamGuardianReply(result.message);
    }, delay);
  };

  const handleChipPress = (chip: SuggestionChip) => {
    if (isTyping) return;
    appendUserMessage(chip.label);
    setIsTyping(true);
    setTimeout(() => {
      const reply = generateGuardianReplyForChip(chip, conversationContext);
      streamGuardianReply(reply);
    }, 500);
  };

  const handleAction = (href: string) => {
    if (href.startsWith('tel:') || href.startsWith('mailto:')) {
      window.location.href = href;
      return;
    }
    router.push(href);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Guardian urgency dot — tracks safety state
  const urgencyColor =
    confidenceScore !== null
      ? confidenceScore >= 80 ? 'bg-green-400'
      : confidenceScore >= 50 ? 'bg-yellow-400'
      : confidenceScore >= 25 ? 'bg-orange-400'
      : 'bg-red-400'
    : 'bg-green-400';

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <>
      {/* Confetti — only after full onboarding completion */}
      <AnimatePresence>
        {showConfetti && <ConfettiOverlay />}
      </AnimatePresence>

      {/* Floating Button — the single Guardian entry point */}
      <motion.button
        ref={buttonRef}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-safe right-safe z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-110 active:scale-95',
          'bg-gradient-to-br from-primary to-red-700 text-white',
          'ring-2 ring-white/20 hover:ring-white/30',
          'animate-guardian-breathe',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50'
        )}
        aria-label="Open Guardian Assistant"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Shield className="h-6 w-6" />
        <span className={cn('absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-navy', urgencyColor)} />
        {!open && (
          <span className={cn('pointer-events-none absolute inset-0 rounded-full ring-2', urgencyColor.replace('bg-', 'ring-'), 'animate-ring-pulse')} />
        )}
      </motion.button>

      {/* Conversational Panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Guardian Assistant"
              tabIndex={-1}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-navy-light shadow-2xl',
                'pb-safe focus-visible:outline-none'
              )}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3">
                <div className="h-1.5 w-12 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-red-700 text-white guardian-sheen">
                  <Shield className="h-5 w-5" />
                  <span className={cn('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-navy-light', urgencyColor)} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-foreground">Guardian</h2>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('h-1.5 w-1.5 rounded-full', urgencyColor, 'animate-pulse')} />
                    {isTyping ? 'Typing…' : 'Here to help'}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-white/5 p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label="Close Guardian Assistant"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Conversation area */}
              <div className="flex-1 overflow-y-auto px-5 pb-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      onAction={handleAction}
                    />
                  ))}

                  {/* Typing indicator */}
                  <AnimatePresence>
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-end gap-2"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-red-700 text-white">
                          <Shield className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white/10 px-4 py-3">
                          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
                          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
                          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Suggestion chips — shown after greeting, hidden while typing */}
                  {messages.length > 0 && !isTyping && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {chips.map((chip) => (
                        <button
                          key={chip.id}
                          onClick={() => handleChipPress(chip)}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                            chip.variant === 'primary' && 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20',
                            chip.variant === 'danger' && 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20',
                            chip.variant === 'warning' && 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
                            chip.variant === 'default' && 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                          )}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Collapsible Safety Details */}
                  <div className="pt-2">
                    <GuardianSafetyDetails
                      confidenceScore={confidenceScore}
                      activeJourney={activeJourney}
                      monitorState={monitorState}
                      displayState={displayState}
                      recommendation={recommendation}
                      currentLocation={null}
                      online={online}
                      gpsActive={gpsActive}
                      gpsPermission={gpsPermission}
                      batteryLevel={batteryLevel}
                      batteryCharging={batteryCharging}
                      walletComplete={walletComplete}
                      contactsCount={contacts.length}
                      profileComplete={profileComplete}
                      unreadNotifications={unreadNotifications}
                    />
                  </div>

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input bar */}
              <div className="border-t border-white/5 bg-navy-light/80 px-4 py-3">
                <div className="flex items-end gap-2">
                  <div className="flex flex-1 items-end rounded-2xl border border-white/10 bg-white/5 px-3 py-2 focus-within:border-primary/40">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask Guardian anything..."
                      rows={1}
                      className="max-h-24 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                      aria-label="Message Guardian"
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-red-700 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                  <button
                    disabled
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30"
                    aria-label="Voice mode (coming soon)"
                    title="Voice mode — coming soon"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/50">
                  <Sparkles className="h-3 w-3" />
                  Guardian observes, explains, and recommends. You decide.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────────────────────

const TONE_BUBBLE: Record<string, string> = {
  safe: 'bg-white/10',
  caution: 'bg-yellow-500/10 border border-yellow-500/20',
  warning: 'bg-orange-500/10 border border-orange-500/20',
  danger: 'bg-red-500/10 border border-red-500/20',
};

const TONE_TEXT: Record<string, string> = {
  safe: 'text-foreground',
  caution: 'text-foreground',
  warning: 'text-foreground',
  danger: 'text-foreground',
};

function MessageBubble({
  message,
  onAction,
}: {
  message: ConversationMessage;
  onAction: (href: string) => void;
}) {
  const isGuardian = message.role === 'guardian';
  const tone = message.tone || 'safe';

  if (!isGuardian) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {message.text}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-end gap-2"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-red-700 text-white">
        <Shield className="h-3.5 w-3.5" />
      </div>
      <div className="max-w-[80%]">
        <div className={cn('rounded-2xl rounded-bl-md px-4 py-2.5 text-sm', TONE_BUBBLE[tone], TONE_TEXT[tone])}>
          <p className="leading-relaxed">
            {message.text}
            {message.streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary/70 align-middle" />}
          </p>
          {!message.streaming && message.subtext && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{message.subtext}</p>
          )}
        </div>
        {!message.streaming && message.actionLabel && message.actionHref && (
          <button
            onClick={() => onAction(message.actionHref!)}
            className="mt-2 flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {message.actionLabel}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confetti — only after full onboarding completion
// ─────────────────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#a855f7'];

function ConfettiOverlay() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        duration: 1.6 + Math.random() * 1.2,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-none fixed inset-0 z-[100]"
    >
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: '100vh', opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </motion.div>
  );
}
