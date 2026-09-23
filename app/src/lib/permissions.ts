import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

/**
 * Only notifications and location are runtime permissions we request. Contacts use the
 * system picker (no address-book permission), SMS uses the composer, battery and SIM
 * country need nothing, and biometrics are checked when the user enables app lock.
 */
export type RequestablePermission = 'notifications' | 'location' | 'backgroundLocation';
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';
export type PermissionState = { status: PermissionStatus; canAskAgain: boolean };

export const ONBOARDING_PERMISSIONS: readonly RequestablePermission[] = ['notifications', 'location'];

type ExpoPermissionLike = {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
  ios?: object | null;
};

// IosAuthorizationStatus.PROVISIONAL / EPHEMERAL still deliver notifications.
const IOS_DELIVERABLE_STATUSES = new Set([3, 4]);

function iosStatus(response: ExpoPermissionLike): number | undefined {
  const status = response.ios && 'status' in response.ios ? response.ios.status : undefined;
  return typeof status === 'number' ? status : undefined;
}

export function mapPermission(response: ExpoPermissionLike): PermissionState {
  const ios = iosStatus(response);
  if (response.granted || (ios !== undefined && IOS_DELIVERABLE_STATUSES.has(ios))) {
    return { status: 'granted', canAskAgain: response.canAskAgain };
  }
  if (response.status === 'undetermined') return { status: 'undetermined', canAskAgain: true };
  return { status: 'denied', canAskAgain: response.canAskAgain };
}

export type PermissionAdapter = {
  get: () => Promise<ExpoPermissionLike>;
  request: () => Promise<ExpoPermissionLike>;
};

export const permissionAdapters: Record<RequestablePermission, PermissionAdapter> = {
  notifications: {
    get: () => Notifications.getPermissionsAsync(),
    request: () =>
      Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }),
  },
  location: {
    get: () => Location.getForegroundPermissionsAsync(),
    request: () => Location.requestForegroundPermissionsAsync(),
  },
  backgroundLocation: {
    get: () => Location.getBackgroundPermissionsAsync(),
    request: async () => {
      // Android and iOS both require foreground access before background access.
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (!foreground.granted) return foreground;
      return Location.requestBackgroundPermissionsAsync();
    },
  },
};

async function safely(fn: () => Promise<ExpoPermissionLike>): Promise<PermissionState> {
  try {
    return mapPermission(await fn());
  } catch {
    return { status: 'denied', canAskAgain: false };
  }
}

export function getPermission(
  key: RequestablePermission,
  adapters: Record<RequestablePermission, PermissionAdapter> = permissionAdapters,
): Promise<PermissionState> {
  return safely(adapters[key].get);
}

/** Requests only if the OS will still show a prompt; otherwise returns the current state. */
export async function requestPermission(
  key: RequestablePermission,
  adapters: Record<RequestablePermission, PermissionAdapter> = permissionAdapters,
): Promise<PermissionState> {
  const current = await getPermission(key, adapters);
  if (current.status === 'granted' || !current.canAskAgain) return current;
  return safely(adapters[key].request);
}

/** Denied with no prompt left: the only path is the system Settings app. */
export function needsSettings(state: PermissionState | undefined): boolean {
  return state?.status === 'denied' && !state.canAskAgain;
}
