'use client';

import { supabase } from './supabase';
import type { DevicePlatform } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// FCM Client-Side Integration
// ─────────────────────────────────────────────────────────────────────────────
// Handles device registration token acquisition and persistence.
// The actual push notification sending happens server-side via an edge function
// that uses the FCM HTTP v1 API with a service account.
//
// Graceful fallback: if Firebase is unavailable or not configured, the app
// continues to work with in-app notifications only. No crash, no hang.

const FCM_CONFIGured = !!(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID
);

// Lazy-load Firebase only when needed and only if configured
let firebaseApp: unknown = null;
let messagingInstance: unknown = null;

async function loadFirebaseMessaging(): Promise<{
  getToken: (messaging: unknown, options?: unknown) => Promise<string>;
  onMessage: (messaging: unknown, callback: (payload: unknown) => void) => () => void;
  messaging: unknown;
  app: unknown;
} | null> {
  if (!FCM_CONFIGured) return null;

  if (messagingInstance) {
    const { getToken, onMessage } = await import('firebase/messaging');
    return {
      getToken: getToken as (messaging: unknown, options?: unknown) => Promise<string>,
      onMessage: onMessage as unknown as (messaging: unknown, callback: (payload: unknown) => void) => () => void,
      messaging: messagingInstance,
      app: firebaseApp,
    };
  }

  try {
    const { initializeApp } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    firebaseApp = app;
    messagingInstance = messaging;

    return {
      getToken: getToken as (messaging: unknown, options?: unknown) => Promise<string>,
      onMessage: onMessage as unknown as (messaging: unknown, callback: (payload: unknown) => void) => () => void,
      messaging,
      app,
    };
  } catch (err) {
    console.error('[FCM] Failed to load Firebase messaging:', err);
    return null;
  }
}

export function isFCMAvailable(): boolean {
  return FCM_CONFIGured;
}

// ─────────────────────────────────────────────────────────────────────────────
// Register device token
// ─────────────────────────────────────────────────────────────────────────────

export async function registerDeviceForPush(
  userId: string,
  platform: DevicePlatform = 'web'
): Promise<{ success: boolean; token: string | null; error?: string }> {
  // If FCM isn't configured, return gracefully — in-app notifications still work
  if (!FCM_CONFIGured) {
    return { success: false, token: null, error: 'FCM not configured' };
  }

  const fb = await loadFirebaseMessaging();
  if (!fb) {
    return { success: false, token: null, error: 'Failed to initialize Firebase messaging' };
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, token: null, error: 'Notification permission denied' };
    }

    // Get the FCM registration token
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const token = await fb.getToken(fb.messaging, { vapidKey });

    if (!token) {
      return { success: false, token: null, error: 'No registration token available' };
    }

    // Save the token to the database (upsert — handles re-registration)
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        { user_id: userId, token, platform, is_active: true },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      console.error('[FCM] Failed to save device token:', error.message);
      return { success: false, token, error: error.message };
    }

    return { success: true, token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[FCM] Device registration failed:', msg);
    return { success: false, token: null, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unregister device token (on logout or user request)
// ─────────────────────────────────────────────────────────────────────────────

export async function unregisterDeviceForPush(
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('device_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Listen for foreground push messages
// ─────────────────────────────────────────────────────────────────────────────

export function onPushMessage(callback: (payload: unknown) => void): () => void {
  if (!FCM_CONFIGured) return () => {};

  loadFirebaseMessaging().then((fb) => {
    if (fb) {
      fb.onMessage(fb.messaging, callback);
    }
  }).catch(() => {});

  return () => {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Get active tokens for a user (used by edge function via service role)
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveDeviceTokens(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !data) {
    console.error('[FCM] Failed to fetch device tokens:', error?.message);
    return [];
  }

  return data.map((row: { token: string }) => row.token);
}
