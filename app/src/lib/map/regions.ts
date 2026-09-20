import { clampCoordinate, isValidCoordinate, MAX_LATITUDE, MAX_LONGITUDE, MIN_LATITUDE, MIN_LONGITUDE } from './coordinates';
import type { MapCamera, MapCoordinate, MapRegion } from './map.types';

export const DEFAULT_LATITUDE_DELTA = 0.05;
export const DEFAULT_LONGITUDE_DELTA = 0.05;
export const DEFAULT_PADDING_FRACTION = 0.12;
export const MIN_LATITUDE_DELTA = 0.0005;
export const MIN_LONGITUDE_DELTA = 0.0005;

export type RegionOptions = {
  latitudeDelta?: number;
  longitudeDelta?: number;
  paddingFraction?: number;
};

const DEGREES_PER_ZOOM = 360;

export function latitudeDeltaForZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_LATITUDE_DELTA;
  const clamped = Math.min(22, Math.max(1, zoom));
  return Math.max(MIN_LATITUDE_DELTA, DEGREES_PER_ZOOM / 2 ** clamped);
}

export function longitudeDeltaForZoom(zoom: number, latitude: number): number {
  const latDelta = latitudeDeltaForZoom(zoom);
  const cos = Math.cos((clampLatitudeRadians(latitude) * Math.PI) / 180);
  if (cos <= 0.01) return MAX_LONGITUDE - MIN_LONGITUDE;
  return Math.max(MIN_LONGITUDE_DELTA, Math.min(MAX_LONGITUDE - MIN_LONGITUDE, latDelta / cos));
}

export function zoomForLatitudeDelta(latitudeDelta: number): number {
  if (!Number.isFinite(latitudeDelta) || latitudeDelta <= 0) return 12;
  return Math.log2(DEGREES_PER_ZOOM / Math.max(MIN_LATITUDE_DELTA, latitudeDelta));
}

export function regionForCamera(camera: MapCamera): MapRegion {
  const latitude = camera.center.latitude;
  return {
    latitude,
    longitude: camera.center.longitude,
    latitudeDelta: latitudeDeltaForZoom(camera.zoom),
    longitudeDelta: longitudeDeltaForZoom(camera.zoom, latitude),
  };
}

export function cameraForRegion(region: MapRegion): MapCamera {
  return { center: { latitude: region.latitude, longitude: region.longitude }, zoom: zoomForLatitudeDelta(region.latitudeDelta) };
}

function clampLatitudeRadians(latitude: number): number {
  return Math.min(MAX_LATITUDE, Math.max(MIN_LATITUDE, latitude));
}

export function defaultRegionForCoordinate(
  coordinate: MapCoordinate,
  options: RegionOptions = {},
): MapRegion {
  const { latitudeDelta = DEFAULT_LATITUDE_DELTA, longitudeDelta = DEFAULT_LONGITUDE_DELTA } = options;
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: Math.max(MIN_LATITUDE_DELTA, latitudeDelta),
    longitudeDelta: Math.max(MIN_LONGITUDE_DELTA, longitudeDelta),
  };
}

export function regionForLatitudeLongitude(
  latitude: number,
  longitude: number,
  options: RegionOptions = {},
): MapRegion | null {
  if (!isValidCoordinate({ latitude, longitude })) return null;
  return defaultRegionForCoordinate({ latitude, longitude }, options);
}

export function regionForCoordinates(
  coordinates: readonly MapCoordinate[],
  options: RegionOptions = {},
): MapRegion | null {
  const valid = coordinates.filter(
    (coordinate): coordinate is MapCoordinate => isValidCoordinate(coordinate),
  );
  if (valid.length === 0) return null;
  if (valid.length === 1) return defaultRegionForCoordinate(valid[0], options);

  const { paddingFraction = DEFAULT_PADDING_FRACTION } = options;
  let minLat = MAX_LATITUDE;
  let maxLat = MIN_LATITUDE;
  let minLng = MAX_LONGITUDE;
  let maxLng = MIN_LONGITUDE;

  for (const coordinate of valid) {
    minLat = Math.min(minLat, coordinate.latitude);
    maxLat = Math.max(maxLat, coordinate.latitude);
    minLng = Math.min(minLng, coordinate.longitude);
    maxLng = Math.max(maxLng, coordinate.longitude);
  }

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const latPadding = latSpan > 0 ? latSpan * paddingFraction : DEFAULT_LATITUDE_DELTA / 2;
  const lngPadding = lngSpan > 0 ? lngSpan * paddingFraction : DEFAULT_LONGITUDE_DELTA / 2;

  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latSpan + 2 * latPadding,
    longitudeDelta: lngSpan + 2 * lngPadding,
  };

  const clamped = clampCoordinate({ latitude: region.latitude, longitude: region.longitude });
  return {
    ...region,
    latitude: clamped.latitude,
    longitude: clamped.longitude,
    latitudeDelta: Math.max(MIN_LATITUDE_DELTA, region.latitudeDelta),
    longitudeDelta: Math.max(MIN_LONGITUDE_DELTA, region.longitudeDelta),
  };
}

export function regionCenter(region: MapRegion): MapCoordinate {
  return { latitude: region.latitude, longitude: region.longitude };
}

export function regionBounds(region: MapRegion): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return {
    minLat: Math.max(MIN_LATITUDE, region.latitude - halfLat),
    maxLat: Math.min(MAX_LATITUDE, region.latitude + halfLat),
    minLng: Math.max(MIN_LONGITUDE, region.longitude - halfLng),
    maxLng: Math.min(MAX_LONGITUDE, region.longitude + halfLng),
  };
}