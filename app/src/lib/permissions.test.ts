import {
  getPermission,
  mapPermission,
  needsSettings,
  requestPermission,
  type PermissionAdapter,
  type RequestablePermission,
} from './permissions';

const granted = { status: 'granted', granted: true, canAskAgain: true };
const undetermined = { status: 'undetermined', granted: false, canAskAgain: true };
const deniedFinal = { status: 'denied', granted: false, canAskAgain: false };
const deniedAgain = { status: 'denied', granted: false, canAskAgain: true };

function adapters(get: object, request: object = granted) {
  const adapter: PermissionAdapter = {
    get: jest.fn(async () => get as never),
    request: jest.fn(async () => request as never),
  };
  const all = { notifications: adapter, location: adapter, backgroundLocation: adapter } as Record<
    RequestablePermission,
    PermissionAdapter
  >;
  return { all, adapter };
}

describe('mapPermission', () => {
  it('maps granted, undetermined and denied', () => {
    expect(mapPermission(granted)).toEqual({ status: 'granted', canAskAgain: true });
    expect(mapPermission(undetermined)).toEqual({ status: 'undetermined', canAskAgain: true });
    expect(mapPermission(deniedFinal)).toEqual({ status: 'denied', canAskAgain: false });
  });

  it('treats iOS provisional notifications as granted', () => {
    expect(mapPermission({ status: 'denied', granted: false, canAskAgain: true, ios: { status: 3 } }).status).toBe(
      'granted',
    );
  });
});

describe('requestPermission', () => {
  it('prompts when the permission is undetermined', async () => {
    const { all, adapter } = adapters(undetermined, granted);
    await expect(requestPermission('notifications', all)).resolves.toEqual({ status: 'granted', canAskAgain: true });
    expect(adapter.request).toHaveBeenCalled();
  });

  it('handles the user denying the prompt', async () => {
    const { all } = adapters(undetermined, deniedAgain);
    await expect(requestPermission('location', all)).resolves.toEqual({ status: 'denied', canAskAgain: true });
  });

  it('does not prompt when already granted', async () => {
    const { all, adapter } = adapters(granted);
    await requestPermission('location', all);
    expect(adapter.request).not.toHaveBeenCalled();
  });

  it('does not prompt when the OS will no longer show a dialog', async () => {
    const { all, adapter } = adapters(deniedFinal);
    const state = await requestPermission('notifications', all);
    expect(adapter.request).not.toHaveBeenCalled();
    expect(needsSettings(state)).toBe(true);
  });

  it('reports failures as denied instead of throwing', async () => {
    const adapter: PermissionAdapter = { get: jest.fn().mockRejectedValue(new Error('x')), request: jest.fn() };
    const all = { notifications: adapter, location: adapter, backgroundLocation: adapter };
    await expect(getPermission('notifications', all)).resolves.toEqual({ status: 'denied', canAskAgain: false });
  });
});

describe('needsSettings', () => {
  it('is only true for permanently denied permissions', () => {
    expect(needsSettings({ status: 'denied', canAskAgain: true })).toBe(false);
    expect(needsSettings({ status: 'granted', canAskAgain: false })).toBe(false);
    expect(needsSettings(undefined)).toBe(false);
  });
});
