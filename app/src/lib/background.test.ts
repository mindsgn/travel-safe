import * as BackgroundTask from 'expo-background-task';

import {
  BACKGROUND_SYNC_TASK,
  getBackgroundAvailability,
  registerBackgroundSync,
  runBackgroundSync,
  uploadJourneySamples,
} from './background';

const { Success, Failed } = BackgroundTask.BackgroundTaskResult;
const { Available, Restricted } = BackgroundTask.BackgroundTaskStatus;

function store(state: { hydrated?: boolean; registered?: boolean; syncResult?: 'offline' | null | Error }) {
  const current = {
    hydrated: state.hydrated ?? true,
    registered: state.registered ?? true,
    hydrate: jest.fn(async () => {
      current.hydrated = true;
    }),
    sync: jest.fn(async () => {
      if (state.syncResult instanceof Error) throw state.syncResult;
      return state.syncResult ?? null;
    }),
  };
  return { getState: () => current, current };
}

const sample = { latitude: 1, longitude: 2, accuracyM: 3, recordedAt: '2026-01-10T09:00:00.000Z' };

describe('runBackgroundSync', () => {
  it('hydrates in a headless launch, then syncs and confirms queued check-ins', async () => {
    const fake = store({ hydrated: false });
    await expect(runBackgroundSync(fake)).resolves.toBe(Success);
    expect(fake.current.hydrate).toHaveBeenCalled();
    expect(fake.current.sync).toHaveBeenCalledWith({ notifyConfirmed: true });
  });

  it('does nothing before registration', async () => {
    const fake = store({ registered: false });
    await expect(runBackgroundSync(fake)).resolves.toBe(Success);
    expect(fake.current.sync).not.toHaveBeenCalled();
  });

  it('reports failures to the OS', async () => {
    await expect(runBackgroundSync(store({ syncResult: 'offline' }))).resolves.toBe(Failed);
    await expect(runBackgroundSync(store({ syncResult: new Error('x') }))).resolves.toBe(Failed);
  });
});

describe('uploadJourneySamples', () => {
  const deps = (enabled: boolean, upload = jest.fn(async () => ({}))) => ({
    upload,
    readDevice: async () => null,
    isEnabled: async () => enabled,
  });

  it('uploads as background points', async () => {
    const d = deps(true);
    await expect(uploadJourneySamples([sample], d)).resolves.toBe(1);
    expect(d.upload).toHaveBeenCalledWith([sample], 'background', null);
  });

  it('skips when journey sharing is off or there is nothing to send', async () => {
    await expect(uploadJourneySamples([sample], deps(false))).resolves.toBe(0);
    await expect(uploadJourneySamples([], deps(true))).resolves.toBe(0);
  });

  it('caps batch size and survives upload failures', async () => {
    const d = deps(true);
    await uploadJourneySamples(Array.from({ length: 150 }, () => sample), d);
    expect((d.upload.mock.calls[0] as unknown[])[0]).toHaveLength(100);
    await expect(
      uploadJourneySamples([sample], deps(true, jest.fn().mockRejectedValue(new Error('offline')))),
    ).resolves.toBe(0);
  });
});

describe('background registration', () => {
  it('registers when the OS allows background work', async () => {
    const api = { getStatusAsync: jest.fn(async () => Available), registerTaskAsync: jest.fn(async () => undefined) };
    await expect(registerBackgroundSync(api)).resolves.toBe('available');
    expect(api.registerTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK, { minimumInterval: 15 });
  });

  it('reports restricted background execution', async () => {
    const api = { getStatusAsync: jest.fn(async () => Restricted), registerTaskAsync: jest.fn() };
    await expect(registerBackgroundSync(api)).resolves.toBe('restricted');
    expect(api.registerTaskAsync).not.toHaveBeenCalled();
    await expect(getBackgroundAvailability({ getStatusAsync: jest.fn().mockRejectedValue(new Error()) })).resolves.toBe(
      'restricted',
    );
  });

  it('treats registration errors as restricted', async () => {
    const api = {
      getStatusAsync: jest.fn(async () => Available),
      registerTaskAsync: jest.fn().mockRejectedValue(new Error('x')),
    };
    await expect(registerBackgroundSync(api)).resolves.toBe('restricted');
  });
});
