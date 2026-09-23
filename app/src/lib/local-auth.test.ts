import * as LocalAuthentication from 'expo-local-authentication';

import { authenticate, canAuthenticate, guardSensitiveAction, type LocalAuthApi } from './local-auth';

function api(level: number, result: object = { success: true }): LocalAuthApi & { authenticateAsync: jest.Mock } {
  return {
    hasHardwareAsync: jest.fn(async () => true),
    isEnrolledAsync: jest.fn(async () => true),
    getEnrolledLevelAsync: jest.fn(async () => level),
    authenticateAsync: jest.fn(async () => result),
  } as unknown as LocalAuthApi & { authenticateAsync: jest.Mock };
}

const { NONE, SECRET, BIOMETRIC_STRONG } = LocalAuthentication.SecurityLevel;

describe('local authentication', () => {
  it('detects whether the device can authenticate', async () => {
    await expect(canAuthenticate(api(BIOMETRIC_STRONG))).resolves.toBe(true);
    await expect(canAuthenticate(api(SECRET))).resolves.toBe(true);
    await expect(canAuthenticate(api(NONE))).resolves.toBe(false);
  });

  it('allows device passcode fallback', async () => {
    const fake = api(BIOMETRIC_STRONG);
    await authenticate('Confirm', fake);
    expect(fake.authenticateAsync).toHaveBeenCalledWith({ promptMessage: 'Confirm', disableDeviceFallback: false });
  });

  it('maps outcomes', async () => {
    await expect(authenticate('x', api(SECRET, { success: true }))).resolves.toBe('success');
    await expect(authenticate('x', api(SECRET, { success: false, error: 'user_cancel' }))).resolves.toBe('cancelled');
    await expect(authenticate('x', api(SECRET, { success: false, error: 'lockout' }))).resolves.toBe('failed');
    await expect(authenticate('x', api(NONE))).resolves.toBe('unavailable');
  });

  it('guards sensitive actions only when protection is on', async () => {
    const fake = api(SECRET, { success: false, error: 'user_cancel' });
    await expect(guardSensitiveAction(false, 'x', fake)).resolves.toBe(true);
    expect(fake.authenticateAsync).not.toHaveBeenCalled();
    await expect(guardSensitiveAction(true, 'x', fake)).resolves.toBe(false);
    await expect(guardSensitiveAction(true, 'x', api(SECRET))).resolves.toBe(true);
  });

  it('does not lock users out on devices without any authentication', async () => {
    await expect(guardSensitiveAction(true, 'x', api(NONE))).resolves.toBe(true);
  });
});
