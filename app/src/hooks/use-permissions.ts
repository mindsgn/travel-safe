import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  getPermission,
  needsSettings,
  requestPermission,
  type PermissionState,
  type RequestablePermission,
} from '@/lib/permissions';

export type PermissionMap = Partial<Record<RequestablePermission, PermissionState>>;

/** Re-reads permission state on focus and on return from the Settings app. */
export function usePermissions(keys: readonly RequestablePermission[]) {
  const [states, setStates] = useState<PermissionMap>({});
  const keyList = keys.join(',');

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      keyList.split(',').map(async (key) => [key, await getPermission(key as RequestablePermission)] as const),
    );
    setStates(Object.fromEntries(entries));
  }, [keyList]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'active') void refresh();
      });
      return () => subscription.remove();
    }, [refresh]),
  );

  const request = useCallback(
    async (key: RequestablePermission) => {
      const current = states[key];
      if (needsSettings(current)) {
        await Linking.openSettings();
        return current;
      }
      const next = await requestPermission(key);
      setStates((previous) => ({ ...previous, [key]: next }));
      return next;
    },
    [states],
  );

  return { states, request, refresh, openSettings: () => Linking.openSettings() };
}
