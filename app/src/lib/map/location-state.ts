import type { MapCoordinate, MapLocationState, MapLocationStatus, MapErrorKind } from './map.types';

export type MapLocationAction =
  | { type: 'locating' }
  | { type: 'position'; position: MapCoordinate; accuracyMeters: number | null }
  | { type: 'permission-denied' }
  | { type: 'services-disabled' }
  | { type: 'gps-unavailable' }
  | { type: 'inaccurate' }
  | { type: 'timeout' }
  | { type: 'error'; message: string | null }
  | { type: 'stale' }
  | { type: 'reset' };

export function initialMapLocationState(): MapLocationState {
  return {
    status: 'idle',
    position: null,
    accuracyMeters: null,
    timestamp: null,
    errorMessage: null,
    retryCount: 0,
  };
}

export function mapLocationReducer(state: MapLocationState, action: MapLocationAction): MapLocationState {
  switch (action.type) {
    case 'locating':
      return {
        ...state,
        status: 'locating',
        errorMessage: null,
        timestamp: null,
      };
    case 'position':
      return {
        ...state,
        status: 'ready',
        position: { latitude: action.position.latitude, longitude: action.position.longitude },
        accuracyMeters: action.accuracyMeters,
        timestamp: Date.now(),
        errorMessage: null,
      };
    case 'permission-denied':
      return {
        ...state,
        status: 'permission-denied',
        position: null,
        accuracyMeters: null,
        timestamp: null,
        errorMessage: null,
      };
    case 'services-disabled':
      return {
        ...state,
        status: 'services-disabled',
        position: null,
        accuracyMeters: null,
        timestamp: null,
        errorMessage: null,
      };
    case 'gps-unavailable':
      return {
        ...state,
        status: 'gps-unavailable',
        position: null,
        accuracyMeters: null,
        timestamp: null,
        errorMessage: null,
      };
    case 'inaccurate':
      return {
        ...state,
        status: 'inaccurate',
        errorMessage: null,
      };
    case 'timeout':
      return {
        ...state,
        status: 'error',
        position: null,
        accuracyMeters: null,
        timestamp: null,
        errorMessage: 'Map location request timed out.',
      };
    case 'error':
      return {
        ...state,
        status: 'error',
        errorMessage: action.message ?? 'Location unavailable.',
      };
    case 'stale':
      return { ...state, status: 'stale' };
    case 'reset':
      return initialMapLocationState();
  }
}

export function mapErrorKindForStatus(status: MapLocationStatus): MapErrorKind {
  switch (status) {
    case 'permission-denied':
      return 'permission-denied';
    case 'services-disabled':
      return 'services-disabled';
    case 'gps-unavailable':
      return 'gps-unavailable';
    case 'inaccurate':
      return 'inaccurate';
    case 'error':
      return 'unknown';
    default:
      return 'unknown';
  }
}

export function isMapLocationRecoverable(status: MapLocationStatus): boolean {
  return status === 'permission-denied' || status === 'services-disabled' || status === 'gps-unavailable' || status === 'error';
}

export function isPositionStale(positionAgeMs: number, maxStaleMs: number): boolean {
  return positionAgeMs > maxStaleMs;
}