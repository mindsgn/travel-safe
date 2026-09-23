import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import { readDeviceState } from '@/lib/device-state';
import { captureCurrentLocation } from '@/lib/location';
import { cancelDeadlineReminders, notifyCheckInSynced, scheduleDeadlineReminders } from '@/lib/notifications';
import { getServices } from '@/lib/services';
import { createAppStore, type AppState } from '@/store/app-store';

let instance: StoreApi<AppState> | null = null;

/** Shared by screens and headless background tasks. */
export function getAppStore(): StoreApi<AppState> {
  if (!instance) {
    const { store, session, api } = getServices();
    instance = createAppStore({
      store,
      session,
      api,
      captureLocation: () => captureCurrentLocation(),
      readDevice: () => readDeviceState(),
      reminders: {
        schedule: (deadline, intervalDays, now) => scheduleDeadlineReminders(deadline, intervalDays, now),
        cancel: () => cancelDeadlineReminders(),
        notifySynced: (deadline, now) => notifyCheckInSynced(deadline, now),
      },
    });
  }
  return instance;
}

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(getAppStore(), selector);
}
