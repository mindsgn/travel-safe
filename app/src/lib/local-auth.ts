import * as LocalAuthentication from 'expo-local-authentication';

export type LocalAuthApi = Pick<
  typeof LocalAuthentication,
  'hasHardwareAsync' | 'isEnrolledAsync' | 'getEnrolledLevelAsync' | 'authenticateAsync'
>;

export type AuthOutcome = 'success' | 'cancelled' | 'unavailable' | 'failed';

/** True when the device has biometrics or at least a passcode we can challenge. */
export async function canAuthenticate(api: LocalAuthApi = LocalAuthentication): Promise<boolean> {
  try {
    const level = await api.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export async function authenticate(reason: string, api: LocalAuthApi = LocalAuthentication): Promise<AuthOutcome> {
  if (!(await canAuthenticate(api))) return 'unavailable';
  try {
    const result = await api.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false });
    if (result.success) return 'success';
    return result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel'
      ? 'cancelled'
      : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Gate for sensitive actions. If protection is off, or the device has no way to
 * authenticate at all, the action proceeds (we can't lock users out of their own safety
 * settings); otherwise it requires a successful challenge.
 */
export async function guardSensitiveAction(
  enabled: boolean,
  reason: string,
  api: LocalAuthApi = LocalAuthentication,
): Promise<boolean> {
  if (!enabled) return true;
  const outcome = await authenticate(reason, api);
  return outcome === 'success' || outcome === 'unavailable';
}
