import * as TaskManager from 'expo-task-manager';

import { BACKGROUND_SYNC_TASK, runBackgroundSync, uploadJourneySamples } from '@/lib/background';
import { readDeviceState } from '@/lib/device-state';
import { JOURNEY_TASK, samplesFromTaskData } from '@/lib/location';
import { getServices } from '@/lib/services';
import { getAppStore } from '@/store';

// Task definitions must run at bundle load, including headless background launches.
TaskManager.defineTask(BACKGROUND_SYNC_TASK, () => runBackgroundSync(getAppStore()));

TaskManager.defineTask(JOURNEY_TASK, async ({ data, error }) => {
  if (error) return;
  const store = getAppStore();
  await uploadJourneySamples(samplesFromTaskData(data), {
    upload: (points, source, device) => getServices().api.uploadLocations(points, source, device),
    readDevice: () => readDeviceState(),
    isEnabled: async () => {
      if (!store.getState().hydrated) await store.getState().hydrate();
      return store.getState().registered && store.getState().journeySharing;
    },
  });
});
