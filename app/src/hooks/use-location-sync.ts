import { useEffect, useRef, useState } from 'react';

import { saveUserLocation } from '@/lib/api/location';
import type { LivePosition } from '@/lib/location';
import { LOCATION_PING_INTERVAL_MS, shouldSendLocationPing } from '@/lib/location-sync';

export type LocationSyncController = {
  lastSyncedAt: number | null;
};

export type LocationSyncOptions = {
  deviceCode: string | null;
  position: LivePosition | null;
  accuracyMeters?: number | null;
  enabled?: boolean;
  intervalMs?: number;
  now?: () => number;
  saveLocation?: typeof saveUserLocation;
};

export function useLocationSync(options: LocationSyncOptions): LocationSyncController {
  const {
    deviceCode,
    position,
    accuracyMeters,
    enabled = true,
    intervalMs = LOCATION_PING_INTERVAL_MS,
    now = Date.now,
    saveLocation = saveUserLocation,
  } = options;

  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const lastSyncedAtRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const positionRef = useRef(position);
  const accuracyRef = useRef(accuracyMeters);
  const saveRef = useRef(saveLocation);
  const nowRef = useRef(now);

  lastSyncedAtRef.current = lastSyncedAt;
  positionRef.current = position;
  accuracyRef.current = accuracyMeters;
  saveRef.current = saveLocation;
  nowRef.current = now;

  const hasPosition = position != null;

  useEffect(() => {
    if (!enabled || !deviceCode || !hasPosition) return;

    let cancelled = false;

    const sync = async () => {
      const current = positionRef.current;
      if (inFlightRef.current || !current) return;
      const timestamp = nowRef.current();
      if (!shouldSendLocationPing(lastSyncedAtRef.current, timestamp, intervalMs)) return;

      inFlightRef.current = true;
      try {
        await saveRef.current({
          deviceCode,
          latitude: current.latitude,
          longitude: current.longitude,
          accuracyMeters: accuracyRef.current,
        });
        if (cancelled) return;
        lastSyncedAtRef.current = timestamp;
        setLastSyncedAt(timestamp);
      } catch {
        // Retry on the next interval.
      } finally {
        inFlightRef.current = false;
      }
    };

    void sync();
    const id = setInterval(() => {
      void sync();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [deviceCode, enabled, hasPosition, intervalMs]);

  return { lastSyncedAt };
}
