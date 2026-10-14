'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Siren,
  Navigation,
  Shield,
  Info,
  CheckCircle2,
  X,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { NotificationRecord, NotificationType } from '@/lib/types';
import { cn } from '@/lib/utils';

const typeConfig: Record<NotificationType, { icon: LucideIcon; color: string; bg: string }> = {
  sos: { icon: Siren, color: 'text-red-400', bg: 'bg-red-500/10' },
  journey: { icon: Navigation, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  security: { icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  system: { icon: Info, color: 'text-green-400', bg: 'bg-green-500/10' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Fetch unread count
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      if (!cancelled) setUnreadCount(count ?? 0);
    };

    fetchCount();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('notification-bell')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fetch recent notifications when popover opens
  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecent((data || []) as NotificationRecord[]);
      setLoading(false);
    })();
  }, [open, user]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setRecent((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const openNotificationCenter = () => {
    setOpen(false);
    router.push('/dashboard/notifications');
  };

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => setOpen((p) => !p)}
        className={cn(
          'relative flex h-10 w-10 items-center justify-center rounded-xl transition-all',
          'glass border border-white/5 hover:border-white/10 hover:bg-white/10 active:scale-95',
          open && 'border-white/10 bg-white/10'
        )}
        aria-label="Notifications"
      >
        <Bell className={cn('h-4.5 w-4.5', unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground')} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-navy"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-navy-light shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : recent.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">All caught up</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/60">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {recent.map((notif) => {
                    const config = typeConfig[notif.type];
                    return (
                      <button
                        key={notif.id}
                        onClick={() => !notif.read && markAsRead(notif.id)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5',
                          !notif.read && 'bg-primary/5'
                        )}
                      >
                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', config.bg)}>
                          <config.icon className={cn('h-4 w-4', config.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {notif.title}
                            </span>
                            {!notif.read && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          {notif.body && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {notif.body}
                            </p>
                          )}
                          <span className="mt-0.5 text-xs text-muted-foreground/60">
                            {timeAgo(notif.created_at)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <button
              onClick={openNotificationCenter}
              className="flex w-full items-center justify-center gap-1 border-t border-white/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
            >
              Open Notification Center
              <ChevronRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
