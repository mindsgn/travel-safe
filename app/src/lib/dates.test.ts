import { formatRelativeDateTime, parseDate } from './dates';

describe('dates', () => {
  const now = new Date(2026, 0, 10, 12, 0);

  it('describes today, tomorrow and yesterday relative to now', () => {
    expect(formatRelativeDateTime(new Date(2026, 0, 10, 18, 30), now)).toMatch(/^today at /);
    expect(formatRelativeDateTime(new Date(2026, 0, 11, 9, 0), now)).toMatch(/^tomorrow at /);
    expect(formatRelativeDateTime(new Date(2026, 0, 9, 9, 0), now)).toMatch(/^yesterday at /);
  });

  it('uses a full date further away', () => {
    const text = formatRelativeDateTime(new Date(2026, 1, 20, 9, 0), now);
    expect(text).not.toMatch(/today|tomorrow|yesterday/);
    expect(text).toContain(' at ');
  });

  it('parses ISO timestamps and rejects junk', () => {
    expect(parseDate('2026-01-10T09:00:00.000000Z')?.toISOString()).toBe('2026-01-10T09:00:00.000Z');
    expect(parseDate('nope')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});
