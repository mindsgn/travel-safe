import {
  buildHeatCircles,
  buildSafetyGrid,
  GRID_COLUMNS,
  GRID_ROWS,
  HEAT_CIRCLE_ALPHA,
  MOCK_SAFETY_ZONES,
  regionBounds,
  regionCenter,
  safetyColorForScore,
  safetyHexForScore,
} from './safety-map';

describe('regionBounds', () => {
  it('covers every mock zone and pads beyond the extremes', () => {
    const bounds = regionBounds(MOCK_SAFETY_ZONES);
    const latitudes = MOCK_SAFETY_ZONES.map((zone) => zone.latitude);
    const longitudes = MOCK_SAFETY_ZONES.map((zone) => zone.longitude);

    for (const zone of MOCK_SAFETY_ZONES) {
      expect(zone.latitude).toBeGreaterThanOrEqual(bounds.minLat);
      expect(zone.latitude).toBeLessThanOrEqual(bounds.maxLat);
      expect(zone.longitude).toBeGreaterThanOrEqual(bounds.minLng);
      expect(zone.longitude).toBeLessThanOrEqual(bounds.maxLng);
    }

    expect(bounds.minLat).toBeLessThan(Math.min(...latitudes));
    expect(bounds.maxLat).toBeGreaterThan(Math.max(...latitudes));
    expect(bounds.minLng).toBeLessThan(Math.min(...longitudes));
    expect(bounds.maxLng).toBeGreaterThan(Math.max(...longitudes));
  });
});

describe('regionCenter', () => {
  it('returns a point strictly inside the bounds', () => {
    const center = regionCenter(MOCK_SAFETY_ZONES);
    const bounds = regionBounds(MOCK_SAFETY_ZONES);

    expect(center.latitude).toBeGreaterThan(bounds.minLat);
    expect(center.latitude).toBeLessThan(bounds.maxLat);
    expect(center.longitude).toBeGreaterThan(bounds.minLng);
    expect(center.longitude).toBeLessThan(bounds.maxLng);
  });
});

describe('buildSafetyGrid', () => {
  it('creates a column-by-row grid of unique points', () => {
    const grid = buildSafetyGrid();
    expect(grid).toHaveLength(GRID_COLUMNS * GRID_ROWS);
    expect(new Set(grid.map((point) => point.id)).size).toBe(grid.length);
  });

  it('keeps every point within the region bounds', () => {
    const bounds = regionBounds(MOCK_SAFETY_ZONES);
    for (const point of buildSafetyGrid()) {
      expect(point.latitude).toBeGreaterThanOrEqual(bounds.minLat);
      expect(point.latitude).toBeLessThanOrEqual(bounds.maxLat);
      expect(point.longitude).toBeGreaterThanOrEqual(bounds.minLng);
      expect(point.longitude).toBeLessThanOrEqual(bounds.maxLng);
    }
  });
});

describe('buildHeatCircles', () => {
  it('exports one circle per grid cell with a positive radius', () => {
    const circles = buildHeatCircles();
    expect(circles).toHaveLength(GRID_COLUMNS * GRID_ROWS);

    for (const circle of circles) {
      expect(circle.radius).toBeGreaterThan(0);
      expect(circle.color).toMatch(/^rgba\(/);
    }
  });

  it('renders the colors with the default alpha channel', () => {
    const circles = buildHeatCircles(MOCK_SAFETY_ZONES);
    for (const circle of circles) {
      expect(circle.color).toContain(`${HEAT_CIRCLE_ALPHA}`);
    }
  });
});

describe('safetyColorForScore', () => {
  it.each([
    [0, 'rgba(229, 44, 45, 1)'],
    [50, 'rgba(245, 184, 0, 1)'],
    [100, 'rgba(76, 245, 107, 1)'],
  ])('maps score %d to the expected color', (score, expected) => {
    expect(safetyColorForScore(score)).toBe(expected);
  });

  it('honors the alpha channel argument', () => {
    expect(safetyColorForScore(100, 0.5)).toBe('rgba(76, 245, 107, 0.5)');
  });
});

describe('safetyHexForScore', () => {
  it.each([
    [0, '#e52c2d'],
    [50, '#f5b800'],
    [100, '#4cf56b'],
  ])('formats score %d as a hex color', (score, expected) => {
    expect(safetyHexForScore(score)).toBe(expected);
  });
});