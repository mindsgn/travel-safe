import {
  computeDeadline,
  DAY_MS,
  formatDuration,
  formatInterval,
  HOUR_MS,
  INTERVAL_PRESETS,
  isExpired,
  isValidInterval,
  MINUTE_MS,
} from './intervals';

const start = new Date('2026-01-10T09:00:00Z');

describe('intervals', () => {
  it('accepts every preset from 1 day to 1 year', () => {
    expect(INTERVAL_PRESETS[0]).toBe(1);
    expect(INTERVAL_PRESETS[INTERVAL_PRESETS.length - 1]).toBe(365);
    INTERVAL_PRESETS.forEach((days) => expect(isValidInterval(days)).toBe(true));
  });

  it('rejects out-of-range and fractional intervals', () => {
    expect(isValidInterval(0)).toBe(false);
    expect(isValidInterval(366)).toBe(false);
    expect(isValidInterval(1.5)).toBe(false);
  });

  it('computes the deadline from the last check-in', () => {
    expect(computeDeadline(start, 7).toISOString()).toBe('2026-01-17T09:00:00.000Z');
    expect(() => computeDeadline(start, 0)).toThrow(RangeError);
  });

  it('treats a check-in before the deadline as on time', () => {
    const deadline = computeDeadline(start, 1);
    expect(isExpired(deadline, new Date(deadline.getTime() - 1))).toBe(false);
  });

  it('treats a check-in exactly at the deadline as on time', () => {
    const deadline = computeDeadline(start, 1);
    expect(isExpired(deadline, new Date(deadline.getTime()))).toBe(false);
  });

  it('expires after the deadline', () => {
    const deadline = computeDeadline(start, 1);
    expect(isExpired(deadline, new Date(deadline.getTime() + 1))).toBe(true);
    expect(isExpired(null, start)).toBe(false);
  });

  it('formats intervals with friendly labels', () => {
    expect(formatInterval(1)).toBe('1 day');
    expect(formatInterval(7)).toBe('1 week');
    expect(formatInterval(180)).toBe('6 months');
    expect(formatInterval(365)).toBe('1 year');
    expect(formatInterval(21)).toBe('3 weeks');
    expect(formatInterval(5)).toBe('5 days');
  });

  it('formats durations with the two largest units', () => {
    expect(formatDuration(2 * DAY_MS + 3 * HOUR_MS + 5 * MINUTE_MS)).toBe('2 days 3 hours');
    expect(formatDuration(HOUR_MS + 30 * MINUTE_MS)).toBe('1 hour 30 minutes');
    expect(formatDuration(DAY_MS)).toBe('1 day');
    expect(formatDuration(30_000)).toBe('less than a minute');
    expect(formatDuration(-5)).toBe('less than a minute');
  });
});
