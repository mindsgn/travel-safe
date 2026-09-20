import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

import { strings } from '@/i18n/strings';
import type { EmergencyPosition } from '@/lib/emergency';

export type EmergencyLocationState = {
  position: EmergencyPosition | null;
  error: string | null;
  isLocating: boolean;
  retry: () => void;
};

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Highest,
  distanceInterval: 5,
  timeInterval: 5000,
};

export function useEmergencyLocation(): EmergencyLocationState {
  const [position, setPosition] = useState<EmergencyPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    const toPosition = (lat: number, lng: number, accuracy: number | null): EmergencyPosition => ({
      latitude: lat,
      longitude: lng,
      accuracyMeters: accuracy,
      timestamp: Date.now(),
    });

    const run = async () => {
      setIsLocating(true);
      setError(null);
      watcherRef.current?.remove();
      watcherRef.current = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (status !== 'granted') {
          setError(strings.emergency.locationUnavailable);
          setIsLocating(false);
          return;
        }

        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        if (cancelled) return;
        setPosition(
          toPosition(initial.coords.latitude, initial.coords.longitude, initial.coords.accuracy ?? null),
        );

        watcherRef.current = await Location.watchPositionAsync(WATCH_OPTIONS, (location) => {
          if (cancelled) return;
          setPosition(
            toPosition(location.coords.latitude, location.coords.longitude, location.coords.accuracy ?? null),
          );
        });
      } catch {
        if (!cancelled) {
          setError(strings.emergency.locationUnavailable);
        }
      } finally {
        if (!cancelled) {
          setIsLocating(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, [retryNonce]);

  return {
    position,
    error,
    isLocating,
    retry: () => setRetryNonce((nonce) => nonce + 1),
  };
}