import { useCallback, useEffect, useRef, useState } from 'react';

import { createTrip, type TripPlan, type TripPoint } from '@/lib/api/trips';
import { buildClientTripPlan } from '@/lib/api/trip-fallback';
import { applyRoadPathway } from '@/lib/map/road-directions';
import { strings } from '@/i18n/strings';
import type { PlaceSuggestion } from '@/lib/map/geocoding';
import type { MapCoordinate } from '@/lib/map/map.types';

export type TripPlanStatus = 'idle' | 'loading' | 'ready' | 'error';

export function suggestionToTripPoint(suggestion: PlaceSuggestion): TripPoint {
  return {
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    label: suggestion.label,
  };
}

export function currentLocationToTripPoint(
  coordinate: MapCoordinate,
  label = strings.trip.currentLocationLabel,
): TripPoint {
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    label,
  };
}

export function tripPointLabel(point: TripPoint | null | undefined): string {
  if (!point) return '';
  const label = point.label?.trim();
  if (label) return label;
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

export function tripStatusMessage(status: TripPlanStatus): string | null {
  if (status === 'loading') return strings.trip.planning;
  if (status === 'error') return strings.trip.planFailed;
  return null;
}

export function useTripPlan(
  planTrip: typeof createTrip = createTrip,
  snapToRoads: typeof applyRoadPathway = applyRoadPathway,
  deviceCode?: string,
) {
  const [origin, setOrigin] = useState<TripPoint | null>(null);
  const [destination, setDestination] = useState<TripPoint | null>(null);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [status, setStatus] = useState<TripPlanStatus>('idle');
  const snapToRoadsRef = useRef(snapToRoads);
  snapToRoadsRef.current = snapToRoads;

  const selectOrigin = useCallback((point: TripPoint) => {
    setOrigin(point);
  }, []);

  const selectDestination = useCallback((point: TripPoint) => {
    setDestination(point);
  }, []);

  useEffect(() => {
    if (!origin || !destination) {
      setPlan(null);
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    void planTrip({ origin, destination, profile: 'driving', deviceCode })
      .then((next) => snapToRoadsRef.current(next))
      .then((next) => {
        if (cancelled) return;
        setPlan(next);
        setStatus('ready');
      })
      .catch(async () => {
        if (cancelled) return;
        const fallback = await snapToRoadsRef.current(buildClientTripPlan(origin, destination));
        if (cancelled) return;
        setPlan(fallback);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [destination, deviceCode, origin, planTrip]);

  return {
    origin,
    destination,
    plan,
    status,
    statusMessage: tripStatusMessage(status),
    selectOrigin,
    selectDestination,
  };
}
