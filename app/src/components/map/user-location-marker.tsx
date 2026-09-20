import * as Mapbox from '@rnmapbox/maps';

import { MapMarker } from '@/components/map/map-marker';
import type { MapCoordinate } from '@/lib/map/map.types';
import { userLocationMarker } from '@/lib/map/markers';

export type UserLocationMarkerProps = {
  coordinate: MapCoordinate;
  accuracyMeters?: number | null;
  title?: string;
  testID?: string;
};

const USER_PIN_COLOR = '#007AFF';

export function accuracyHaloGeoJSON(coordinate: MapCoordinate) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Point' as const,
          coordinates: [coordinate.longitude, coordinate.latitude] as [number, number],
        },
      },
    ],
  };
}

export function UserLocationMarker({
  coordinate,
  accuracyMeters,
  title,
  testID,
}: UserLocationMarkerProps) {
  const marker = userLocationMarker(coordinate, title ? { title } : undefined);

  if (!marker) return null;

  const haloId = `${testID ?? 'user-location'}-accuracy`;

  return (
    <>
      {accuracyMeters != null && accuracyMeters >= 0 ? (
        <Mapbox.ShapeSource id={haloId} shape={accuracyHaloGeoJSON(coordinate)}>
          <Mapbox.CircleLayer
            id={`${haloId}-layer`}
            testID={haloId}
            style={{
              circleRadius: 18,
              circleColor: 'rgba(0, 122, 255, 0.12)',
              circleStrokeColor: 'rgba(0, 122, 255, 0.35)',
              circleStrokeWidth: 1,
            }}
          />
        </Mapbox.ShapeSource>
      ) : null}
      <MapMarker
        marker={{ ...marker, color: USER_PIN_COLOR }}
        accessibilityLabel={title ?? 'Your current location'}
        testID={testID ?? 'user-location'}
      />
    </>
  );
}
