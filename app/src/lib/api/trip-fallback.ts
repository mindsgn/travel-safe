import type { TripPlan, TripPoint } from './trips';

export function buildClientTripPlan(origin: TripPoint, destination: TripPoint): TripPlan {
  const west = Math.min(origin.longitude, destination.longitude);
  const east = Math.max(origin.longitude, destination.longitude);
  const south = Math.min(origin.latitude, destination.latitude);
  const north = Math.max(origin.latitude, destination.latitude);

  return {
    origin,
    destination,
    pathway: {
      coordinates: [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
      ],
      distance_meters: 0,
      duration_seconds: 0,
      provider: 'mock',
    },
    heatmap: {
      bbox: [west, south, east, north],
      zoom: 12,
      cells: [],
      normalization: '',
      caveats: ['Trip pathway fallback has no heatmap; heatmap cells come from the backend only.'],
    },
  };
}
