import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Mapbox from '@rnmapbox/maps';

import { MapMarker } from '@/components/map/map-marker';
import { UserLocationMarker } from '@/components/map/user-location-marker';
import { Spacing } from '@/constants/theme';
import { strings } from '@/i18n/strings';
import type { HeatmapCell } from '@/lib/api/trips';
import type { LivePosition } from '@/lib/location';
import { metersBetween } from '@/lib/location';
import {
  heatmapCellsToGeoJSON,
  pathwayCoordinatesToMap,
  pathwayToLineGeoJSON,
} from '@/lib/map/heatmap-geojson';
import { createMapboxNativeHandle, createMapController, boundsFromCoordinates, expandBounds, type MapboxCameraHandle } from '@/lib/map/map-service';
import type { MapMarker as MapMarkerModel, MapPolyline, MapRegion } from '@/lib/map/map.types';
import { defaultRegionForCoordinate, regionForCamera } from '@/lib/map/regions';

export type SafetyMapProps = {
  style?: StyleProp<ViewStyle>;
  liveLocation?: LivePosition | null;
  accuracyMeters?: number | null;
  region?: MapRegion | null;
  markers?: readonly MapMarkerModel[];
  heatmapCells?: readonly HeatmapCell[];
  pathwayCoordinates?: readonly [number, number][];
  polylines?: readonly MapPolyline[];
  followUser?: boolean;
  controls?: boolean;
  onReady?: () => void;
};

const USER_MARKER_ID = 'map-user-location';
const DEFAULT_FOLLOW_ZOOM = 14;
const FOLLOW_THRESHOLD_METERS = 30;
const ZOOM_STEP = 1;
const DEFAULT_REGION_LATITUDE = -33.9249;
const DEFAULT_REGION_LONGITUDE = 18.4241;

const HEATMAP_STYLE = {
  heatmapWeight: ['interpolate', ['linear'], ['get', 'weight'], 0, 0.2, 1, 1],
  heatmapIntensity: ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
  heatmapColor: [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    'rgba(76,245,107,0.15)',
    0.15,
    'rgba(76,245,107,0.55)',
    0.45,
    'rgba(245,184,0,0.75)',
    0.75,
    'rgba(229,44,45,0.85)',
    1,
    'rgba(229,44,45,1)',
  ],
  heatmapRadius: ['interpolate', ['linear'], ['zoom'], 10, 8, 13, 14, 16, 20],
  heatmapOpacity: 0.9,
};

const HEAT_CIRCLE_STYLE = {
  circleColor: [
    'interpolate',
    ['linear'],
    ['get', 'weight'],
    0,
    'rgba(76,245,107,0.45)',
    0.5,
    'rgba(245,184,0,0.55)',
    1,
    'rgba(229,44,45,0.6)',
  ],
  circleRadius: ['interpolate', ['linear'], ['zoom'], 12, 8, 14, 12, 16, 16],
  circleOpacity: 0.7,
  circleBlur: 0.6,
  circlePitchAlignment: 'map',
};

const LINE_STYLE = {
  lineColor: '#007AFF',
  lineWidth: 6,
  lineCap: 'round',
  lineJoin: 'round',
};

const STREET_STYLE_URL = 'mapbox://styles/mapbox/streets-v12';

export function SafetyMap({
  style,
  liveLocation,
  accuracyMeters,
  region,
  markers = [],
  heatmapCells = [],
  pathwayCoordinates = [],
  polylines = [],
  followUser = true,
  controls = true,
  onReady,
}: SafetyMapProps) {
  const controllerRef = useRef(createMapController(null));
  const lastCenteredRef = useRef<LivePosition | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const initialRegion = useMemo(() => {
    if (region) return region;
    if (liveLocation) return defaultRegionForCoordinate(liveLocation, { latitudeDelta: 0.05, longitudeDelta: 0.07 });
    return defaultRegionForCoordinate(
      { latitude: DEFAULT_REGION_LATITUDE, longitude: DEFAULT_REGION_LONGITUDE },
      { latitudeDelta: 0.1, longitudeDelta: 0.15 },
    );
  }, [liveLocation, region]);

  const attachCameraRef = useCallback((node: unknown) => {
    controllerRef.current = createMapController(createMapboxNativeHandle(node as MapboxCameraHandle | null));
  }, []);

  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    onReady?.();
  }, [onReady]);

  const lastKnownCoordinate = useMemo(
    () => (liveLocation ? { latitude: liveLocation.latitude, longitude: liveLocation.longitude } : null),
    [liveLocation],
  );

  const recenterToUser = useCallback(() => {
    const coordinate = lastKnownCoordinate;
    if (!coordinate) {
      controllerRef.current.animateToRegion(initialRegion);
      return;
    }
    controllerRef.current.recenter(coordinate, regionForCamera({ center: coordinate, zoom: DEFAULT_FOLLOW_ZOOM }));
  }, [initialRegion, lastKnownCoordinate]);

  useEffect(() => {
    if (!liveLocation || !followUser || !isMapReady) return;

    const last = lastCenteredRef.current;
    if (last && metersBetween(last, liveLocation) < FOLLOW_THRESHOLD_METERS) {
      return;
    }

    lastCenteredRef.current = liveLocation;
    controllerRef.current.recenter(liveLocation, regionForCamera({ center: liveLocation, zoom: DEFAULT_FOLLOW_ZOOM }));
  }, [followUser, isMapReady, liveLocation]);

  useEffect(() => {
    if (!region || !isMapReady) return;
    controllerRef.current.animateToRegion(region);
  }, [isMapReady, region]);

  useEffect(() => {
    if (!isMapReady || pathwayCoordinates.length < 2) return;
    const extras = markers.map((marker) => marker.coordinate);
    controllerRef.current.fitToCoordinates(
      [...pathwayCoordinatesToMap(pathwayCoordinates), ...extras],
      {
        edgePadding: { top: 180, right: 56, bottom: 260, left: 56 },
      },
    );
  }, [isMapReady, markers, pathwayCoordinates]);

  const handleZoomBy = useCallback(
    (deltaZoom: number) => {
      const anchor =
        lastKnownCoordinate ?? { latitude: initialRegion.latitude, longitude: initialRegion.longitude };
      void controllerRef.current.zoomBy(anchor, deltaZoom);
    },
    [initialRegion, lastKnownCoordinate],
  );

  const handleZoomIn = useCallback(() => handleZoomBy(ZOOM_STEP), [handleZoomBy]);
  const handleZoomOut = useCallback(() => handleZoomBy(-ZOOM_STEP), [handleZoomBy]);

  const heatmap = useMemo(() => heatmapCellsToGeoJSON(heatmapCells), [heatmapCells]);
  const pathway = useMemo(
    () => (pathwayCoordinates.length >= 2 ? pathwayToLineGeoJSON({ coordinates: [...pathwayCoordinates] }) : null),
    [pathwayCoordinates],
  );
  const cameraBounds = useMemo(() => {
    if (pathwayCoordinates.length < 2) return null;
    const extras = markers.map((marker) => marker.coordinate);
    const bounds = boundsFromCoordinates([...pathwayCoordinatesToMap(pathwayCoordinates), ...extras]);
    return bounds ? expandBounds(bounds) : null;
  }, [markers, pathwayCoordinates]);

  if (Platform.OS === 'web') {
    return (
      <View testID="safety-map" style={[styles.container, style]}>
        <View style={styles.fallback} pointerEvents="none">
          <View style={styles.fallbackCopy}>
            <Text style={styles.fallbackTitle}>{strings.fallback.title}</Text>
            <Text style={styles.fallbackBody}>{strings.fallback.body}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View testID="safety-map" style={[styles.container, style]}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL?.Street ?? STREET_STYLE_URL}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={handleMapReady}
        accessibilityLabel={strings.safetyMap.headerTitle}
        testID="map-view">
        <Mapbox.Camera
          ref={attachCameraRef}
          defaultSettings={{
            centerCoordinate: [initialRegion.longitude, initialRegion.latitude],
            zoomLevel: 12,
          }}
          bounds={
            cameraBounds
              ? {
                  ne: cameraBounds.ne,
                  sw: cameraBounds.sw,
                  paddingTop: 180,
                  paddingBottom: 260,
                  paddingLeft: 56,
                  paddingRight: 56,
                }
              : undefined
          }
          maxZoomLevel={cameraBounds ? 14 : undefined}
          animationDuration={cameraBounds ? 800 : 0}
        />

        {heatmap.features.length > 0 ? (
          <Mapbox.ShapeSource id="trip-heatmap-source" shape={heatmap} testID="trip-heatmap">
            {Mapbox.HeatmapLayer ? (
              <Mapbox.HeatmapLayer
                id="trip-heatmap-layer"
                sourceID="trip-heatmap-source"
                style={HEATMAP_STYLE}
              />
            ) : null}
            {Mapbox.CircleLayer ? (
              <Mapbox.CircleLayer
                id="trip-heatmap-circles"
                sourceID="trip-heatmap-source"
                style={HEAT_CIRCLE_STYLE}
              />
            ) : null}
          </Mapbox.ShapeSource>
        ) : null}

        {pathway ? (
          <Mapbox.ShapeSource id="trip-pathway-source" shape={pathway} testID="trip-pathway">
            <Mapbox.LineLayer
              id="trip-pathway-layer"
              sourceID="trip-pathway-source"
              style={LINE_STYLE}
            />
          </Mapbox.ShapeSource>
        ) : null}

        {polylines.map((polyline) => (
          <Mapbox.ShapeSource
            key={polyline.id}
            id={`polyline-${polyline.id}`}
            shape={pathwayToLineGeoJSON({
              coordinates: polyline.coordinates.map((point) => [point.longitude, point.latitude]),
            }, polyline.id)}>
            <Mapbox.LineLayer
              id={`polyline-layer-${polyline.id}`}
              style={{ ...LINE_STYLE, lineColor: polyline.color ?? '#007AFF', lineWidth: polyline.width ?? 4 }}
            />
          </Mapbox.ShapeSource>
        ))}

        {markers.map((marker) => (
          <MapMarker key={marker.id} marker={marker} />
        ))}

        {liveLocation ? (
          <UserLocationMarker
            coordinate={{ latitude: liveLocation.latitude, longitude: liveLocation.longitude }}
            accuracyMeters={accuracyMeters}
            title={strings.safetyMap.liveLocationTitle}
            testID={USER_MARKER_ID}
          />
        ) : null}
      </Mapbox.MapView>
    </View>
  );
}

type MapControlButtonProps = {
  testID: string;
  label: string;
  symbol: string;
  onPress: () => void;
  primary?: boolean;
};

function MapControlButton({ testID, label, symbol, onPress, primary }: MapControlButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.controlButton,
        primary && styles.controlButtonPrimary,
        pressed && styles.controlButtonPressed,
      ]}>
      <View style={styles.symbol}>
        <Text style={[styles.symbolText, { color: primary ? '#ffffff' : '#000000' }]}>{symbol}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controls: {
    position: 'absolute',
    right: Spacing.three,
    top: Spacing.six,
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  controlCluster: {
    gap: Spacing.one,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  controlButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  controlButtonPressed: {
    opacity: 0.7,
  },
  symbol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  fallbackCopy: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  fallbackBody: {
    fontSize: 14,
    textAlign: 'center',
  },
});
