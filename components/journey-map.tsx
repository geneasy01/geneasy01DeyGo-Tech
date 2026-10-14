'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import type { LocationReading } from '@/lib/types';
import type { JourneyDisplayState } from '@/lib/guardian';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Journey Map Component
// ─────────────────────────────────────────────────────────────────────────────
// Replaces the placeholder map with a real Google Maps integration.
// Uses the Google Maps JavaScript API loaded via the official loader.
// Falls back to a styled placeholder if the API key is not configured.
//
// Displays:
//   - Current location (live blue dot)
//   - Destination (red pin)
//   - Origin (green pin)
//   - Live route line
//   - ETA overlay
//   - Guardian monitoring state badge

interface JourneyMapProps {
  origin: string;
  destination: string;
  currentLocation: LocationReading | null;
  displayState: JourneyDisplayState;
  etaLabel?: string;
  confidenceScore?: number | null;
  className?: string;
}

type MapState = 'loading' | 'ready' | 'error' | 'unconfigured';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function JourneyMap({
  origin,
  destination,
  currentLocation,
  displayState,
  etaLabel,
  confidenceScore,
  className,
}: JourneyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<{
    origin?: google.maps.Marker;
    destination?: google.maps.Marker;
    current?: google.maps.Marker;
    route?: google.maps.Polyline;
  }>({});
  const [mapState, setMapState] = useState<MapState>(
    GOOGLE_MAPS_API_KEY ? 'loading' : 'unconfigured'
  );

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapState('unconfigured');
      return;
    }

    if (typeof google !== 'undefined' && google.maps) {
      setMapState('ready');
      return;
    }

    const scriptId = 'google-maps-script';
    if (document.getElementById(scriptId)) {
      // Script already loading — wait for it
      const checkInterval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          clearInterval(checkInterval);
          setMapState('ready');
        }
      }, 200);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapState('ready');
    script.onerror = () => setMapState('error');
    document.head.appendChild(script);

    return () => {
      // Don't remove the script — it may be used by other instances
    };
  }, []);

  // Initialize map when ready
  useEffect(() => {
    if (mapState !== 'ready' || !mapRef.current) return;
    if (googleMapRef.current) return; // Already initialized

    try {
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        zoom: 14,
        center: currentLocation
          ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
          : { lat: 9.082, lng: 8.6753 }, // Default: Nigeria center
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: DARK_MAP_STYLE,
      });
    } catch {
      setMapState('error');
    }
  }, [mapState, currentLocation]);

  // Update current location marker
  useEffect(() => {
    if (mapState !== 'ready' || !googleMapRef.current || !currentLocation) return;

    const map = googleMapRef.current;
    const pos = { lat: currentLocation.latitude, lng: currentLocation.longitude };

    // Update or create current location marker
    if (markersRef.current.current) {
      markersRef.current.current.setPosition(pos);
    } else {
      markersRef.current.current = new google.maps.Marker({
        position: pos,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Your location',
      });
    }

    // Center map on current location
    map.panTo(pos);
  }, [mapState, currentLocation]);

  // Update destination marker (geocode the destination string)
  useEffect(() => {
    if (mapState !== 'ready' || !googleMapRef.current || !destination) return;

    const map = googleMapRef.current;
    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ address: destination }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const destPos = results[0].geometry.location;

        if (markersRef.current.destination) {
          markersRef.current.destination.setPosition(destPos);
        } else {
          markersRef.current.destination = new google.maps.Marker({
            position: destPos,
            map,
            label: { text: 'B', color: '#ffffff', fontSize: '12px', fontWeight: 'bold' },
            title: `Destination: ${destination}`,
          });
        }

        // Draw route if we have current location
        if (currentLocation) {
          drawRoute(
            map,
            { lat: currentLocation.latitude, lng: currentLocation.longitude },
            { lat: destPos.lat(), lng: destPos.lng() }
          );
        }
      }
    });
  }, [mapState, destination, currentLocation]);

  // Update origin marker (geocode the origin string)
  useEffect(() => {
    if (mapState !== 'ready' || !googleMapRef.current || !origin) return;

    const map = googleMapRef.current;
    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ address: origin }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const originPos = results[0].geometry.location;

        if (markersRef.current.origin) {
          markersRef.current.origin.setPosition(originPos);
        } else {
          markersRef.current.origin = new google.maps.Marker({
            position: originPos,
            map,
            label: { text: 'A', color: '#ffffff', fontSize: '12px', fontWeight: 'bold' },
            title: `Origin: ${origin}`,
          });
        }
      }
    });
  }, [mapState, origin]);

  // Draw/update route line
  function drawRoute(
    map: google.maps.Map,
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ) {
    if (markersRef.current.route) {
      markersRef.current.route.setMap(null);
    }

    markersRef.current.route = new google.maps.Polyline({
      path: [from, to],
      map,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.6,
      strokeWeight: 4,
      geodesic: true,
    });
  }

  // ── Unconfigured fallback ──
  if (mapState === 'unconfigured') {
    return (
      <div className={cn(
        'relative h-64 overflow-hidden rounded-2xl border border-white/5 bg-navy-light',
        className
      )}>
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Navigation className="mx-auto h-12 w-12 text-blue-400/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              Live Map
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-400 ring-4 ring-green-400/20" />
              <span className="text-xs text-muted-foreground">{origin}</span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-400 ring-4 ring-red-400/20" />
              <span className="text-xs text-muted-foreground">{destination}</span>
            </div>
            {currentLocation && (
              <div className="mt-3 text-xs text-blue-400">
                {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Error fallback ──
  if (mapState === 'error') {
    return (
      <div className={cn(
        'relative h-64 overflow-hidden rounded-2xl border border-red-500/20 bg-navy-light',
        className
      )}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-red-400/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Failed to load map
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Check your Google Maps API key
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (mapState === 'loading') {
    return (
      <div className={cn(
        'relative h-64 overflow-hidden rounded-2xl border border-white/5 bg-navy-light',
        className
      )}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  // ── Ready: render map ──
  const stateColors: Record<JourneyDisplayState, string> = {
    on_schedule: 'bg-green-500/80',
    approaching_eta: 'bg-amber-500/80',
    overdue: 'bg-red-500/80',
    guardian_monitoring: 'bg-purple-500/80',
  };

  return (
    <div className={cn('relative h-64 overflow-hidden rounded-2xl border border-white/5', className)}>
      <div ref={mapRef} className="h-full w-full" />

      {/* Guardian state badge overlay */}
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-lg',
          stateColors[displayState]
        )}>
          <Navigation className="h-3 w-3" />
          {displayState.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </div>
      </div>

      {/* ETA overlay */}
      {etaLabel && (
        <div className="pointer-events-none absolute right-3 top-3 z-10">
          <div className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            {etaLabel}
          </div>
        </div>
      )}

      {/* Confidence score overlay */}
      {confidenceScore !== null && confidenceScore !== undefined && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10">
          <div className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm',
            confidenceScore >= 80 ? 'bg-green-500/80 text-white'
            : confidenceScore >= 50 ? 'bg-yellow-500/80 text-black'
            : confidenceScore >= 25 ? 'bg-orange-500/80 text-white'
            : 'bg-red-500/80 text-white'
          )}>
            {confidenceScore}% Safe
          </div>
        </div>
      )}
    </div>
  );
}

// Dark map style for Google Maps
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746c8a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a0a0b0' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#746c8a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e2a1e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a4e' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1e2e' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a5a7e' }] },
];
