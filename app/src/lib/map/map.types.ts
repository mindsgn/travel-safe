export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapCamera = {
  center: MapCoordinate;
  zoom: number;
};

export type MapMarkerKind = 'user' | 'emergency' | 'trusted-contact' | 'generic';

export type MapMarker = {
  id: string;
  coordinate: MapCoordinate;
  kind: MapMarkerKind;
  title?: string;
  description?: string;
  color?: string;
};

export type MapPolyline = {
  id: string;
  coordinates: MapCoordinate[];
  color?: string;
  width?: number;
};

export type MapCircle = {
  id: string;
  center: MapCoordinate;
  radiusMeters: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
};

export type MapErrorKind =
  | 'permission-denied'
  | 'services-disabled'
  | 'gps-unavailable'
  | 'inaccurate'
  | 'provider-failed'
  | 'timeout'
  | 'unknown';

export type MapError = {
  kind: MapErrorKind;
  message: string | null;
};

export type MapLocationStatus =
  | 'idle'
  | 'locating'
  | 'permission-denied'
  | 'services-disabled'
  | 'gps-unavailable'
  | 'inaccurate'
  | 'ready'
  | 'stale'
  | 'error';

export type MapLocationState = {
  status: MapLocationStatus;
  position: MapCoordinate | null;
  accuracyMeters: number | null;
  timestamp: number | null;
  errorMessage: string | null;
  retryCount: number;
};

export type MapLoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

export type MapViewState = {
  loadStatus: MapLoadStatus;
  error: MapError | null;
};