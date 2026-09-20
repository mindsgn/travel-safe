import { filterMockPlaces, mapGeocodingFeature, MOCK_PLACES, searchPlaces } from './geocoding';

describe('geocoding', () => {
  it('filters mock places by query', () => {
    expect(filterMockPlaces('wo')).toEqual([
      expect.objectContaining({ id: 'woodstock', label: 'Woodstock, Cape Town' }),
    ]);
    expect(filterMockPlaces('x')).toEqual([]);
  });

  it('maps Mapbox geocoding features', () => {
    expect(
      mapGeocodingFeature({
        id: 'place.1',
        place_name: 'Woodstock, Cape Town',
        center: [18.447, -33.927],
      }),
    ).toEqual({
      id: 'place.1',
      label: 'Woodstock, Cape Town',
      latitude: -33.927,
      longitude: 18.447,
    });
    expect(mapGeocodingFeature({ center: [18.447] })).toBeNull();
  });

  it('returns mock places when no token is configured', async () => {
    const results = await searchPlaces('cape', { token: '' });
    expect(results.some((place) => place.id === 'cbd')).toBe(true);
    expect(MOCK_PLACES.length).toBeGreaterThan(0);
  });

  it('maps live geocoding results when Mapbox responds', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ id: 'live.1', place_name: 'Gardens', center: [18.4143, -33.9349] }],
      }),
    });
    const results = await searchPlaces('gardens', {
      token: 'pk.test',
      proximity: { latitude: -33.92, longitude: 18.42 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useMockFallback: false,
    });
    expect(results).toEqual([
      { id: 'live.1', label: 'Gardens', latitude: -33.9349, longitude: 18.4143 },
    ]);
  });

  it('falls back to mock places when Mapbox fails', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
    const results = await searchPlaces('wood', {
      token: 'pk.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(results[0]?.id).toBe('woodstock');
  });
});
