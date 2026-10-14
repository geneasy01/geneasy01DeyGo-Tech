'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Siren,
  Navigation,
  Shield,
  Info,
  CheckCheck,
  Trash2,
  CheckCircle2,
  Loader2,
  BellOff,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { NotificationRecord, NotificationType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const typeConfig: Record<
  NotificationType,
  { icon: typeof Siren; color: string; bg: string; label: string }
> = {
  sos: { icon: Siren, color: 'text-red-400', bg: 'bg-red-500/10', label: 'SOS' },
  journey: { icon: Navigation, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Journey' },
  security: { icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Security' },
  system: { icon: Info, color: 'text-green-400', bg: 'bg-green-500/10', label: 'System' },
};

type FilterType = 'all' | NotificationType;

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const [notifRes, countRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false),
    ]);
    setNotifications((notifRes.data || []) as NotificationRecord[]);
    setUnreadCount(countRes.count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === id);
      if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => n.id !== id);
    });
  };

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter((n) => n.type === filter);

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sos', label: 'SOS' },
    { key: 'journey', label: 'Journey' },
    { key: 'security', label: 'Security' },
    { key: 'system', label: 'System' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your in-app notification center for all DEYGO alerts and updates.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="glass text-xs"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Unread summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass-strong rounded-2xl border-white/10">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-foreground">{unreadCount}</div>
              <div className="text-xs text-muted-foreground">
                {unreadCount === 0 ? 'All caught up' : 'unread notification' + (unreadCount !== 1 ? 's' : '')}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              filter === tab.key
                ? 'bg-primary text-white'
                : 'glass text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass-card rounded-2xl border-white/5">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <BellOff className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              {filter === 'all'
                ? 'No notifications yet. You will see SOS events, journey updates, security alerts, and system announcements here.'
                : `No ${filter} notifications.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((notification, i) => {
              const config = typeConfig[notification.type];
              return (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                >
                  <Card
                    className={`rounded-2xl border-white/5 transition-all hover:border-white/10 ${
                      notification.read ? 'glass-card' : 'glass-strong border-white/10'
                    }`}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bg}`}>
                        <config.icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        {notification.body && (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {notification.body}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="rounded-full bg-white/5 px-2 py-0.5 font-medium">
                            {config.label}
                          </span>
                          <span>
                            {new Date(notification.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkRead(notification.id)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                            title="Mark as read"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
