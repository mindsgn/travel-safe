import {
  filterMockPlaces,
  isSouthAfricanCoordinate,
  isSouthAfricanGeocodingFeature,
  mapGeocodingFeature,
  MOCK_PLACES,
  searchPlaces,
  southAfricaSearchParams,
} from './geocoding';

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

  it('keeps only South African coordinates and country codes', () => {
    expect(isSouthAfricanCoordinate({ latitude: -33.9249, longitude: 18.4241 })).toBe(true);
    expect(isSouthAfricanCoordinate({ latitude: 51.5074, longitude: -0.1278 })).toBe(false);
    expect(
      isSouthAfricanGeocodingFeature({
        center: [18.447, -33.927],
        context: [{ id: 'country.1', short_code: 'za' }],
      }),
    ).toBe(true);
    expect(
      mapGeocodingFeature({
        id: 'place.uk',
        place_name: 'London, United Kingdom',
        center: [-0.1278, 51.5074],
        context: [{ id: 'country.1', short_code: 'gb' }],
      }),
    ).toBeNull();
  });

  it('scopes Mapbox search to South Africa', () => {
    const params = southAfricaSearchParams('pk.test', { latitude: -33.92, longitude: 18.42 });
    expect(params.get('country')).toBe('za');
    expect(params.get('bbox')).toContain('16.3');
    expect(params.get('proximity')).toBe('18.42,-33.92');
    expect(southAfricaSearchParams('pk.test', { latitude: 40.7, longitude: -74 }).get('proximity')).toBeNull();
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
    expect(String(fetchImpl.mock.calls[0][0])).toContain('country=za');
  });

  it('drops non-South African live results', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: 'place.uk',
            place_name: 'London, United Kingdom',
            center: [-0.1278, 51.5074],
            context: [{ id: 'country.1', short_code: 'gb' }],
          },
        ],
      }),
    });
    const results = await searchPlaces('london', {
      token: 'pk.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useMockFallback: false,
    });
    expect(results).toEqual([]);
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
