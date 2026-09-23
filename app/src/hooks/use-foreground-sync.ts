import { useEffect } from 'react';
import { AppState } from 'react-native';

import { parseDate } from '@/lib/dates';
import { shouldSyncOnForeground } from '@/lib/sync';
import { getAppStore } from '@/store';

/** Flushes queued check-ins and refreshes status on launch and whenever the app returns to the foreground. */
export function useForegroundSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const store = getAppStore();
    const maybeSync = () => {
      const state = store.getState();
      if (state.syncing) return;
      if (shouldSyncOnForeground(parseDate(state.lastSyncAt), new Date(), state.pending.length > 0)) {
        void state.sync({ notifyConfirmed: false });
        void state.loadContacts();
      }
    };
    maybeSync();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') maybeSync();
    });
    return () => subscription.remove();
  }, [enabled]);
}
