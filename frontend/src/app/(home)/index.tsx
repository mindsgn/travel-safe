import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapStatusCard } from '@/components/map/map-status-card';
import { SafetyMap } from '@/components/map/safety-map';
import { SafetyLegend } from '@/components/safety-legend';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripPlannerCard } from '@/components/trip/trip-planner-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useMapLocation } from '@/hooks/use-map-location';
import {
  currentLocationToTripPoint,
  suggestionToTripPoint,
  useTripPlan,
} from '@/hooks/use-trip-plan';
import { strings } from '@/i18n/strings';
import type { LivePosition } from '@/lib/location';
import { safetyZonesToHeatmapCells } from '@/lib/map/heatmap-geojson';
import type { MapMarker } from '@/lib/map/map.types';
import { MOCK_SAFETY_ZONES } from '@/lib/safety-map';
import { useTripSelectionStore } from '@/store/trip-selection-store';

const fallbackHeatmap = safetyZonesToHeatmapCells(MOCK_SAFETY_ZONES);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { position, accuracyMeters, status, retry } = useMapLocation();
  const trip = useTripPlan();
  const { selectOrigin, selectDestination } = trip;
  const pending = useTripSelectionStore((state) => state.pending);
  const consume = useTripSelectionStore((state) => state.consume);

  useFocusEffect(
    useCallback(() => {
      const originSuggestion = pending.origin;
      const destinationSuggestion = pending.destination;
      if (originSuggestion) {
        selectOrigin(suggestionToTripPoint(originSuggestion));
        consume('origin');
      }
      if (destinationSuggestion) {
        selectDestination(suggestionToTripPoint(destinationSuggestion));
        consume('destination');
      }
    }, [consume, pending.destination, pending.origin, selectDestination, selectOrigin]),
  );

  const liveLocation = useMemo<LivePosition | null>(
    () => (position ? { latitude: position.latitude, longitude: position.longitude } : null),
    [position],
  );

  const showLegend = status === 'ready' || status === 'inaccurate' || status === 'stale';
  const heatmapCells = trip.plan?.heatmap.cells ?? fallbackHeatmap;
  const pathwayCoordinates = trip.plan?.pathway.coordinates ?? [];

  const tripMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    if (trip.origin) {
      markers.push({
        id: 'trip-origin',
        coordinate: { latitude: trip.origin.latitude, longitude: trip.origin.longitude },
        kind: 'generic',
        title: trip.origin.label ?? strings.trip.originLabel,
        color: '#0a2010',
      });
    }
    if (trip.destination) {
      markers.push({
        id: 'trip-destination',
        coordinate: { latitude: trip.destination.latitude, longitude: trip.destination.longitude },
        kind: 'generic',
        title: trip.destination.label ?? strings.trip.destinationLabel,
        color: '#e5484d',
      });
    }
    return markers;
  }, [trip.destination, trip.origin]);

  return (
    <View style={styles.container}>
      <SafetyMap
        liveLocation={liveLocation}
        accuracyMeters={accuracyMeters}
        heatmapCells={heatmapCells}
        pathwayCoordinates={pathwayCoordinates}
        markers={tripMarkers}
        followUser={!trip.plan}
      />

      <View style={[styles.overlay, { top: insets.top + Spacing.two }]} pointerEvents="box-none">
        <TripPlannerCard
          canUseCurrentLocation={Boolean(liveLocation)}
          statusMessage={trip.statusMessage}
          origin={trip.origin}
          destination={trip.destination}
          onPressOrigin={() => router.push('/place-search?target=origin')}
          onPressDestination={() => router.push('/place-search?target=destination')}
          onUseCurrentLocation={() => {
            if (liveLocation) trip.selectOrigin(currentLocationToTripPoint(liveLocation));
          }}
        />
        <MapStatusCard status={status} onRetry={retry} />
        {showLegend ? <SafetyLegend /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
  },
  entries: {
    position: 'absolute',
    bottom: BottomTabInset + Spacing.four,
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
  },
  entryHitbox: {
    width: '100%',
  },
  entry: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  entryPressed: {
    opacity: 0.8,
  },
  cta: {
    textDecorationLine: 'underline',
    marginTop: Spacing.one,
  },
});
