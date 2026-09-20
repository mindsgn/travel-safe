import { apiRequest } from '@/lib/api/client';
import { isValidCoordinate } from '@/lib/map/coordinates';
import type { MapCoordinate } from '@/lib/map/map.types';

export type TripProfile = 'walking' | 'driving';
export type PathwayProvider = 'mapbox' | 'osrm' | 'mock';

export type TripPoint = MapCoordinate & {
  label?: string;
};

export type HeatmapCell = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  reported_crimes: number;
  relative_intensity: number;
  resolution: string;
  source_id: string;
};

export type TripHeatmap = {
  bbox: [number, number, number, number];
  zoom: number;
  cells: HeatmapCell[];
  normalization: string;
  caveats: string[];
};

export type TripPathway = {
  coordinates: [number, number][];
  distance_meters: number;
  duration_seconds: number;
  provider: PathwayProvider;
};

export type TripPlan = {
  origin: TripPoint;
  destination: TripPoint;
  pathway: TripPathway;
  heatmap: TripHeatmap;
};

export type CreateTripInput = {
  origin: TripPoint;
  destination: TripPoint;
  profile?: TripProfile;
  deviceCode?: string;
};

function isLngLatPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1])
  );
}

export function parseTripPoint(value: unknown): TripPoint | null {
  if (value == null || typeof value !== 'object') return null;
  const candidate = value as { latitude?: unknown; longitude?: unknown; label?: unknown };
  if (!isValidCoordinate(candidate)) return null;
  const point: TripPoint = { latitude: candidate.latitude, longitude: candidate.longitude };
  if (typeof candidate.label === 'string' && candidate.label.length > 0) {
    point.label = candidate.label;
  }
  return point;
}

export function parseTripHeatmap(value: unknown): TripHeatmap | null {
  if (value == null || typeof value !== 'object') return null;
  const candidate = value as {
    bbox?: unknown;
    zoom?: unknown;
    cells?: unknown;
    normalization?: unknown;
    caveats?: unknown;
  };
  const cells = Array.isArray(candidate.cells)
    ? candidate.cells.map(parseHeatmapCell).filter((cell): cell is HeatmapCell => cell != null)
    : [];
  const bboxRaw = candidate.bbox;
  const bbox: [number, number, number, number] =
    Array.isArray(bboxRaw) && bboxRaw.length === 4 && bboxRaw.every((item) => typeof item === 'number')
      ? [bboxRaw[0], bboxRaw[1], bboxRaw[2], bboxRaw[3]]
      : [0, 0, 0, 0];
  return {
    bbox,
    zoom: typeof candidate.zoom === 'number' ? candidate.zoom : 12,
    cells,
    normalization: typeof candidate.normalization === 'string' ? candidate.normalization : '',
    caveats: Array.isArray(candidate.caveats)
      ? candidate.caveats.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

export function parseHeatmapCell(value: unknown): HeatmapCell | null {
  if (value == null || typeof value !== 'object') return null;
  const candidate = value as HeatmapCell;
  if (typeof candidate.id !== 'string') return null;
  if (!isValidCoordinate({ latitude: candidate.latitude, longitude: candidate.longitude })) return null;
  if (typeof candidate.relative_intensity !== 'number' || !Number.isFinite(candidate.relative_intensity)) {
    return null;
  }
  return {
    id: candidate.id,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    label: typeof candidate.label === 'string' ? candidate.label : '',
    reported_crimes: typeof candidate.reported_crimes === 'number' ? candidate.reported_crimes : 0,
    relative_intensity: Math.min(1, Math.max(0, candidate.relative_intensity)),
    resolution: typeof candidate.resolution === 'string' ? candidate.resolution : 'precinct_aggregate',
    source_id: typeof candidate.source_id === 'string' ? candidate.source_id : 'unknown',
  };
}

export function parseTripResponse(value: unknown): TripPlan | null {
  if (value == null || typeof value !== 'object') return null;
  const candidate = value as {
    origin?: unknown;
    destination?: unknown;
    pathway?: {
      coordinates?: unknown;
      distance_meters?: unknown;
      duration_seconds?: unknown;
      provider?: unknown;
    };
    heatmap?: unknown;
  };

  const origin = parseTripPoint(candidate.origin);
  const destination = parseTripPoint(candidate.destination);
  const coordinates = Array.isArray(candidate.pathway?.coordinates)
    ? candidate.pathway.coordinates.filter(isLngLatPair)
    : [];
  if (!origin || !destination || coordinates.length < 2) return null;

  const heatmap = parseTripHeatmap(candidate.heatmap) ?? {
    bbox: [0, 0, 0, 0],
    zoom: 12,
    cells: [],
    normalization: '',
    caveats: [],
  };

  const provider =
    candidate.pathway?.provider === 'mapbox' || candidate.pathway?.provider === 'osrm'
      ? candidate.pathway.provider
      : 'mock';

  return {
    origin,
    destination,
    pathway: {
      coordinates,
      distance_meters:
        typeof candidate.pathway?.distance_meters === 'number' ? candidate.pathway.distance_meters : 0,
      duration_seconds:
        typeof candidate.pathway?.duration_seconds === 'number' ? candidate.pathway.duration_seconds : 0,
      provider,
    },
    heatmap,
  };
}

export async function createTrip(
  input: CreateTripInput,
  request: typeof apiRequest = apiRequest,
): Promise<TripPlan> {
  const payload = await request<unknown>('/api/v1/trips', {
    method: 'POST',
    body: {
      origin: input.origin,
      destination: input.destination,
      profile: input.profile ?? 'driving',
      device_code: input.deviceCode,
    },
  });
  const parsed = parseTripResponse(payload);
  if (!parsed) {
    throw new Error('Trip response was invalid');
  }
  return parsed;
}
