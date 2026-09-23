import type { SwitchStatus } from '@/lib/api/deadman-api';
import type { PendingCheckIn } from '@/lib/check-in-queue';
import { parseDate } from '@/lib/dates';
import { DAY_MS, intervalMs } from '@/lib/intervals';

export type HomeTone = 'setup' | 'safe' | 'due_soon' | 'overdue' | 'triggered';

export type HomeStatus = {
  tone: HomeTone;
  deadline: Date | null;
  lastCheckIn: Date | null;
  remainingMs: number | null;
  /** A check-in exists on this phone that the server hasn't confirmed. */
  hasUnsyncedCheckIn: boolean;
};

const DUE_SOON_FRACTION = 0.25;

export function dueSoonThresholdMs(intervalDays: number): number {
  return Math.min(DAY_MS, intervalMs(intervalDays) * DUE_SOON_FRACTION);
}

/**
 * Uses the server's seconds_remaining (anchored to when it was fetched) rather than the
 * device clock against the deadline, so a wrong phone clock can't misreport safety.
 */
export function remainingFromServer(status: SwitchStatus, fetchedAt: Date, now: Date): number | null {
  if (status.seconds_remaining === null) return null;
  return status.seconds_remaining * 1000 - (now.getTime() - fetchedAt.getTime());
}

export function deriveHomeStatus(input: {
  server: SwitchStatus | null;
  fetchedAt: Date | null;
  pending: readonly PendingCheckIn[];
  intervalDays: number;
  now: Date;
}): HomeStatus {
  const { server, fetchedAt, pending, intervalDays, now } = input;
  const hasUnsyncedCheckIn = pending.length > 0;
  if (!server || server.state === 'inactive' || server.state === 'archived') {
    return {
      tone: hasUnsyncedCheckIn ? 'safe' : 'setup',
      deadline: null,
      lastCheckIn: parseDate(pending[pending.length - 1]?.occurredAt),
      remainingMs: null,
      hasUnsyncedCheckIn,
    };
  }

  const deadline = parseDate(server.next_deadline_at);
  const lastCheckIn = parseDate(server.last_check_in_at);
  const remainingMs = fetchedAt ? remainingFromServer(server, fetchedAt, now) : server.seconds_remaining;
  let tone: HomeTone;
  if (server.state === 'triggered') tone = 'triggered';
  else if (remainingMs !== null && remainingMs < 0) tone = 'overdue';
  else if (remainingMs !== null && remainingMs <= dueSoonThresholdMs(intervalDays)) tone = 'due_soon';
  else tone = 'safe';

  return { tone, deadline, lastCheckIn, remainingMs, hasUnsyncedCheckIn };
}
