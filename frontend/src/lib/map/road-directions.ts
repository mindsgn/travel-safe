import { getMapboxToken } from '@/lib/config';
import type { PathwayProvider, TripPathway, TripPlan, TripPoint, TripProfile } from '@/lib/api/trips';

const OSRM_DRIVING_URL = 'https://router.project-osrm.org/route/v1/driving';

export function isRoadFollowedPathway(pathway: TripPathway): boolean {
  return (pathway.provider === 'mapbox' || pathway.provider === 'osrm') && pathway.coordinates.length >= 3;
}

function parseLngLatCoordinates(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  const coordinates: [number, number][] = [];
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const longitude = pair[0];
    const latitude = pair[1];
    if (typeof longitude !== 'number' || typeof latitude !== 'number') continue;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    coordinates.push([longitude, latitude]);
  }
  return coordinates;
}

function pathwayFromRoute(
  route: { geometry?: { coordinates?: unknown }; distance?: unknown; duration?: unknown },
  provider: PathwayProvider,
): TripPathway | null {
  const coordinates = parseLngLatCoordinates(route.geometry?.coordinates);
  if (coordinates.length < 3) return null;
  return {
    coordinates,
    distance_meters: typeof route.distance === 'number' ? route.distance : 0,
    duration_seconds: typeof route.duration === 'number' ? route.duration : 0,
    provider,
  };
}

export async function fetchMapboxRoadPathway(
  origin: TripPoint,
  destination: TripPoint,
  profile: TripProfile = 'driving',
  options: { token?: string; fetchImpl?: typeof fetch } = {},
): Promise<TripPathway | null> {
  const token = options.token ?? getMapboxToken();
  if (!token) return null;
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    steps: 'false',
    access_token: token,
  });
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?${params.toString()}`;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const payload = (await response.json()) as { routes?: Array<{ geometry?: { coordinates?: unknown }; distance?: unknown; duration?: unknown }> };
    const route = payload.routes?.[0];
    if (!route) return null;
    return pathwayFromRoute(route, 'mapbox');
  } catch {
    return null;
  }
}

export async function fetchOsrmRoadPathway(
  origin: TripPoint,
  destination: TripPoint,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<TripPathway | null> {
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${OSRM_DRIVING_URL}/${coordinates}?overview=full&geometries=geojson`;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      code?: string;
      routes?: Array<{ geometry?: { coordinates?: unknown }; distance?: unknown; duration?: unknown }>;
    };
    if (payload.code && payload.code !== 'Ok') return null;
    const route = payload.routes?.[0];
    if (!route) return null;
    return pathwayFromRoute(route, 'osrm');
  } catch {
    return null;
  }
}

export async function fetchRoadPathway(
  origin: TripPoint,
  destination: TripPoint,
  profile: TripProfile = 'driving',
  options: { token?: string; fetchImpl?: typeof fetch } = {},
): Promise<TripPathway | null> {
  const mapbox = await fetchMapboxRoadPathway(origin, destination, profile, options);
  if (mapbox) return mapbox;
  return fetchOsrmRoadPathway(origin, destination, options);
}

export async function applyRoadPathway(
  plan: TripPlan,
  fetchRoute: typeof fetchRoadPathway = fetchRoadPathway,
): Promise<TripPlan> {
  if (isRoadFollowedPathway(plan.pathway)) return plan;
  const road = await fetchRoute(plan.origin, plan.destination);
  if (!road) return plan;
  return { ...plan, pathway: road };
}
