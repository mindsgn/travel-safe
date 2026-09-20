import { getMapboxToken } from '@/lib/config';
import { isValidCoordinate } from '@/lib/map/coordinates';
import type { MapCoordinate } from '@/lib/map/map.types';

export type PlaceSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export const MOCK_PLACES: readonly PlaceSuggestion[] = [
  { id: 'cbd', label: 'Cape Town CBD', latitude: -33.9249, longitude: 18.4241 },
  { id: 'woodstock', label: 'Woodstock, Cape Town', latitude: -33.927, longitude: 18.447 },
  { id: 'gardens', label: 'Gardens, Cape Town', latitude: -33.9349, longitude: 18.4143 },
  { id: 'green-point', label: 'Green Point, Cape Town', latitude: -33.9054, longitude: 18.4011 },
  { id: 'sea-point', label: 'Sea Point, Cape Town', latitude: -33.9181, longitude: 18.3861 },
];

export function filterMockPlaces(query: string, places: readonly PlaceSuggestion[] = MOCK_PLACES): PlaceSuggestion[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  return places.filter((place) => place.label.toLowerCase().includes(needle)).slice(0, 5);
}

export function mapGeocodingFeature(value: unknown): PlaceSuggestion | null {
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

export async function searchPlaces(query: string, options: SearchPlacesOptions = {}): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const token = options.token ?? getMapboxToken();
  if (!token) {
    return filterMockPlaces(trimmed);
  }

  const params = new URLSearchParams({
    access_token: token,
    limit: '5',
    autocomplete: 'true',
  });
  if (options.proximity) {
    params.set('proximity', `${options.proximity.longitude},${options.proximity.latitude}`);
  }

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
