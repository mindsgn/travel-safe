import { useState } from 'react';

import { sqliteDeviceCodeStore } from '@/lib/device-identity-sqlite';
import { loadOrCreateDeviceCode, type DeviceCodeStore } from '@/lib/device-identity';

export function useDeviceCode(store: DeviceCodeStore = sqliteDeviceCodeStore): string {
  const [code] = useState(() => loadOrCreateDeviceCode(store));
  return code;
}
