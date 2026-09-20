import { isValidCoordinate } from './coordinates';
import type { MapCoordinate, MapMarker, MapMarkerKind } from './map.types';

export type MarkerSource = {
  id?: string;
  coordinate: MapCoordinate;
  kind?: MapMarkerKind;
  title?: string;
  description?: string;
  color?: string;
};

export const USER_LOCATION_MARKER_ID = 'map-user-location';

export function markerIdFor(prefix: string, latitude: number, longitude: number): string {
  return `${prefix}-${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export function markersFromLocations(sources: readonly MarkerSource[]): MapMarker[] {
  const seen = new Set<string>();
  const markers: MapMarker[] = [];

  for (const source of sources) {
    if (!isValidCoordinate(source.coordinate)) continue;

    const baseId = source.id ?? markerIdFor('marker', source.coordinate.latitude, source.coordinate.longitude);
    let id = baseId;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);

    markers.push({
      id,
      coordinate: { latitude: source.coordinate.latitude, longitude: source.coordinate.longitude },
      kind: source.kind ?? 'generic',
      ...(source.title != null ? { title: source.title } : {}),
      ...(source.description != null ? { description: source.description } : {}),
      ...(source.color != null ? { color: source.color } : {}),
    });
  }

  return markers;
}

export function userLocationMarker(
  position: MapCoordinate,
  options: { title?: string; color?: string } = {},
): MapMarker | null {
  if (!isValidCoordinate(position)) return null;
  return {
    id: USER_LOCATION_MARKER_ID,
    coordinate: { latitude: position.latitude, longitude: position.longitude },
    kind: 'user',
    ...(options.title != null ? { title: options.title } : {}),
    ...(options.color != null ? { color: options.color } : {}),
  };
}