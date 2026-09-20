import * as Location from 'expo-location';
import { useEffect, useReducer, useRef, useState } from 'react';

import { initialMapLocationState, isPositionStale, mapLocationReducer } from '@/lib/map/location-state';
import type { MapLocationState } from '@/lib/map/map.types';

export type MapLocationController = MapLocationState & {
  stale: boolean;
  retry: () => void;
};

export type MapLocationOptions = {
  accuracy?: Location.Accuracy;
  maxStaleMs?: number;
  maxAccuracyMeters?: number;
  watch?: boolean;
  requestTimeoutMs?: number;
};

const DEFAULT_OPTIONS: Required<MapLocationOptions> = {
  accuracy: Location.Accuracy.Balanced,
  maxStaleMs: 60_000,
  maxAccuracyMeters: 250,
  watch: true,
  requestTimeoutMs: 15_000,
};

const TIMEOUT_SENTINEL = 'MAP_LOCATION_TIMEOUT';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(TIMEOUT_SENTINEL)), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}

function toCoordinate(latitude: number, longitude: number) {
  return { latitude, longitude };
}

function accuracyOf(coords: { accuracy?: unknown }): number | null {
  return typeof coords.accuracy === 'number' && Number.isFinite(coords.accuracy) ? coords.accuracy : null;
}

export function useMapLocation(options: MapLocationOptions = {}): MapLocationController {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { accuracy, maxAccuracyMeters, maxStaleMs, requestTimeoutMs, watch } = config;

  const [state, dispatch] = useReducer(mapLocationReducer, undefined, initialMapLocationState);
  const [staleStamp, setStaleStamp] = useState<number | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      dispatch({ type: 'locating' });
      watcherRef.current?.remove();
      watcherRef.current = null;

      try {
        const provider = await Location.getProviderStatusAsync();
        if (cancelled) return;
        if (!provider.locationServicesEnabled) {
          dispatch({ type: 'services-disabled' });
          return;
        }
        if (provider.gpsAvailable === false) {
          dispatch({ type: 'gps-unavailable' });
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          dispatch({ type: 'permission-denied' });
          return;
        }

        const initial = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy }),
          requestTimeoutMs,
        );
        if (cancelled) return;

        const initialAccuracy = accuracyOf(initial.coords);
        dispatch({
          type: 'position',
          position: toCoordinate(initial.coords.latitude, initial.coords.longitude),
          accuracyMeters: initialAccuracy,
        });
        if (initialAccuracy != null && initialAccuracy > maxAccuracyMeters) {
          dispatch({ type: 'inaccurate' });
        }

        if (!watch) return;

        watcherRef.current = await Location.watchPositionAsync(
          { accuracy, distanceInterval: 10, timeInterval: 2000 },
          (location) => {
            if (cancelled) return;
            const liveAccuracy = accuracyOf(location.coords);
            dispatch({
              type: 'position',
              position: toCoordinate(location.coords.latitude, location.coords.longitude),
              accuracyMeters: liveAccuracy,
            });
            if (liveAccuracy != null && liveAccuracy > maxAccuracyMeters) {
              dispatch({ type: 'inaccurate' });
            }
          },
        );
      } catch (error) {
        if (cancelled) return;
        if (error instanceof Error && error.message === TIMEOUT_SENTINEL) {
          dispatch({ type: 'timeout' });
          return;
        }
        dispatch({ type: 'error', message: error instanceof Error ? error.message : null });
      } finally {
        inFlightRef.current = false;
      }
    };

    void run();

    return () => {
      cancelled = true;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, [accuracy, maxAccuracyMeters, requestTimeoutMs, retryNonce, watch]);

  useEffect(() => {
    const timestamp = state.timestamp;
    if (timestamp == null) return;
    const evaluate = () => {
      setStaleStamp(
        isPositionStale(Date.now() - timestamp, maxStaleMs) ? timestamp : null,
      );
    };
    const id = setInterval(evaluate, Math.min(maxStaleMs, 1000));
    return () => clearInterval(id);
  }, [maxStaleMs, state.timestamp]);

  const stale = staleStamp != null && staleStamp === state.timestamp;

  const retry = () => setRetryNonce((nonce) => nonce + 1);

  return {
    ...state,
    stale,
    retry,
  };
}