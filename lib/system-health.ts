import { LocationService } from './location-service';
import type { SystemHealthSnapshot, LocationPermissionState } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// System Health Monitoring
// ─────────────────────────────────────────────────────────────────────────────
// Reusable utilities for checking device capabilities and environmental state.
// Used by Guardian AI to decide whether it can rely on GPS, network, etc.
//
// All checks are safe to call on the server (SSR) — they return sensible
// defaults when browser APIs are not available.

export function isOnline(): boolean {
  if (typeof navigator === 'undefined' || navigator.onLine === undefined) return true;
  return navigator.onLine;
}

export function isGpsAvailable(): boolean {
  return LocationService.isSupported();
}

export async function getGpsPermission(): Promise<LocationPermissionState> {
  return LocationService.checkPermission();
}

// ─────────────────────────────────────────────────────────────────────────────
// Battery API (where available — Chrome/Edge only, not Safari/Firefox)
// ─────────────────────────────────────────────────────────────────────────────

interface BatteryManagerLike {
  level: number;
  charging: boolean;
  addEventListener(event: string, handler: () => void): void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
}

export async function getBatteryState(): Promise<{
  level: number | null;
  charging: boolean | null;
}> {
  if (typeof navigator === 'undefined') return { level: null, charging: null };
  const nav = navigator as NavigatorWithBattery;
  if (typeof nav.getBattery !== 'function') {
    return { level: null, charging: null };
  }
  try {
    const battery = await nav.getBattery();
    return { level: battery.level, charging: battery.charging };
  } catch {
    return { level: null, charging: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Background tracking capability
// ─────────────────────────────────────────────────────────────────────────────
// True if the device can track location while the app is backgrounded.
// In a PWA context, this requires the Wake Lock API or a service worker.
// We check for the presence of the relevant APIs — actual capability depends
// on browser permissions and user settings.

export function isBackgroundTrackingCapable(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Service Worker support (for background sync)
  const hasSW = 'serviceWorker' in navigator;
  // Wake Lock support (to keep the device awake)
  const hasWakeLock = 'wakeLock' in navigator;
  // Geolocation support
  const hasGeo = 'geolocation' in navigator;
  return hasSW && hasGeo && hasWakeLock;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full snapshot
// ─────────────────────────────────────────────────────────────────────────────

export async function getSystemHealth(): Promise<SystemHealthSnapshot> {
  const [gpsPermission, battery] = await Promise.all([
    getGpsPermission(),
    getBatteryState(),
  ]);

  return {
    gpsAvailable: isGpsAvailable(),
    gpsPermission,
    online: isOnline(),
    batteryLevel: battery.level,
    batteryCharging: battery.charging,
    backgroundTrackingCapable: isBackgroundTrackingCapable(),
    timestamp: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Online/offline event subscription
// ─────────────────────────────────────────────────────────────────────────────

export function onOnlineStateChange(
  handler: (online: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => handler(true);
  const onOffline = () => handler(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Battery change subscription (where supported)
// ─────────────────────────────────────────────────────────────────────────────

export function onBatteryChange(
  handler: (level: number, charging: boolean) => void
): () => void {
  if (typeof navigator === 'undefined') return () => {};
  const nav = navigator as NavigatorWithBattery;
  if (typeof nav.getBattery !== 'function') return () => {};

  let battery: BatteryManagerLike | null = null;
  const cleanup = () => {
    if (battery) {
      // No standard removeEventListener for BatteryManager in all browsers,
      // but the object supports it via EventTarget.
    }
  };

  nav.getBattery().then((b) => {
    battery = b;
    handler(b.level, b.charging);
    const update = () => handler(b.level, b.charging);
    b.addEventListener('levelchange', update);
    b.addEventListener('chargingchange', update);
  }).catch(() => {});

  return cleanup;
}
