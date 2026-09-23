import type { SwitchStatus } from './api/deadman-api';
import { DAY_MS, HOUR_MS } from './intervals';
import { deriveHomeStatus, dueSoonThresholdMs, remainingFromServer } from './status';

const NOW = new Date('2026-01-10T09:00:00Z');

function server(overrides: Partial<SwitchStatus> = {}): SwitchStatus {
  return {
    state: 'armed',
    check_in_interval_days: 7,
    last_check_in_at: '2026-01-09T09:00:00.000000Z',
    next_deadline_at: '2026-01-16T09:00:00.000000Z',
    seconds_remaining: 6 * 86400,
    deadline_passed: false,
    contact_count: 1,
    server_time: '2026-01-10T09:00:00.000000Z',
    ...overrides,
  };
}

const pendingItem = { clientId: 'ci', occurredAt: NOW.toISOString(), location: null, device: null, attempts: 1 };

describe('deriveHomeStatus', () => {
  it('asks for a first check-in before the switch is armed', () => {
    const status = deriveHomeStatus({ server: server({ state: 'inactive' }), fetchedAt: NOW, pending: [], intervalDays: 7, now: NOW });
    expect(status.tone).toBe('setup');
  });

  it('is safe with plenty of time left', () => {
    const status = deriveHomeStatus({ server: server(), fetchedAt: NOW, pending: [], intervalDays: 7, now: NOW });
    expect(status).toMatchObject({ tone: 'safe', remainingMs: 6 * DAY_MS, hasUnsyncedCheckIn: false });
    expect(status.deadline?.toISOString()).toBe('2026-01-16T09:00:00.000Z');
  });

  it('is due soon near the deadline', () => {
    const status = deriveHomeStatus({
      server: server({ seconds_remaining: 3600 }),
      fetchedAt: NOW,
      pending: [],
      intervalDays: 7,
      now: NOW,
    });
    expect(status.tone).toBe('due_soon');
  });

  it('is overdue once the deadline passes, before the server triggers', () => {
    const status = deriveHomeStatus({
      server: server({ seconds_remaining: 60 }),
      fetchedAt: NOW,
      pending: [],
      intervalDays: 7,
      now: new Date(NOW.getTime() + 2 * 60_000),
    });
    expect(status.tone).toBe('overdue');
  });

  it('shows the triggered state from the server', () => {
    const status = deriveHomeStatus({ server: server({ state: 'triggered' }), fetchedAt: NOW, pending: [], intervalDays: 7, now: NOW });
    expect(status.tone).toBe('triggered');
  });

  it('flags unsynced check-ins without pretending the deadline moved', () => {
    const status = deriveHomeStatus({ server: server(), fetchedAt: NOW, pending: [pendingItem], intervalDays: 7, now: NOW });
    expect(status.hasUnsyncedCheckIn).toBe(true);
    expect(status.deadline?.toISOString()).toBe('2026-01-16T09:00:00.000Z');
  });

  it('treats an offline first check-in as locally safe but unsynced', () => {
    const status = deriveHomeStatus({ server: null, fetchedAt: null, pending: [pendingItem], intervalDays: 7, now: NOW });
    expect(status).toMatchObject({ tone: 'safe', deadline: null, hasUnsyncedCheckIn: true });
  });

  it('computes remaining time from the fetch anchor, not the device clock', () => {
    expect(remainingFromServer(server({ seconds_remaining: 100 }), NOW, new Date(NOW.getTime() + 40_000))).toBe(60_000);
    expect(remainingFromServer(server({ seconds_remaining: null }), NOW, NOW)).toBeNull();
  });

  it('caps the due-soon threshold at one day', () => {
    expect(dueSoonThresholdMs(1)).toBe(6 * HOUR_MS);
    expect(dueSoonThresholdMs(30)).toBe(DAY_MS);
  });
});
