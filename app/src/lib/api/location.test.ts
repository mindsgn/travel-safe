import { fetchLocationHeatmap, parseLocationHeatmapResponse, registerDevice, saveUserLocation } from './location';

const HEATMAP = {
  latitude: -33.9249,
  longitude: 18.4241,
  heatmap: {
    bbox: [18.4, -33.96, 18.5, -33.89],
    zoom: 14,
    cells: [
      {
        id: 'loc-0-0',
        latitude: -33.93,
        longitude: 18.43,
        label: 'Safety heatmap',
        reported_crimes: 10,
        relative_intensity: 0.2,
        resolution: 'precinct_aggregate',
        source_id: 'sqlite-precincts',
      },
    ],
    normalization: 'idw',
    caveats: [],
  },
};

describe('location API', () => {
  it('parses a location heatmap payload', () => {
    expect(parseLocationHeatmapResponse(HEATMAP)?.heatmap.cells).toHaveLength(1);
    expect(parseLocationHeatmapResponse({})).toBeNull();
  });

  it('posts a ping that returns nothing', async () => {
    const request = jest.fn().mockResolvedValue(undefined);
    await saveUserLocation(
      { deviceCode: 'TS-ABC12345', latitude: -33.92, longitude: 18.42, accuracyMeters: 9 },
      request,
    );
    expect(request).toHaveBeenCalledWith(
      '/api/v1/devices/TS-ABC12345/location',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches a location heatmap', async () => {
    const request = jest.fn().mockResolvedValue(HEATMAP);
    const result = await fetchLocationHeatmap(
      { deviceCode: 'TS-ABC12345', latitude: -33.9249, longitude: 18.4241 },
      request,
    );
    expect(result.heatmap.cells[0]?.id).toBe('loc-0-0');
  });

  it('throws when the heatmap payload is invalid', async () => {
    await expect(
      fetchLocationHeatmap(
        { deviceCode: 'TS-ABC12345', latitude: -33.9, longitude: 18.4 },
        jest.fn().mockResolvedValue({}),
      ),
    ).rejects.toThrow('Location heatmap response was invalid');
  });

  it('registers a device code', async () => {
    const request = jest.fn().mockResolvedValue({ device_code: 'TS-ABC12345' });
    await expect(registerDevice('TS-ABC12345', request)).resolves.toBe('TS-ABC12345');
  });
});
