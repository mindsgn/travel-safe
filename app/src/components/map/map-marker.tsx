import * as Mapbox from '@rnmapbox/maps';
import { View } from 'react-native';

import type { MapMarker as MapMarkerModel } from '@/lib/map/map.types';

export type MapMarkerProps = {
  marker: MapMarkerModel;
  accessibilityLabel?: string;
  testID?: string;
};

export function markerPinColor(marker: MapMarkerModel): string {
  if (marker.color) return marker.color;
  if (marker.kind === 'user') return '#007AFF';
  if (marker.kind === 'emergency') return '#e5484d';
  return '#111111';
}

export function MapMarker({ marker, accessibilityLabel, testID }: MapMarkerProps) {
  const label = accessibilityLabel ?? marker.title ?? marker.description ?? `Marker ${marker.id}`;

  return (
    <Mapbox.PointAnnotation
      id={marker.id}
      coordinate={[marker.coordinate.longitude, marker.coordinate.latitude]}
      title={marker.title}
      snippet={marker.description}
      accessibilityLabel={label}
      testID={testID ?? `map-marker-${marker.id}`}>
      <View
        testID={`${testID ?? `map-marker-${marker.id}`}-pin`}
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: markerPinColor(marker),
          borderWidth: 2,
          borderColor: '#ffffff',
        }}
      />
    </Mapbox.PointAnnotation>
  );
}
