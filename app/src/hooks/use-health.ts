import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { DeviceState } from '@/lib/api/deadman-api';
import { getBackgroundAvailability } from '@/lib/background';
import { assessHealth, readDeviceState, type HealthWarning } from '@/lib/device-state';
import { getPermission } from '@/lib/permissions';

export function useHealth(contactCount: number): { warnings: HealthWarning[]; device: DeviceState | null } {
  const [state, setState] = useState<{ warnings: HealthWarning[]; device: DeviceState | null }>({
    warnings: [],
    device: null,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        getPermission('notifications'),
        getPermission('location'),
        getBackgroundAvailability(),
        readDeviceState(),
      ]).then(([notifications, location, background, device]) => {
        if (!active) return;
        setState({
          device,
          warnings: assessHealth({
            contactCount,
            notifications: notifications.status,
            location: location.status,
            backgroundAvailable: background === 'available',
            device,
          }),
        });
      });
      return () => {
        active = false;
      };
    }, [contactCount]),
  );

  return state;
}
