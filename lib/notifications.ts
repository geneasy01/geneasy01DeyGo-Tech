import { supabase } from './supabase';
import type { NotificationSettings, NotificationType } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Provider Interfaces
// ─────────────────────────────────────────────────────────────────────────────
// Each channel implements a send() method. The providers are placeholders that
// log to console. When real integrations are added, only the provider bodies
// change — all call sites remain the same.

export interface PushProvider {
  send(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void>;
}

export interface SMSProvider {
  send(phone: string, message: string): Promise<void>;
}

export interface EmailProvider {
  send(email: string, subject: string, body: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder Providers
// ─────────────────────────────────────────────────────────────────────────────

export const fcmProvider: PushProvider = {
  async send(userId, title, body, data) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.warn('[FCM] Supabase URL or key not configured — push skipped');
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ userId, title, body, data }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown');
        console.error(`[FCM] Push send failed (${response.status}):`, errText);
      }
    } catch (err) {
      // Graceful fallback — in-app notification already created by dispatchNotification
      console.error('[FCM] Push delivery failed (network error):', err);
    }
  },
};

export const termiiProvider: SMSProvider = {
  async send(phone, message) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.warn('[Termii] Supabase not configured — SMS skipped');
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ phone, message }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown');
        console.error(`[Termii] SMS send failed (${response.status}):`, errText);
      }
    } catch (err) {
      console.error('[Termii] SMS delivery failed (network error):', err);
    }
  },
};

export const emailProvider: EmailProvider = {
  async send(email, subject, body) {
    // TODO: Integrate email service (e.g., Resend, SendGrid, Supabase Auth email)
    // When ready, replace this body with the provider's SDK call.
    console.log('[Email Placeholder]', { email, subject, body });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Notification Category → Settings Flag Mapping
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_TO_FLAG: Record<NotificationType, keyof NotificationSettings> = {
  sos: 'sos_alerts',
  journey: 'journey_alerts',
  security: 'sos_alerts',
  system: 'marketing_notifications',
};

// ─────────────────────────────────────────────────────────────────────────────
// Settings Helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function getNotificationSettings(
  userId: string
): Promise<NotificationSettings | null> {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch notification settings:', error.message);
    return null;
  }
  return data as NotificationSettings | null;
}

export async function ensureNotificationSettings(
  userId: string
): Promise<NotificationSettings> {
  const existing = await getNotificationSettings(userId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('notification_settings')
    .insert({ user_id: userId })
    .select()
    .single();

  if (error) {
    console.error('Failed to create notification settings:', error.message);
    // Return sensible defaults so callers can proceed
    return {
      id: '',
      user_id: userId,
      sos_alerts: true,
      journey_alerts: true,
      emergency_contact_notifications: true,
      email_notifications: true,
      push_notifications: true,
      marketing_notifications: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return data as NotificationSettings;
}

export async function updateNotificationSettings(
  userId: string,
  updates: Partial<Pick<
    NotificationSettings,
    | 'sos_alerts'
    | 'journey_alerts'
    | 'emergency_contact_notifications'
    | 'email_notifications'
    | 'push_notifications'
    | 'marketing_notifications'
  >>
): Promise<NotificationSettings | null> {
  await ensureNotificationSettings(userId);

  const { data, error } = await supabase
    .from('notification_settings')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update notification settings:', error.message);
    return null;
  }
  return data as NotificationSettings;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-App Notification Helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function createInAppNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  data?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
    data: data ?? {},
  });

  if (error) {
    console.error('Failed to create in-app notification:', error.message);
  }
}

export async function getNotifications(
  userId: string,
  limit = 50
): Promise<import('./types').NotificationRecord[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch notifications:', error.message);
    return [];
  }
  return (data || []) as import('./types').NotificationRecord[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('Failed to fetch unread count:', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) console.error('Failed to mark notification as read:', error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) console.error('Failed to mark all notifications as read:', error.message);
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) console.error('Failed to delete notification:', error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dispatch Function
// ─────────────────────────────────────────────────────────────────────────────
// This is the single entry point that other modules call. It:
//   1. Checks the user's notification settings
//   2. Delivers via enabled channels (in-app always, push/email if enabled)
//   3. Respects category-level opt-outs
//
// Usage from any module:
//   import { dispatchNotification } from '@/lib/notifications';
//   await dispatchNotification({
//     userId: user.id,
//     type: 'sos',
//     title: 'SOS Triggered',
//     body: 'Emergency signal sent from your location',
//     data: { sosId: alert.id, lat: alert.latitude, lng: alert.longitude },
//   });

export interface DispatchParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  userEmail?: string;
}

export async function dispatchNotification(params: DispatchParams): Promise<void> {
  const { userId, type, title, body, data, userEmail } = params;

  // 1. Always create the in-app notification (the feed is the source of truth)
  await createInAppNotification(userId, type, title, body, data);

  // 2. Load settings to decide which external channels to use
  const settings = await getNotificationSettings(userId);

  // If no settings row exists yet, in-app only (settings will be created
  // when the user visits the settings page)
  if (!settings) return;

  // 3. Check category-level opt-out
  const flag = CATEGORY_TO_FLAG[type];
  if (flag && !settings[flag]) return;

  // 4. Push notification via FCM (if enabled)
  if (settings.push_notifications) {
    await fcmProvider.send(userId, title, body ?? '', data);
  }

  // 5. Email notification (if enabled and email provided)
  if (settings.email_notifications && userEmail) {
    await emailProvider.send(userEmail, title, body ?? '');
  }
}
