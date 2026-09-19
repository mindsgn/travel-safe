import { applyRoadPathway, fetchOsrmRoadPathway, isRoadFollowedPathway } from './road-directions';
import type { TripPlan } from '@/lib/api/trips';

const ORIGIN = { latitude: -33.9249, longitude: 18.4241, label: 'CBD' };
const DESTINATION = { latitude: -33.927, longitude: 18.447, label: 'Woodstock' };

const PLAN: TripPlan = {
  origin: ORIGIN,
  destination: DESTINATION,
  pathway: {
    coordinates: [
      [18.4241, -33.9249],
      [18.447, -33.927],
    ],
    distance_meters: 0,
    duration_seconds: 0,
    provider: 'mock',
  },
  heatmap: {
    bbox: [18.4, -33.96, 18.5, -33.89],
    zoom: 12,
    cells: [],
    normalization: 'mock',
    caveats: [],
  },
};

describe('road directions', () => {
  it('treats mapbox/osrm polylines with 3+ points as road-followed', () => {
    expect(isRoadFollowedPathway(PLAN.pathway)).toBe(false);
    expect(
      isRoadFollowedPathway({
        ...PLAN.pathway,
        provider: 'osrm',
        coordinates: [
          [18.42, -33.92],
          [18.43, -33.925],
          [18.45, -33.93],
        ],
      }),
    ).toBe(true);
  });

  it('parses an OSRM geojson route', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            distance: 2600,
            duration: 400,
            geometry: {
              coordinates: [
                [18.4241, -33.9249],
                [18.431, -33.9255],
                [18.447, -33.927],
              ],
            },
          },
        ],
      }),
    });
    const pathway = await fetchOsrmRoadPathway(ORIGIN, DESTINATION, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(pathway?.provider).toBe('osrm');
    expect(pathway?.coordinates).toHaveLength(3);
  });

  it('replaces a straight mock pathway with a fetched road polyline', async () => {
    const fetchRoute = jest.fn().mockResolvedValue({
      coordinates: [
        [18.4241, -33.9249],
        [18.431, -33.9255],
        [18.447, -33.927],
      ],
      distance_meters: 2600,
      duration_seconds: 400,
      provider: 'osrm',
    });
    const next = await applyRoadPathway(PLAN, fetchRoute);
    expect(next.pathway.provider).toBe('osrm');
    expect(next.pathway.coordinates).toHaveLength(3);
  });
});
