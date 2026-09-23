import { isAuthError, isNetworkError } from '@/lib/api/client';
import type { CheckInPayload, CheckInResponse, FullStatus } from '@/lib/api/deadman-api';
import { flushQueue, type PendingCheckIn } from '@/lib/check-in-queue';
import { parseDate } from '@/lib/dates';

export type SyncError = 'offline' | 'auth' | 'server';

export type SyncDeps = {
  send: (payload: CheckInPayload) => Promise<CheckInResponse>;
  getStatus: () => Promise<FullStatus>;
  now: () => Date;
};

export type SyncResult = {
  queue: PendingCheckIn[];
  status: FullStatus | null;
  fetchedAt: Date | null;
  /** Check-ins that were only on the phone and have now reached the server. */
  confirmedCount: number;
  error: SyncError | null;
};

export function classifySyncError(error: unknown): SyncError {
  if (isAuthError(error)) return 'auth';
  if (isNetworkError(error)) return 'offline';
  return 'server';
}

/** Queue first so the status we fetch already reflects any late check-ins. */
export async function syncWithServer(queue: readonly PendingCheckIn[], deps: SyncDeps): Promise<SyncResult> {
  const flush = await flushQueue(queue, deps.send);
  const confirmedCount = flush.confirmedIds.length;
  if (flush.stoppedBy === 'auth') {
    return { queue: flush.remaining, status: null, fetchedAt: null, confirmedCount, error: 'auth' };
  }
  try {
    const status = await deps.getStatus();
    return { queue: flush.remaining, status, fetchedAt: deps.now(), confirmedCount, error: null };
  } catch (error) {
    return { queue: flush.remaining, status: null, fetchedAt: null, confirmedCount, error: classifySyncError(error) };
  }
}

/**
 * Reminders follow the server deadline, even while a check-in is waiting to sync: until
 * the server has it, that is the deadline contacts would actually be notified at.
 */
export function reminderTarget(status: FullStatus | null): { deadline: Date; intervalDays: number } | null {
  if (!status || status.state !== 'armed') return null;
  const deadline = parseDate(status.next_deadline_at);
  return deadline ? { deadline, intervalDays: status.check_in_interval_days } : null;
}

const FOREGROUND_SYNC_MIN_GAP_MS = 30_000;

export function shouldSyncOnForeground(lastSyncAt: Date | null, now: Date, hasPending: boolean): boolean {
  if (hasPending || !lastSyncAt) return true;
  return now.getTime() - lastSyncAt.getTime() >= FOREGROUND_SYNC_MIN_GAP_MS;
}
