import { getMapboxToken } from '@/lib/config';
import { isValidCoordinate } from '@/lib/map/coordinates';
import type { MapCoordinate } from '@/lib/map/map.types';

export type PlaceSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export const SOUTH_AFRICA_COUNTRY_CODE = 'za';

/** Inclusive geographic box used as a hard filter on search results. */
export const SOUTH_AFRICA_BBOX = {
  minLatitude: -34.9,
  maxLatitude: -22.1,
  minLongitude: 16.3,
  maxLongitude: 33.0,
} as const;

export const MOCK_PLACES: readonly PlaceSuggestion[] = [
  { id: 'cbd', label: 'Cape Town CBD', latitude: -33.9249, longitude: 18.4241 },
  { id: 'woodstock', label: 'Woodstock, Cape Town', latitude: -33.927, longitude: 18.447 },
  { id: 'gardens', label: 'Gardens, Cape Town', latitude: -33.9349, longitude: 18.4143 },
  { id: 'green-point', label: 'Green Point, Cape Town', latitude: -33.9054, longitude: 18.4011 },
  { id: 'sea-point', label: 'Sea Point, Cape Town', latitude: -33.9181, longitude: 18.3861 },
];

export function isSouthAfricanCoordinate(coordinate: { latitude: number; longitude: number }): boolean {
  return (
    coordinate.latitude >= SOUTH_AFRICA_BBOX.minLatitude &&
    coordinate.latitude <= SOUTH_AFRICA_BBOX.maxLatitude &&
    coordinate.longitude >= SOUTH_AFRICA_BBOX.minLongitude &&
    coordinate.longitude <= SOUTH_AFRICA_BBOX.maxLongitude
  );
}

export function southAfricaCountryCodeFromFeature(value: unknown): string | null {
  if (value == null || typeof value !== 'object') return null;
  const feature = value as {
    properties?: { short_code?: unknown };
    context?: unknown;
  };
  const propertyCode = feature.properties?.short_code;
  if (typeof propertyCode === 'string' && propertyCode.length > 0) {
    return propertyCode.toLowerCase();
  }
  if (!Array.isArray(feature.context)) return null;
  for (const entry of feature.context) {
    if (entry == null || typeof entry !== 'object') continue;
    const item = entry as { id?: unknown; short_code?: unknown };
    const id = typeof item.id === 'string' ? item.id : '';
    const code = typeof item.short_code === 'string' ? item.short_code.toLowerCase() : '';
    if (id.startsWith('country.') && code) return code;
  }
  return null;
}

export function isSouthAfricanGeocodingFeature(value: unknown): boolean {
  const country = southAfricaCountryCodeFromFeature(value);
  if (country && country !== SOUTH_AFRICA_COUNTRY_CODE) return false;
  if (value == null || typeof value !== 'object') return false;
  const center = (value as { center?: unknown }).center;
  if (!Array.isArray(center) || center.length < 2) return false;
  const longitude = center[0];
  const latitude = center[1];
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  return isSouthAfricanCoordinate({ latitude, longitude });
}

export function filterMockPlaces(query: string, places: readonly PlaceSuggestion[] = MOCK_PLACES): PlaceSuggestion[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  return places
    .filter((place) => isSouthAfricanCoordinate(place) && place.label.toLowerCase().includes(needle))
    .slice(0, 5);
}

export function mapGeocodingFeature(value: unknown): PlaceSuggestion | null {
  if (!isSouthAfricanGeocodingFeature(value)) return null;
  if (value == null || typeof value !== 'object') return null;
  const feature = value as {
    id?: unknown;
    place_name?: unknown;
    text?: unknown;
    center?: unknown;
  };
  const center = feature.center;
  if (!Array.isArray(center) || center.length < 2) return null;
  const longitude = center[0];
  const latitude = center[1];
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!isValidCoordinate({ latitude, longitude })) return null;
  const label =
    (typeof feature.place_name === 'string' && feature.place_name) ||
    (typeof feature.text === 'string' && feature.text) ||
    '';
  if (!label) return null;
  const id = typeof feature.id === 'string' && feature.id.length > 0 ? feature.id : `${longitude},${latitude}`;
  return { id, label, latitude, longitude };
}

export type SearchPlacesOptions = {
  proximity?: MapCoordinate | null;
  token?: string;
  fetchImpl?: typeof fetch;
  useMockFallback?: boolean;
};

export function southAfricaSearchParams(token: string, proximity?: MapCoordinate | null): URLSearchParams {
  const params = new URLSearchParams({
    access_token: token,
    limit: '5',
    autocomplete: 'true',
    country: SOUTH_AFRICA_COUNTRY_CODE,
    bbox: [
      SOUTH_AFRICA_BBOX.minLongitude,
      SOUTH_AFRICA_BBOX.minLatitude,
      SOUTH_AFRICA_BBOX.maxLongitude,
      SOUTH_AFRICA_BBOX.maxLatitude,
    ].join(','),
  });
  if (proximity && isSouthAfricanCoordinate(proximity)) {
    params.set('proximity', `${proximity.longitude},${proximity.latitude}`);
  }
  return params;
}

export async function searchPlaces(query: string, options: SearchPlacesOptions = {}): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const token = options.token ?? getMapboxToken();
  if (!token) {
    return filterMockPlaces(trimmed);
  }

  const params = southAfricaSearchParams(token, options.proximity);
  const encoded = encodeURIComponent(trimmed);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?${params.toString()}`;
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url);
    if (!response.ok) {
      if (options.useMockFallback !== false) return filterMockPlaces(trimmed);
      return [];
    }
    const payload = (await response.json()) as { features?: unknown };
    const features = Array.isArray(payload.features) ? payload.features : [];
    const mapped = features.map(mapGeocodingFeature).filter((item): item is PlaceSuggestion => item != null);
    if (mapped.length === 0 && options.useMockFallback !== false) return filterMockPlaces(trimmed);
    return mapped;
  } catch {
    if (options.useMockFallback !== false) return filterMockPlaces(trimmed);
    return [];
  }
}
