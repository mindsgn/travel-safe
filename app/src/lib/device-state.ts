import * as Battery from 'expo-battery';

import type { DeviceState } from '@/lib/api/deadman-api';
import type { PermissionStatus } from '@/lib/permissions';

export type BatteryApi = Pick<typeof Battery, 'getPowerStateAsync'>;

export async function readDeviceState(api: BatteryApi = Battery): Promise<DeviceState> {
  try {
    const state = await api.getPowerStateAsync();
    const level = state.batteryLevel;
    return {
      batteryLevel: typeof level === 'number' && level >= 0 && level <= 1 ? level : null,
      lowPowerMode: typeof state.lowPowerMode === 'boolean' ? state.lowPowerMode : null,
    };
  } catch {
    return { batteryLevel: null, lowPowerMode: null };
  }
}

export type HealthWarning =
  | 'no_contacts'
  | 'notifications_off'
  | 'location_off'
  | 'background_restricted'
  | 'low_power_mode'
  | 'battery_low';

export const LOW_BATTERY_LEVEL = 0.15;

/** Ordered by how much each issue undermines the safety net. */
export function assessHealth(input: {
  contactCount: number;
  notifications: PermissionStatus;
  location: PermissionStatus;
  backgroundAvailable: boolean;
  device: DeviceState | null;
}): HealthWarning[] {
  const warnings: HealthWarning[] = [];
  if (input.contactCount === 0) warnings.push('no_contacts');
  if (input.notifications === 'denied') warnings.push('notifications_off');
  if (input.location === 'denied') warnings.push('location_off');
  if (!input.backgroundAvailable) warnings.push('background_restricted');
  if (input.device?.lowPowerMode) warnings.push('low_power_mode');
  if (input.device?.batteryLevel !== null && input.device?.batteryLevel !== undefined) {
    if (input.device.batteryLevel < LOW_BATTERY_LEVEL) warnings.push('battery_low');
  }
  return warnings;
}
