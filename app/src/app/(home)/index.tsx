import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapStatusCard } from '@/components/map/map-status-card';
import { SafetyMap } from '@/components/map/safety-map';
import { SafetyLegend } from '@/components/safety-legend';
import { TripPlannerCard } from '@/components/trip/trip-planner-card';
import { Spacing } from '@/constants/theme';
import { useDeviceCode } from '@/hooks/use-device-code';
import { useLocationSync } from '@/hooks/use-location-sync';
import { useMapLocation } from '@/hooks/use-map-location';
import {
  currentLocationToTripPoint,
  suggestionToTripPoint,
  useTripPlan,
} from '@/hooks/use-trip-plan';
import { strings } from '@/i18n/strings';
import type { LivePosition } from '@/lib/location';
import { filterHeatmapToPathway, resolveVisibleHeatmap, shouldShowSafetyLegend } from '@/lib/map/heatmap-visibility';
import type { MapMarker } from '@/lib/map/map.types';
import { useTripSelectionStore } from '@/store/trip-selection-store';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const deviceCode = useDeviceCode();
  const { position, accuracyMeters, status, retry } = useMapLocation();
  const trip = useTripPlan(undefined, undefined, deviceCode);
  const originPlace = useTripSelectionStore((state) => state.origin);
  const destinationPlace = useTripSelectionStore((state) => state.destination);
  const selectPlace = useTripSelectionStore((state) => state.selectPlace);

  useEffect(() => {
    if (originPlace) trip.selectOrigin(suggestionToTripPoint(originPlace));
  }, [originPlace, trip.selectOrigin]);

  useEffect(() => {
    if (destinationPlace) trip.selectDestination(suggestionToTripPoint(destinationPlace));
  }, [destinationPlace, trip.selectDestination]);

  const liveLocation = useMemo<LivePosition | null>(
    () => (position ? { latitude: position.latitude, longitude: position.longitude } : null),
    [position],
  );

  useLocationSync({
    deviceCode,
    position: liveLocation,
    accuracyMeters,
    enabled: Boolean(liveLocation),
  });

  const origin = originPlace ? suggestionToTripPoint(originPlace) : trip.origin;
  const destination = destinationPlace ? suggestionToTripPoint(destinationPlace) : trip.destination;

  const pathwayCoordinates = trip.plan?.pathway.coordinates ?? [];
  const heatmapCells = filterHeatmapToPathway(
    resolveVisibleHeatmap(trip.plan?.heatmap.cells),
    pathwayCoordinates,
  );
  const showLegend = shouldShowSafetyLegend(heatmapCells);

  const tripMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    if (origin) {
      markers.push({
        id: 'trip-origin',
        coordinate: { latitude: origin.latitude, longitude: origin.longitude },
        kind: 'generic',
        title: origin.label ?? strings.trip.originLabel,
        color: '#0a2010',
      });
    }
    if (destination) {
      markers.push({
        id: 'trip-destination',
        coordinate: { latitude: destination.latitude, longitude: destination.longitude },
        kind: 'generic',
        title: destination.label ?? strings.trip.destinationLabel,
        color: '#e5484d',
      });
    }
    return markers;
  }, [destination, origin]);

  return (
    <View style={styles.container}>
      <SafetyMap
        liveLocation={liveLocation}
        accuracyMeters={accuracyMeters}
        heatmapCells={heatmapCells}
        pathwayCoordinates={pathwayCoordinates}
        markers={tripMarkers}
        followUser={pathwayCoordinates.length < 2}
      />
        <View style={[styles.overlay, { top: insets.top + Spacing.two }]} pointerEvents="box-none">
          <TripPlannerCard
            canUseCurrentLocation={Boolean(liveLocation)}
            statusMessage={trip.statusMessage}
            origin={origin}
            destination={destination}
            onPressOrigin={() => router.push('/place-search?target=origin')}
            onPressDestination={() => router.push('/place-search?target=destination')}
            onUseCurrentLocation={() => {
              if (!liveLocation) return;
              const point = currentLocationToTripPoint(liveLocation);
              selectPlace('origin', {
                id: 'current-location',
                label: point.label ?? strings.trip.currentLocationLabel,
                latitude: point.latitude,
                longitude: point.longitude,
              });
            }}
          />
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
});
