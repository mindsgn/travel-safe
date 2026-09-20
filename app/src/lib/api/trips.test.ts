import { createTrip, parseHeatmapCell, parseTripPoint, parseTripResponse } from './trips';

const SAMPLE = {
  origin: { latitude: -33.9249, longitude: 18.4241, label: 'CBD' },
  destination: { latitude: -33.927, longitude: 18.447, label: 'Woodstock' },
  pathway: {
    coordinates: [
      [18.4241, -33.9249],
      [18.447, -33.927],
    ],
    distance_meters: 2100,
    duration_seconds: 900,
    provider: 'mock',
  },
  heatmap: {
    bbox: [18.4, -33.96, 18.5, -33.89],
    zoom: 12,
    cells: [
      {
        id: 'cell-1',
        latitude: -33.93,
        longitude: 18.43,
        label: 'Mock',
        reported_crimes: 12,
        relative_intensity: 0.4,
        resolution: 'precinct_aggregate',
        source_id: 'mock-corridor',
      },
    ],
    normalization: 'mock',
    caveats: ['not crime-event pins'],
  },
};

describe('trips', () => {
  it('parses a trip point and ignores invalid coordinates', () => {
    expect(parseTripPoint(SAMPLE.origin)).toEqual(SAMPLE.origin);
    expect(parseTripPoint({ latitude: 200, longitude: 18 })).toBeNull();
  });

  it('parses heatmap cells and clamps intensity', () => {
    expect(parseHeatmapCell(SAMPLE.heatmap.cells[0])?.relative_intensity).toBe(0.4);
    expect(
      parseHeatmapCell({
        ...SAMPLE.heatmap.cells[0],
        relative_intensity: 4,
      })?.relative_intensity,
    ).toBe(1);
    expect(parseHeatmapCell({ id: 'x' })).toBeNull();
  });

  it('parses a trip response', () => {
    const parsed = parseTripResponse(SAMPLE);
    expect(parsed?.pathway.coordinates).toHaveLength(2);
    expect(parsed?.heatmap.cells).toHaveLength(1);
    expect(parsed?.origin.label).toBe('CBD');
  });

  it('rejects incomplete trip payloads', () => {
    expect(parseTripResponse({})).toBeNull();
    expect(parseTripResponse({ ...SAMPLE, pathway: { coordinates: [[18, -33]] } })).toBeNull();
  });

  it('creates a trip through the API helper', async () => {
    const request = jest.fn().mockResolvedValue(SAMPLE);
    const plan = await createTrip(
      {
        origin: SAMPLE.origin,
        destination: SAMPLE.destination,
      },
      request,
    );
    expect(plan.destination.label).toBe('Woodstock');
    expect(request).toHaveBeenCalledWith(
      '/api/v1/trips',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ profile: 'driving' }),
      }),
    );
  });

  it('throws when the trip payload is invalid', async () => {
    await expect(createTrip(SAMPLE.origin as never, jest.fn().mockResolvedValue({}))).rejects.toThrow(
      'Trip response was invalid',
    );
  });
});
