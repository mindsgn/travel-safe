export type SafetyZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  safetyScore: number;
};

export type SafetyGridPoint = {
  id: string;
  latitude: number;
  longitude: number;
  score: number;
};

export type HeatCircle = {
  id: string;
  center: { latitude: number; longitude: number };
  radius: number;
  color: string;
};

export const GRID_COLUMNS = 9;
export const GRID_ROWS = 9;
export const HEAT_CIRCLE_ALPHA = 0.55;
export const DEFAULT_MAP_ZOOM = 12.2;
export const CENTER_DEFAULT_SCORE = 50;

const METERS_PER_LAT_DEGREE = 110_540;
const METERS_PER_LNG_DEGREE = 111_320;
const IDW_EPSILON = 1e-6;

const DANGER_RED = { r: 229, g: 44, b: 45 };
const CAUTION_AMBER = { r: 245, g: 184, b: 0 };
const SAFE_GREEN = { r: 76, g: 245, b: 107 };

type RGB = { r: number; g: number; b: number };

const SAFETY_STOPS: readonly { readonly t: number; readonly rgb: RGB }[] = [
  { t: 0, rgb: DANGER_RED },
  { t: 0.5, rgb: CAUTION_AMBER },
  { t: 1, rgb: SAFE_GREEN },
];

export const MOCK_SAFETY_ZONES: SafetyZone[] = [
  { id: 'city-bowl', name: 'City Bowl', latitude: -33.9249, longitude: 18.4241, safetyScore: 64 },
  { id: 'harbour', name: 'Harbour District', latitude: -33.9043, longitude: 18.4204, safetyScore: 81 },
  { id: 'green-point', name: 'Green Point', latitude: -33.9054, longitude: 18.4011, safetyScore: 85 },
  { id: 'seafront', name: 'Seafront', latitude: -33.9181, longitude: 18.3861, safetyScore: 88 },
  { id: 'old-quarter', name: 'Old Quarter', latitude: -33.9213, longitude: 18.4153, safetyScore: 42 },
  { id: 'northside', name: 'Northside', latitude: -33.9392, longitude: 18.4309, safetyScore: 36 },
  { id: 'industrial', name: 'Industrial Park', latitude: -33.9369, longitude: 18.4577, safetyScore: 24 },
  { id: 'riverside', name: 'Riverside', latitude: -33.9376, longitude: 18.4668, safetyScore: 54 },
  { id: 'station', name: 'Station Quarter', latitude: -33.9216, longitude: 18.4266, safetyScore: 49 },
  { id: 'parkside', name: 'Parkside', latitude: -33.9483, longitude: 18.4415, safetyScore: 71 },
  { id: 'gardens', name: 'Gardens', latitude: -33.9349, longitude: 18.4143, safetyScore: 58 },
  { id: 'bayview', name: 'Bayview', latitude: -33.9516, longitude: 18.3825, safetyScore: 91 },
];

export type RegionBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
};

export function regionBounds(zones: SafetyZone[], paddingFraction = 0.12): RegionBounds {
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  for (const zone of zones) {
    minLat = Math.min(minLat, zone.latitude);
    maxLat = Math.max(maxLat, zone.latitude);
    minLng = Math.min(minLng, zone.longitude);
    maxLng = Math.max(maxLng, zone.longitude);
  }

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const latPadding = latSpan * paddingFraction || 0.02;
  const lngPadding = lngSpan * paddingFraction || 0.02;

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
    centerLat: (minLat + maxLat) / 2,
    centerLng: (minLng + maxLng) / 2,
  };
}

export function regionCenter(zones: SafetyZone[]): { latitude: number; longitude: number } {
  const bounds = regionBounds(zones);
  return { latitude: bounds.centerLat, longitude: bounds.centerLng };
}

function interpolateScore(latitude: number, longitude: number, zones: SafetyZone[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const zone of zones) {
    const dLat = latitude - zone.latitude;
    const dLng = longitude - zone.longitude;
    const distanceSquared = dLat * dLat + dLng * dLng;
    const weight = 1 / (distanceSquared + IDW_EPSILON);
    weightedSum += weight * zone.safetyScore;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : CENTER_DEFAULT_SCORE;
}

export function buildSafetyGrid(
  zones: SafetyZone[] = MOCK_SAFETY_ZONES,
  columns = GRID_COLUMNS,
  rows = GRID_ROWS,
): SafetyGridPoint[] {
  const bounds = regionBounds(zones);
  const points: SafetyGridPoint[] = [];

  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const tX = columns === 1 ? 0.5 : i / (columns - 1);
      const tY = rows === 1 ? 0.5 : j / (rows - 1);
      const latitude = bounds.minLat + tY * (bounds.maxLat - bounds.minLat);
      const longitude = bounds.minLng + tX * (bounds.maxLng - bounds.minLng);

      points.push({
        id: `cell-${i}-${j}`,
        latitude,
        longitude,
        score: interpolateScore(latitude, longitude, zones),
      });
    }
  }

  return points;
}

function cellRadiusMeters(zones: SafetyZone[], columns: number, rows: number): number {
  const bounds = regionBounds(zones);
  const cellLat = (bounds.maxLat - bounds.minLat) / rows;
  const cellLng = (bounds.maxLng - bounds.minLng) / columns;
  const latMeters = Math.abs(cellLat) * METERS_PER_LAT_DEGREE;
  const lngMeters = Math.abs(cellLng) * METERS_PER_LNG_DEGREE * Math.cos((bounds.centerLat * Math.PI) / 180);
  return Math.sqrt(latMeters * latMeters + lngMeters * lngMeters) / 2;
}

export function buildHeatCircles(
  zones: SafetyZone[] = MOCK_SAFETY_ZONES,
  options: { columns?: number; rows?: number; alpha?: number } = {},
): HeatCircle[] {
  const columns = options.columns ?? GRID_COLUMNS;
  const rows = options.rows ?? GRID_ROWS;
  const alpha = options.alpha ?? HEAT_CIRCLE_ALPHA;
  const grid = buildSafetyGrid(zones, columns, rows);
  const radius = Math.round(cellRadiusMeters(zones, columns, rows));

  return grid.map((point) => ({
    id: `heat-${point.id}`,
    center: { latitude: point.latitude, longitude: point.longitude },
    radius,
    color: safetyColorForScore(point.score, alpha),
  }));
}

function interpolateSafetyRgb(score: number): RGB {
  const t = Math.min(1, Math.max(0, score / 100));

  let lower = SAFETY_STOPS[0];
  let upper = SAFETY_STOPS[SAFETY_STOPS.length - 1];

  for (let i = 0; i < SAFETY_STOPS.length - 1; i++) {
    const next = SAFETY_STOPS[i + 1];
    if (t <= next.t) {
      lower = SAFETY_STOPS[i];
      upper = next;
      break;
    }
  }

  const span = upper.t - lower.t;
  const progress = span === 0 ? 0 : (t - lower.t) / span;
  const channel = (from: number, to: number) => Math.round(from + (to - from) * progress);

  return {
    r: channel(lower.rgb.r, upper.rgb.r),
    g: channel(lower.rgb.g, upper.rgb.g),
    b: channel(lower.rgb.b, upper.rgb.b),
  };
}

export function safetyColorForScore(score: number, alpha = 1): string {
  const { r, g, b } = interpolateSafetyRgb(score);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function safetyHexForScore(score: number): string {
  const { r, g, b } = interpolateSafetyRgb(score);
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}