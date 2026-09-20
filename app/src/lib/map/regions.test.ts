import {
  cameraForRegion,
  DEFAULT_LATITUDE_DELTA,
  defaultRegionForCoordinate,
  latitudeDeltaForZoom,
  longitudeDeltaForZoom,
  regionBounds,
  regionCenter,
  regionForCamera,
  regionForCoordinates,
  regionForLatitudeLongitude,
  zoomForLatitudeDelta,
} from './regions';

describe('regionForCoordinates', () => {
  it('returns null for an empty coordinate array', () => {
    expect(regionForCoordinates([])).toBeNull();
  });

  it('returns a centered default region for a single coordinate', () => {
    const region = regionForCoordinates([{ latitude: -33.9249, longitude: 18.4241 }]);
    expect(region).not.toBeNull();
    expect(region?.latitude).toBeCloseTo(-33.9249);
    expect(region?.longitude).toBeCloseTo(18.4241);
    expect(region?.latitudeDelta).toBe(DEFAULT_LATITUDE_DELTA);
  });

  it('surrounds all coordinates with padding for a set of points', () => {
    const region = regionForCoordinates([
      { latitude: -33.9, longitude: 18.4 },
      { latitude: -33.95, longitude: 18.46 },
    ]);
    expect(region).not.toBeNull();
    expect(region?.latitude).toBeCloseTo(-33.925);
    expect(region?.longitude).toBeCloseTo(18.43);
    expect(region?.latitudeDelta).toBeGreaterThan(0.05 - 1e-9);
    expect(region?.longitudeDelta).toBeGreaterThan(0.06 - 1e-9);
  });

  it('ignores invalid coordinates and still builds from valid ones', () => {
    const region = regionForCoordinates([
      { latitude: -33.9, longitude: 18.4 },
      { latitude: 120, longitude: 18.4 },
    ] as never);
    expect(region).not.toBeNull();
    expect(region?.latitude).toBeCloseTo(-33.9);
  });

  it('clamps the region center to valid bounds', () => {
    const region = regionForCoordinates([
      { latitude: 89.9, longitude: 179.9 },
      { latitude: -89.9, longitude: -179.9 },
    ]);
    expect(region).not.toBeNull();
    expect(region?.latitude).toBeGreaterThanOrEqual(-90);
    expect(region?.latitude).toBeLessThanOrEqual(90);
    expect(region?.longitude).toBeGreaterThanOrEqual(-180);
    expect(region?.longitude).toBeLessThanOrEqual(180);
  });
});

describe('defaultRegionForCoordinate', () => {
  it('respects explicit deltas', () => {
    const region = defaultRegionForCoordinate(
      { latitude: -33.9, longitude: 18.4 },
      { latitudeDelta: 0.02, longitudeDelta: 0.03 },
    );
    expect(region).toEqual({
      latitude: -33.9,
      longitude: 18.4,
      latitudeDelta: 0.02,
      longitudeDelta: 0.03,
    });
  });
});

describe('regionForLatitudeLongitude', () => {
  it('returns a region for valid inputs', () => {
    expect(regionForLatitudeLongitude(-33.9, 18.4)).toMatchObject({
      latitude: -33.9,
      longitude: 18.4,
    });
  });

  it('returns null for invalid inputs', () => {
    expect(regionForLatitudeLongitude(200, 18.4)).toBeNull();
    expect(regionForLatitudeLongitude(-33.9, -200)).toBeNull();
    expect(regionForLatitudeLongitude(Number.NaN, 18)).toBeNull();
  });
});

describe('zoom helpers', () => {
  it('converts a zoom level to a latitude delta', () => {
    expect(latitudeDeltaForZoom(12)).toBeCloseTo(360 / 4096);
    expect(latitudeDeltaForZoom(14)).toBeCloseTo(360 / 16384);
  });

  it('round-trips zoom through a region', () => {
    const zoom = 13.5;
    const region = regionForCamera({ center: { latitude: -33.9, longitude: 18.4 }, zoom });
    expect(zoomForLatitudeDelta(region.latitudeDelta)).toBeCloseTo(zoom, 3);
    expect(cameraForRegion(region).center).toEqual({ latitude: -33.9, longitude: 18.4 });
  });

  it('keeps longitude delta relative to latitude', () => {
    expect(longitudeDeltaForZoom(12, 0)).toBeCloseTo(latitudeDeltaForZoom(12), 5);
    expect(longitudeDeltaForZoom(12, 60)).toBeGreaterThan(latitudeDeltaForZoom(12));
  });
});

describe('regionCenter and regionBounds', () => {
  const region = { latitude: -33.9, longitude: 18.4, latitudeDelta: 0.1, longitudeDelta: 0.12 };

  it('extracts the center', () => {
    expect(regionCenter(region)).toEqual({ latitude: -33.9, longitude: 18.4 });
  });

  it('computes the surrounding bounds', () => {
    expect(regionBounds(region).minLat).toBeCloseTo(-33.95);
    expect(regionBounds(region).maxLat).toBeCloseTo(-33.85);
    expect(regionBounds(region).minLng).toBeCloseTo(18.34);
    expect(regionBounds(region).maxLng).toBeCloseTo(18.46);
  });

  it('clamps bounds to the world limits', () => {
    const polar = { latitude: 89.99, longitude: 0, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    expect(regionBounds(polar).maxLat).toBeLessThanOrEqual(90);
  });
});