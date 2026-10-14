'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Siren,
  Wallet,
  Shield,
  Users,
  X,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmergencyMenuItem {
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
  bg: string;
}

const MENU_ITEMS: EmergencyMenuItem[] = [
  { label: 'SOS', icon: Siren, href: '/dashboard/sos', color: 'text-red-400', bg: 'bg-red-500/10' },
  { label: 'Emergency Wallet', icon: Wallet, href: '/dashboard/wallet', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { label: 'Guardian', icon: Shield, href: '/dashboard/journey', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { label: 'Emergency Contacts', icon: Users, href: '/dashboard/contacts', color: 'text-green-400', bg: 'bg-green-500/10' },
];

const LONG_PRESS_MS = 600;

export function EmergencyButton() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [longPressActive, setLongPressActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressedRef = useRef(false);

  const clearPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    pressTimerRef.current = null;
    progressRef.current = null;
    setLongPressActive(false);
    setProgress(0);
  };

  const handlePressStart = (e: React.PointerEvent) => {
    e.preventDefault();
    longPressedRef.current = false;
    setLongPressActive(true);

    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / LONG_PRESS_MS) * 100);
      setProgress(pct);
    }, 16);

    pressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      clearPress();
      router.push('/dashboard/sos');
    }, LONG_PRESS_MS);
  };

  const handlePressEnd = () => {
    if (longPressedRef.current) return;
    clearPress();
    if (!longPressActive) return;
    setMenuOpen((p) => !p);
  };

  useEffect(() => {
    return () => clearPress();
  }, []);

  const handleNavigate = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Floating Emergency Button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.4 }}
        className="fixed bottom-6 left-6 z-50"
      >
        <button
          onPointerDown={handlePressStart}
          onPointerUp={handlePressEnd}
          onPointerLeave={clearPress}
          className={cn(
            'relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95',
            'bg-gradient-to-br from-red-600 to-red-800 text-white',
            'ring-2 ring-red-500/30 hover:ring-red-500/50',
            longPressActive && 'scale-110'
          )}
          aria-label="Emergency menu — long press for SOS"
        >
          {longPressActive ? (
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <motion.circle
                cx="28"
                cy="28"
                r="26"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeDasharray={2 * Math.PI * 26}
                strokeDashoffset={2 * Math.PI * 26 * (1 - progress / 100)}
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <Siren className="h-6 w-6" />
          )}

          {longPressActive && progress > 0 && (
            <span className="absolute text-xs font-bold text-white">
              {Math.ceil((LONG_PRESS_MS * (1 - progress / 100)) / 1000)}
            </span>
          )}
        </button>

        {/* Hint tooltip */}
        {!menuOpen && !longPressActive && (
          <motion.div
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.3 }}
            className="pointer-events-none absolute left-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-navy-light px-2.5 py-1.5 text-xs text-muted-foreground shadow-lg ring-1 ring-white/10"
          >
            Tap for menu · Hold for SOS
          </motion.div>
        )}
      </motion.div>

      {/* Emergency Menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-navy-light shadow-2xl"
            >
              <div className="flex justify-center pt-3">
                <div className="h-1.5 w-12 rounded-full bg-white/20" />
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="absolute right-4 top-4 rounded-full bg-white/5 p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="p-6 pt-4">
                <div className="mb-4 flex items-center gap-2">
                  <Siren className="h-5 w-5 text-red-400" />
                  <h2 className="text-lg font-bold text-foreground">Emergency</h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {MENU_ITEMS.map((item, i) => (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      onClick={() => handleNavigate(item.href)}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 text-center transition-all hover:border-white/10 hover:bg-white/10 active:scale-95"
                    >
                      <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', item.bg)}>
                        <item.icon className={cn('h-6 w-6', item.color)} />
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Long press hint */}
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-red-500/5 px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="flex h-2 w-2 rounded-full bg-red-400" />
                  Long press the emergency button for immediate SOS countdown
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
