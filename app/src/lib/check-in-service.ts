import type { CheckInPayload, CheckInResponse, DeviceState, LocationSample } from '@/lib/api/deadman-api';
import { enqueue, flushQueue, type PendingCheckIn } from '@/lib/check-in-queue';
import { createClientId } from '@/lib/ids';

/**
 * 'synced' only when the server confirmed the check-in. 'local' means it is saved on the
 * phone and queued, and the UI must not claim the server received it.
 */
export type CheckInOutcome =
  | { kind: 'synced'; response: CheckInResponse; locationIncluded: boolean }
  | { kind: 'local'; reason: 'offline' | 'auth' }
  | { kind: 'rejected' };

export type CheckInDeps = {
  now: () => Date;
  captureLocation: () => Promise<LocationSample | null>;
  readDevice: () => Promise<DeviceState | null>;
  send: (payload: CheckInPayload) => Promise<CheckInResponse>;
  createId?: (now: Date) => string;
};

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export async function performCheckIn(
  queue: readonly PendingCheckIn[],
  deps: CheckInDeps,
): Promise<{ outcome: CheckInOutcome; queue: PendingCheckIn[] }> {
  const occurredAt = deps.now();
  const [location, device] = await Promise.all([settle(deps.captureLocation()), settle(deps.readDevice())]);
  const payload: CheckInPayload = {
    clientId: (deps.createId ?? createClientId)(occurredAt),
    occurredAt: occurredAt.toISOString(),
    location,
    device,
  };

  // Persist-before-send: the queue is the local record of the check-in.
  const result = await flushQueue(enqueue(queue, payload), deps.send);
  if (result.confirmedIds.includes(payload.clientId) && result.lastResponse) {
    return {
      outcome: { kind: 'synced', response: result.lastResponse, locationIncluded: location !== null },
      queue: result.remaining,
    };
  }
  if (result.droppedIds.includes(payload.clientId)) {
    return { outcome: { kind: 'rejected' }, queue: result.remaining };
  }
  return {
    outcome: { kind: 'local', reason: result.stoppedBy === 'auth' ? 'auth' : 'offline' },
    queue: result.remaining,
  };
}
