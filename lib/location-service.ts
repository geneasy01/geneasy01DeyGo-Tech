import type {
  LocationReading,
  LocationError,
  LocationErrorCode,
  LocationTrackingState,
  LocationPermissionState,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Location Service
// ─────────────────────────────────────────────────────────────────────────────
// A reusable, framework-agnostic browser geolocation service. Used by:
//   - Journey Guard (continuous tracking)
//   - SOS (one-shot location capture)
//   - Guardian AI (movement detection)
//   - Live Dispatch (real-time coordinates)
//
// Usage:
//   const service = new LocationService();
//   await service.startTracking({ enableHighAccuracy: true, intervalMs: 5000 });
//   service.onReading((reading) => { ... });
//   service.onError((err) => { ... });
//   service.stopTracking();
//
// The service does NOT depend on Supabase or React. Callers decide what to do
// with the readings — store them, display them, or feed them to Guardian AI.

export type LocationReadingHandler = (reading: LocationReading) => void;
export type LocationErrorHandler = (error: LocationError) => void;
export type LocationStateHandler = (state: LocationTrackingState) => void;

export interface StartTrackingOptions {
  enableHighAccuracy?: boolean;
  intervalMs?: number;
  maxAge?: number;
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<StartTrackingOptions> = {
  enableHighAccuracy: true,
  intervalMs: 5000,
  maxAge: 10000,
  timeout: 10000,
};

export class LocationService {
  private watchId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private state: LocationTrackingState = 'idle';
  private readings: LocationReading[] = [];
  private maxReadings: number = 500;
  private lastReading: LocationReading | null = null;

  private readingHandlers = new Set<LocationReadingHandler>();
  private errorHandlers = new Set<LocationErrorHandler>();
  private stateHandlers = new Set<LocationStateHandler>();

  private options: Required<StartTrackingOptions> = DEFAULT_OPTIONS;

  // ─────────────────────────────────────────────────────────────────────
  // Static helpers
  // ─────────────────────────────────────────────────────────────────────

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  static async checkPermission(): Promise<LocationPermissionState> {
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
      return LocationService.isSupported() ? 'prompt' : 'unsupported';
    }
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state as LocationPermissionState;
    } catch {
      return 'prompt';
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // State management
    // ─────────────────────────────────────────────────────────────────────

  getState(): LocationTrackingState {
    return this.state;
  }

  getLastReading(): LocationReading | null {
    return this.lastReading;
  }

  getReadings(): LocationReading[] {
    return [...this.readings];
  }

  private setState(newState: LocationTrackingState) {
    if (this.state === newState) return;
    this.state = newState;
    this.stateHandlers.forEach((h) => h(newState));
  }

  // ─────────────────────────────────────────────────────────────────────
  // Event subscription
  // ─────────────────────────────────────────────────────────────────────

  onReading(handler: LocationReadingHandler): () => void {
    this.readingHandlers.add(handler);
    return () => this.readingHandlers.delete(handler);
  }

  onError(handler: LocationErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  onStateChange(handler: LocationStateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  // ─────────────────────────────────────────────────────────────────────
  // One-shot location capture
  // ─────────────────────────────────────────────────────────────────────

  getCurrentPosition(): Promise<LocationReading> {
    return new Promise((resolve, reject) => {
      if (!LocationService.isSupported()) {
        const err: LocationError = {
          code: 'unsupported',
          message: 'Geolocation is not supported by this browser.',
        };
        this.errorHandlers.forEach((h) => h(err));
        reject(err);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const reading = this.toReading(pos);
          this.lastReading = reading;
          this.readings.push(reading);
          this.trimReadings();
          this.readingHandlers.forEach((h) => h(reading));
          resolve(reading);
        },
        (geoErr) => {
          const err = this.toError(geoErr);
          this.errorHandlers.forEach((h) => h(err));
          reject(err);
        },
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          maximumAge: this.options.maxAge,
          timeout: this.options.timeout,
        }
      );
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Continuous tracking
  // ─────────────────────────────────────────────────────────────────────

  async startTracking(opts?: StartTrackingOptions): Promise<void> {
    if (!LocationService.isSupported()) {
      const err: LocationError = {
        code: 'unsupported',
        message: 'Geolocation is not supported by this browser.',
      };
      this.errorHandlers.forEach((h) => h(err));
      this.setState('error');
      throw err;
    }

    this.options = { ...DEFAULT_OPTIONS, ...opts };
    this.readings = [];
    this.stopTracking();

    this.setState('tracking');

    // Use watchPosition for high-accuracy real-time updates
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const reading = this.toReading(pos);
        this.lastReading = reading;
        this.readings.push(reading);
        this.trimReadings();
        this.readingHandlers.forEach((h) => h(reading));
      },
      (geoErr) => {
        const err = this.toError(geoErr);
        this.errorHandlers.forEach((h) => h(err));
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          this.setState('error');
        }
      },
      {
        enableHighAccuracy: this.options.enableHighAccuracy,
        maximumAge: this.options.maxAge,
        timeout: this.options.timeout,
      }
    );

    // Fallback interval — if watchPosition stalls (common on mobile), poll
    this.intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const reading = this.toReading(pos);
          // Only emit if this reading is newer than the last one
          if (!this.lastReading || reading.timestamp > this.lastReading.timestamp) {
            this.lastReading = reading;
            this.readings.push(reading);
            this.trimReadings();
            this.readingHandlers.forEach((h) => h(reading));
          }
        },
        (geoErr) => {
          // Silently ignore interval errors — watchPosition handler covers fatal ones
          if (geoErr.code === geoErr.PERMISSION_DENIED && this.state === 'tracking') {
            const err = this.toError(geoErr);
            this.errorHandlers.forEach((h) => h(err));
            this.setState('error');
          }
        },
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          maximumAge: this.options.maxAge,
          timeout: this.options.timeout,
        }
      );
    }, this.options.intervalMs);
  }

  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.state === 'tracking' || this.state === 'error') {
      this.setState('stopped');
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Movement detection
  // ─────────────────────────────────────────────────────────────────────

  // Haversine distance in meters between two coordinates
  static distanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Time since last meaningful movement (meters threshold), in milliseconds
  timeSinceLastMovement(thresholdMeters = 10): number | null {
    if (this.readings.length < 2) return null;
    for (let i = this.readings.length - 1; i > 0; i--) {
      const prev = this.readings[i - 1];
      const curr = this.readings[i];
      const dist = LocationService.distanceMeters(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
      if (dist >= thresholdMeters) {
        return Date.now() - curr.timestamp;
      }
    }
    return Date.now() - this.readings[0].timestamp;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Signal quality
  // ─────────────────────────────────────────────────────────────────────

  // Accuracy in meters — lower is better. Returns null if no readings.
  getAccuracy(): number | null {
    return this.lastReading?.accuracy ?? null;
  }

  // Qualitative signal quality label based on accuracy
  getSignalQuality(): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' {
    const acc = this.getAccuracy();
    if (acc === null) return 'unknown';
    if (acc <= 10) return 'excellent';
    if (acc <= 30) return 'good';
    if (acc <= 75) return 'fair';
    return 'poor';
  }

  // ─────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────

  destroy(): void {
    this.stopTracking();
    this.readingHandlers.clear();
    this.errorHandlers.clear();
    this.stateHandlers.clear();
    this.readings = [];
    this.lastReading = null;
    this.setState('idle');
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────

  private toReading(pos: GeolocationPosition): LocationReading {
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
    };
  }

  private toError(geoErr: GeolocationPositionError): LocationError {
    let code: LocationErrorCode;
    switch (geoErr.code) {
      case geoErr.PERMISSION_DENIED:
        code = 'permission_denied';
        break;
      case geoErr.POSITION_UNAVAILABLE:
        code = 'position_unavailable';
        break;
      case geoErr.TIMEOUT:
        code = 'timeout';
        break;
      default:
        code = 'position_unavailable';
    }
    return { code, message: geoErr.message };
  }

  private trimReadings(): void {
    if (this.readings.length > this.maxReadings) {
      this.readings = this.readings.slice(-this.maxReadings);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton accessor (optional — callers can also create their own instance)
// ─────────────────────────────────────────────────────────────────────────────

let _singleton: LocationService | null = null;

export function getLocationService(): LocationService {
  if (!_singleton) {
    _singleton = new LocationService();
  }
  return _singleton;
}
