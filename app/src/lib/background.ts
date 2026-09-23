import * as BackgroundTask from 'expo-background-task';

import type { DeviceState, LocationSample } from '@/lib/api/deadman-api';
import type { SyncError } from '@/lib/sync';

export const BACKGROUND_SYNC_TASK = 'deadman-background-sync';
/** Minutes. The OS decides the real cadence (often much longer, and paused in Low Power Mode). */
export const BACKGROUND_SYNC_MINUTES = 15;

type SyncingStore = {
  getState: () => {
    hydrated: boolean;
    registered: boolean;
    hydrate: () => Promise<void>;
    sync: (options?: { notifyConfirmed?: boolean }) => Promise<SyncError | null>;
  };
};

/**
 * Keeps local reminders and the offline queue in line with the server. This never
 * decides whether the switch triggered; the backend worker does that on its own.
 */
export async function runBackgroundSync(store: SyncingStore): Promise<BackgroundTask.BackgroundTaskResult> {
  try {
    if (!store.getState().hydrated) await store.getState().hydrate();
    if (!store.getState().registered) return BackgroundTask.BackgroundTaskResult.Success;
    const error = await store.getState().sync({ notifyConfirmed: true });
    return error ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

export type JourneyUploadDeps = {
  upload: (points: LocationSample[], source: 'background', device: DeviceState | null) => Promise<unknown>;
  readDevice: () => Promise<DeviceState | null>;
  isEnabled: () => Promise<boolean>;
};

const MAX_BATCH = 100;

/** Location uploads refresh the last known location only; they never count as a check-in. */
export async function uploadJourneySamples(samples: LocationSample[], deps: JourneyUploadDeps): Promise<number> {
  if (samples.length === 0 || !(await deps.isEnabled())) return 0;
  const batch = samples.slice(-MAX_BATCH);
  try {
    await deps.upload(batch, 'background', await deps.readDevice());
    return batch.length;
  } catch {
    // Dropped rather than queued: stale trail points are deleted after 24h anyway.
    return 0;
  }
}

export type BackgroundAvailability = 'available' | 'restricted';

export async function getBackgroundAvailability(
  api: Pick<typeof BackgroundTask, 'getStatusAsync'> = BackgroundTask,
): Promise<BackgroundAvailability> {
  try {
    const status = await api.getStatusAsync();
    return status === BackgroundTask.BackgroundTaskStatus.Available ? 'available' : 'restricted';
  } catch {
    return 'restricted';
  }
}

export async function registerBackgroundSync(
  api: Pick<typeof BackgroundTask, 'getStatusAsync' | 'registerTaskAsync'> = BackgroundTask,
): Promise<BackgroundAvailability> {
  const availability = await getBackgroundAvailability(api);
  if (availability === 'available') {
    try {
      await api.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: BACKGROUND_SYNC_MINUTES });
    } catch {
      return 'restricted';
    }
  }
  return availability;
}
