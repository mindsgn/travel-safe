import { apiRequest } from '@/lib/api/client';
import { parseTripHeatmap, type TripHeatmap } from '@/lib/api/trips';
import type { LivePosition } from '@/lib/location';

export type LocationPingInput = LivePosition & {
  accuracyMeters?: number | null;
  deviceCode: string;
};

export type LocationHeatmap = {
  latitude: number;
  longitude: number;
  heatmap: TripHeatmap;
};

export function parseLocationHeatmapResponse(value: unknown): LocationHeatmap | null {
  if (value == null || typeof value !== 'object') return null;
  const candidate = value as { latitude?: unknown; longitude?: unknown; heatmap?: unknown };
  if (typeof candidate.latitude !== 'number' || typeof candidate.longitude !== 'number') return null;
  const heatmap = parseTripHeatmap(candidate.heatmap);
  if (!heatmap) return null;
  return {
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    heatmap,
  };
}

export async function saveUserLocation(
  input: LocationPingInput,
  request: typeof apiRequest = apiRequest,
): Promise<void> {
  await request(`/api/v1/devices/${encodeURIComponent(input.deviceCode)}/location`, {
    method: 'POST',
    body: {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy_meters: input.accuracyMeters ?? null,
    },
  });
}

export async function fetchLocationHeatmap(
  input: LocationPingInput,
  request: typeof apiRequest = apiRequest,
): Promise<LocationHeatmap> {
  const payload = await request<unknown>(
    `/api/v1/devices/${encodeURIComponent(input.deviceCode)}/location/heatmap`,
    {
      method: 'POST',
      body: {
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy_meters: input.accuracyMeters ?? null,
      },
    },
  );
  const parsed = parseLocationHeatmapResponse(payload);
  if (!parsed) {
    throw new Error('Location heatmap response was invalid');
  }
  return parsed;
}

export async function registerDevice(
  deviceCode: string,
  request: typeof apiRequest = apiRequest,
): Promise<string> {
  const payload = await request<{ device_code?: unknown }>('/api/v1/devices', {
    method: 'POST',
    body: { device_code: deviceCode },
  });
  return typeof payload?.device_code === 'string' ? payload.device_code : deviceCode;
}
