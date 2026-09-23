import * as Location from 'expo-location';

import { strings } from '@/i18n/strings';
import type { LocationSample } from '@/lib/api/deadman-api';

export const JOURNEY_TASK = 'deadman-journey-location';
const FRESH_FIX_MAX_AGE_MS = 2 * 60_000;
const FIX_TIMEOUT_MS = 4_000;

export type LocationApi = Pick<
  typeof Location,
  | 'getForegroundPermissionsAsync'
  | 'getLastKnownPositionAsync'
  | 'getCurrentPositionAsync'
  | 'startLocationUpdatesAsync'
  | 'stopLocationUpdatesAsync'
  | 'hasStartedLocationUpdatesAsync'
>;

type LocationLike = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};

export function toSample(location: LocationLike): LocationSample {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyM: location.coords.accuracy ?? null,
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Best effort and fast: never prompts (permission is asked during onboarding), prefers a
 * recent cached fix, and gives up after a few seconds so check-ins stay instant.
 */
export async function captureCurrentLocation(
  api: LocationApi = Location,
  timeoutMs: number = FIX_TIMEOUT_MS,
): Promise<LocationSample | null> {
  try {
    const permission = await api.getForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const recent = await api.getLastKnownPositionAsync({ maxAge: FRESH_FIX_MAX_AGE_MS });
    if (recent) return toSample(recent);
    const current = await withTimeout(
      api.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeoutMs,
    );
    if (current) return toSample(current);
    const stale = await api.getLastKnownPositionAsync();
    return stale ? toSample(stale) : null;
  } catch {
    return null;
  }
}

export function samplesFromTaskData(data: unknown): LocationSample[] {
  const locations = (data as { locations?: LocationLike[] } | null)?.locations;
  return Array.isArray(locations) ? locations.map(toSample) : [];
}

/** Low-power journey trail: significant movement only, deferred batching. */
export async function startJourneyTracking(api: LocationApi = Location): Promise<void> {
  if (await api.hasStartedLocationUpdatesAsync(JOURNEY_TASK)) return;
  await api.startLocationUpdatesAsync(JOURNEY_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 250,
    deferredUpdatesDistance: 250,
    deferredUpdatesInterval: 15 * 60_000,
    pausesUpdatesAutomatically: true,
    activityType: Location.ActivityType.Other,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: strings.notifications.journeyTitle,
      notificationBody: strings.notifications.journeyBody,
    },
  });
}

export async function stopJourneyTracking(api: LocationApi = Location): Promise<void> {
  try {
    if (await api.hasStartedLocationUpdatesAsync(JOURNEY_TASK)) await api.stopLocationUpdatesAsync(JOURNEY_TASK);
  } catch {
    // Task was never registered on this install; nothing to stop.
  }
}
