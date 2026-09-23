import { isAuthError, isTransientError } from '@/lib/api/client';
import type { CheckInPayload, CheckInResponse } from '@/lib/api/deadman-api';

/** Check-ins recorded on the phone that the server has not yet confirmed. */
export type PendingCheckIn = CheckInPayload & { attempts: number };

export const MAX_PENDING = 10;

export function enqueue(queue: readonly PendingCheckIn[], payload: CheckInPayload): PendingCheckIn[] {
  return [...queue, { ...payload, attempts: 0 }].slice(-MAX_PENDING);
}

export type FlushStop = 'none' | 'offline' | 'auth';

export type FlushResult = {
  remaining: PendingCheckIn[];
  /** Server response for the newest check-in that was confirmed, if any. */
  lastResponse: CheckInResponse | null;
  confirmedIds: string[];
  droppedIds: string[];
  stoppedBy: FlushStop;
};

/**
 * Sends queued check-ins oldest first. Each has a client id, so a retry after a lost
 * response is deduplicated server-side. Transient failures keep the item queued; a
 * permanent rejection (4xx) drops it because retrying can never succeed.
 */
export async function flushQueue(
  queue: readonly PendingCheckIn[],
  send: (payload: CheckInPayload) => Promise<CheckInResponse>,
): Promise<FlushResult> {
  const remaining = [...queue];
  let lastResponse: CheckInResponse | null = null;
  const confirmedIds: string[] = [];
  const droppedIds: string[] = [];
  while (remaining.length > 0) {
    const item = remaining[0];
    try {
      const { attempts: _attempts, ...payload } = item;
      lastResponse = await send(payload);
      confirmedIds.push(item.clientId);
      remaining.shift();
    } catch (error) {
      const stoppedBy: FlushStop | null = isAuthError(error) ? 'auth' : isTransientError(error) ? 'offline' : null;
      if (stoppedBy) {
        remaining[0] = { ...item, attempts: item.attempts + 1 };
        return { remaining, lastResponse, confirmedIds, droppedIds, stoppedBy };
      }
      droppedIds.push(item.clientId);
      remaining.shift();
    }
  }
  return { remaining, lastResponse, confirmedIds, droppedIds, stoppedBy: 'none' };
}
