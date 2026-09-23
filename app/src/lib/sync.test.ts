import { ApiError, NetworkError } from './api/client';
import type { CheckInResponse, FullStatus } from './api/deadman-api';
import type { PendingCheckIn } from './check-in-queue';
import { classifySyncError, reminderTarget, shouldSyncOnForeground, syncWithServer } from './sync';

const NOW = new Date('2026-01-10T09:00:00Z');

const status: FullStatus = {
  state: 'armed',
  check_in_interval_days: 7,
  last_check_in_at: '2026-01-10T09:00:00.000000Z',
  next_deadline_at: '2026-01-17T09:00:00.000000Z',
  seconds_remaining: 7 * 86400,
  deadline_passed: false,
  contact_count: 1,
  server_time: '2026-01-10T09:00:00.000000Z',
  latest_event: null,
};

const pending = (id: string): PendingCheckIn => ({
  clientId: id,
  occurredAt: NOW.toISOString(),
  location: null,
  device: null,
  attempts: 1,
});

const response = { status } as unknown as CheckInResponse;

describe('syncWithServer', () => {
  it('sends queued check-ins after connectivity returns, then fetches status', async () => {
    const send = jest.fn(async () => response);
    const getStatus = jest.fn(async () => status);
    const result = await syncWithServer([pending('a'), pending('b')], { send, getStatus, now: () => NOW });
    expect(result).toEqual({ queue: [], status, fetchedAt: NOW, confirmedCount: 2, error: null });
    expect(send.mock.invocationCallOrder[1]).toBeLessThan(getStatus.mock.invocationCallOrder[0]);
  });

  it('keeps check-ins queued while offline', async () => {
    const send = jest.fn().mockRejectedValue(new NetworkError());
    const getStatus = jest.fn().mockRejectedValue(new NetworkError());
    const result = await syncWithServer([pending('a')], { send, getStatus, now: () => NOW });
    expect(result.queue).toHaveLength(1);
    expect(result.error).toBe('offline');
    expect(result.confirmedCount).toBe(0);
  });

  it('stops on authentication failure', async () => {
    const send = jest.fn().mockRejectedValue(new ApiError('no', 401));
    const getStatus = jest.fn();
    const result = await syncWithServer([pending('a')], { send, getStatus, now: () => NOW });
    expect(result.error).toBe('auth');
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('reports server outages separately from being offline', async () => {
    const result = await syncWithServer([], {
      send: jest.fn(),
      getStatus: jest.fn().mockRejectedValue(new ApiError('down', 503)),
      now: () => NOW,
    });
    expect(result.error).toBe('server');
  });
});

describe('helpers', () => {
  it('classifies errors', () => {
    expect(classifySyncError(new NetworkError())).toBe('offline');
    expect(classifySyncError(new ApiError('x', 401))).toBe('auth');
    expect(classifySyncError(new Error('x'))).toBe('server');
  });

  it('only schedules reminders for an armed switch', () => {
    expect(reminderTarget(status)).toEqual({ deadline: new Date('2026-01-17T09:00:00Z'), intervalDays: 7 });
    expect(reminderTarget({ ...status, state: 'triggered' })).toBeNull();
    expect(reminderTarget({ ...status, state: 'inactive', next_deadline_at: null })).toBeNull();
    expect(reminderTarget(null)).toBeNull();
  });

  it('syncs on foreground when reopened after backgrounding, without hammering the API', () => {
    expect(shouldSyncOnForeground(null, NOW, false)).toBe(true);
    expect(shouldSyncOnForeground(new Date(NOW.getTime() - 5_000), NOW, false)).toBe(false);
    expect(shouldSyncOnForeground(new Date(NOW.getTime() - 5_000), NOW, true)).toBe(true);
    expect(shouldSyncOnForeground(new Date(NOW.getTime() - 60_000), NOW, false)).toBe(true);
  });
});
