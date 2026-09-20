import { metersBetween } from './location';

describe('metersBetween', () => {
  it('returns 0 for identical coordinates', () => {
    const point = { latitude: -33.9249, longitude: 18.4241 };
    expect(metersBetween(point, point)).toBe(0);
  });

  it('measures an east-west degree at the equator', () => {
    const meters = metersBetween({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 });
    expect(meters).toBeGreaterThan(111_100);
    expect(meters).toBeLessThan(111_300);
  });

  it('measures a north-south degree', () => {
    const meters = metersBetween({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(meters).toBeGreaterThan(111_100);
    expect(meters).toBeLessThan(111_300);
  });

  it('matches the approximate distance between Cape Town and Johannesburg', () => {
    const capeTown = { latitude: -33.9249, longitude: 18.4241 };
    const johannesburg = { latitude: -26.2041, longitude: 28.0473 };
    const meters = metersBetween(capeTown, johannesburg);
    expect(meters).toBeGreaterThan(1_250_000);
    expect(meters).toBeLessThan(1_320_000);
  });

  it('is symmetric', () => {
    const a = { latitude: -33.9, longitude: 18.4 };
    const b = { latitude: -33.9005, longitude: 18.4012 };
    expect(metersBetween(a, b)).toBeCloseTo(metersBetween(b, a), 6);
  });
});