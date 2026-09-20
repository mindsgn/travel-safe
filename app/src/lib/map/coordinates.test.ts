import {
  clampCoordinate,
  clampLatitude,
  clampLongitude,
  isValidCoordinate,
  isValidLatitude,
  isValidLongitude,
} from './coordinates';

describe('isValidLatitude', () => {
  it.each([
    [0, true],
    [90, true],
    [-90, true],
    [-33.9249, true],
    [90.0001, false],
    [-90.0001, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [Number.NEGATIVE_INFINITY, false],
  ])('validates %p as %p', (value, expected) => {
    expect(isValidLatitude(value)).toBe(expected);
  });

  it('rejects non-numbers', () => {
    expect(isValidLatitude(null)).toBe(false);
    expect(isValidLatitude(undefined)).toBe(false);
    expect(isValidLatitude('12' as unknown)).toBe(false);
  });
});

describe('isValidLongitude', () => {
  it.each([
    [0, true],
    [180, true],
    [-180, true],
    [18.4241, true],
    [180.0001, false],
    [-180.0001, false],
    [Number.NaN, false],
  ])('validates %p as %p', (value, expected) => {
    expect(isValidLongitude(value)).toBe(expected);
  });

  it('rejects non-numbers', () => {
    expect(isValidLongitude(undefined)).toBe(false);
    expect(isValidLongitude('18' as unknown)).toBe(false);
  });
});

describe('isValidCoordinate', () => {
  it('accepts a valid latitude/longitude pair', () => {
    expect(isValidCoordinate({ latitude: -33.9249, longitude: 18.4241 })).toBe(true);
  });

  it('rejects latitude outside range', () => {
    expect(isValidCoordinate({ latitude: 95, longitude: 18.4241 })).toBe(false);
  });

  it('rejects longitude outside range', () => {
    expect(isValidCoordinate({ latitude: -33.9249, longitude: -181 })).toBe(false);
  });

  it('rejects missing coordinate values', () => {
    expect(isValidCoordinate({ latitude: -33.9249 } as never)).toBe(false);
    expect(isValidCoordinate({ longitude: 18.4241 } as never)).toBe(false);
  });

  it('rejects invalid numeric values', () => {
    expect(isValidCoordinate({ latitude: Number.NaN, longitude: 18.4241 })).toBe(false);
    expect(isValidCoordinate({ latitude: -33.9249, longitude: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isValidCoordinate(null)).toBe(false);
    expect(isValidCoordinate(undefined)).toBe(false);
  });
});

describe('clampCoordinate', () => {
  it('keeps in-range coordinates unchanged', () => {
    expect(clampCoordinate({ latitude: -33.9, longitude: 18.4 })).toEqual({
      latitude: -33.9,
      longitude: 18.4,
    });
  });

  it('clamps out-of-range values to the boundaries', () => {
    expect(clampCoordinate({ latitude: 120, longitude: 200 })).toEqual({
      latitude: 90,
      longitude: 180,
    });
    expect(clampCoordinate({ latitude: -120, longitude: -200 })).toEqual({
      latitude: -90,
      longitude: -180,
    });
  });

  it('keeps NaN inputs NaN when clamping', () => {
    expect(Number.isNaN(clampLatitude(Number.NaN))).toBe(true);
    expect(Number.isNaN(clampLongitude(Number.NaN))).toBe(true);
  });
});