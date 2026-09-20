import type { MapCoordinate } from './map.types';

export const MIN_LATITUDE = -90;
export const MAX_LATITUDE = 90;
export const MIN_LONGITUDE = -180;
export const MAX_LONGITUDE = 180;

export function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_LATITUDE && value <= MAX_LATITUDE;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_LONGITUDE && value <= MAX_LONGITUDE;
}

export function isValidCoordinate(value: unknown): value is MapCoordinate {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as { latitude?: unknown; longitude?: unknown };
  return isValidLatitude(candidate.latitude) && isValidLongitude(candidate.longitude);
}

export function clampLatitude(latitude: number): number {
  return Math.min(MAX_LATITUDE, Math.max(MIN_LATITUDE, latitude));
}

export function clampLongitude(longitude: number): number {
  return Math.min(MAX_LONGITUDE, Math.max(MIN_LONGITUDE, longitude));
}

export function clampCoordinate(coordinate: MapCoordinate): MapCoordinate {
  return {
    latitude: clampLatitude(coordinate.latitude),
    longitude: clampLongitude(coordinate.longitude),
  };
}