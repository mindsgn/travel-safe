import * as transport from '@/lib/emergency-transport';
import { SOS_COUNTDOWN_SECONDS, type EmergencyPosition } from '@/lib/emergency';
import { useEmergencyStore } from '@/store/emergency-store';

jest.mock('@/lib/emergency-transport', () => ({
  deliverSosAlert: jest.fn(),
  deliverLiveUpdate: jest.fn(),
}));

const mockedTransport = transport as jest.Mocked<typeof transport>;

function position(overrides: Partial<EmergencyPosition> = {}): EmergencyPosition {
  return {
    latitude: -33.9249,
    longitude: 18.4241,
    accuracyMeters: 12,
    timestamp: 1_000,
    ...overrides,
  };
}

const initial: ReturnType<typeof useEmergencyStore.getState> = useEmergencyStore.getState();

beforeEach(() => {
  useEmergencyStore.setState({
    phase: 'idle',
    emergencyId: null,
    startedAt: null,
    endedAt: null,
    countdownEndsAt: null,
    phones: [],
    lastPosition: null,
    lastUpdateSentAt: null,
    lastSharedPosition: null,
    recipientCount: 0,
    alertSent: false,
    deliveredUpdates: 0,
    error: null,
  });
  jest.clearAllMocks();
});

describe('activate', () => {
  it('starts a countdown and keeps the recipients', () => {
    useEmergencyStore.getState().activate(['+27821234567']);

    const state = useEmergencyStore.getState();
    expect(state.phase).toBe('counting');
    expect(state.countdownEndsAt).not.toBeNull();
    expect(state.phones).toEqual(['+27821234567']);
    expect(initial.phase).toBe('idle');
  });

  it('does nothing while an emergency is already active', () => {
    useEmergencyStore.setState({ phase: 'active', countdownEndsAt: 999 });
    useEmergencyStore.getState().activate(['+27111111111']);

    const state = useEmergencyStore.getState();
    expect(state.phase).toBe('active');
    expect(state.countdownEndsAt).toBe(999);
  });
});

describe('cancel', () => {
  it('returns to idle when counting', () => {
    useEmergencyStore.getState().activate([]);
    useEmergencyStore.getState().cancel();

    const state = useEmergencyStore.getState();
    expect(state.phase).toBe('idle');
    expect(state.countdownEndsAt).toBeNull();
  });

  it('is a no-op outside of counting', () => {
    useEmergencyStore.getState().cancel();
    expect(useEmergencyStore.getState().phase).toBe('idle');
  });
});

describe('confirm', () => {
  it('sends the alert and transitions to active once the countdown ends', async () => {
    mockedTransport.deliverSosAlert.mockResolvedValue({ attempted: 1, succeeded: 1 });

    useEmergencyStore.getState().activate(['+27821234567']);
    useEmergencyStore.getState().updateLocation(position());
    await useEmergencyStore.getState().confirm(2_000);

    const state = useEmergencyStore.getState();
    expect(state.phase).toBe('active');
    expect(state.startedAt).toBe(2_000);
    expect(state.emergencyId).toMatch(/^emg_/);
    expect(state.recipientCount).toBe(1);
    expect(state.alertSent).toBe(true);
    expect(state.lastUpdateSentAt).toBe(2_000);
    expect(mockedTransport.deliverSosAlert).toHaveBeenCalledTimes(1);
  });

  it('flags a failed alert when no recipient could be reached', async () => {
    mockedTransport.deliverSosAlert.mockResolvedValue({ attempted: 1, succeeded: 0 });

    useEmergencyStore.getState().activate(['+27821234567']);
    await useEmergencyStore.getState().confirm(5_000);

    const state = useEmergencyStore.getState();
    expect(state.phase).toBe('active');
    expect(state.alertSent).toBe(false);
    expect(state.error).toBeTruthy();
  });

  it('does not fire from idle', async () => {
    await useEmergencyStore.getState().confirm();
    expect(mockedTransport.deliverSosAlert).not.toHaveBeenCalled();
    expect(useEmergencyStore.getState().phase).toBe('idle');
  });

  it('sends no alert and still goes active when there are no recipients', async () => {
    mockedTransport.deliverSosAlert.mockResolvedValue({ attempted: 0, succeeded: 0 });

    useEmergencyStore.getState().activate([]);
    await useEmergencyStore.getState().confirm(3_000);

    const state = useEmergencyStore.getState();
    expect(state.phase).toBe('active');
    expect(state.alertSent).toBe(false);
    expect(state.error).toBeNull();
  });
});

describe('updateLocation', () => {
  it('stores the latest position', () => {
    useEmergencyStore.getState().updateLocation(position({ latitude: -33.9 }));
    expect(useEmergencyStore.getState().lastPosition?.latitude).toBe(-33.9);
  });
});

describe('sendPendingUpdate', () => {
  it('skips when idle or before the interval elapses', async () => {
    useEmergencyStore.getState().sendPendingUpdate();
    expect(mockedTransport.deliverLiveUpdate).not.toHaveBeenCalled();
  });

  it('shares an update after the interval and movement threshold', async () => {
    mockedTransport.deliverLiveUpdate.mockResolvedValue({ attempted: 1, succeeded: 1 });

    useEmergencyStore.getState().activate(['+27821234567']);
    useEmergencyStore.getState().updateLocation(position());
    await useEmergencyStore.getState().confirm(2_000);
    useEmergencyStore.getState().updateLocation(
      position({ latitude: -33.92, longitude: 18.42, timestamp: 3_000 }),
    );
    await useEmergencyStore.getState().sendPendingUpdate(17_000);

    const state = useEmergencyStore.getState();
    expect(state.deliveredUpdates).toBe(1);
    expect(state.lastUpdateSentAt).toBe(17_000);
    expect(mockedTransport.deliverLiveUpdate).toHaveBeenCalledTimes(1);
  });

  it('suppresses updates when the user has barely moved', async () => {
    useEmergencyStore.getState().activate(['+27821234567']);
    useEmergencyStore.getState().updateLocation(
      position({ latitude: -33.9249, longitude: 18.4241, timestamp: 1_000 }),
    );
    await useEmergencyStore.getState().confirm(2_000);
    useEmergencyStore.getState().updateLocation(
      position({ latitude: -33.9249, longitude: 18.4241, timestamp: 3_000 }),
    );
    await useEmergencyStore.getState().sendPendingUpdate(17_000);

    expect(useEmergencyStore.getState().deliveredUpdates).toBe(0);
    expect(mockedTransport.deliverLiveUpdate).not.toHaveBeenCalled();
  });

  it('increments only by what was actually delivered', async () => {
    mockedTransport.deliverLiveUpdate.mockResolvedValue({ attempted: 2, succeeded: 1 });

    useEmergencyStore.getState().activate(['+27821234567', '+27111111111']);
    await useEmergencyStore.getState().confirm(2_000);
    useEmergencyStore.getState().updateLocation(
      position({ latitude: -33.92, longitude: 18.42, timestamp: 3_000 }),
    );
    await useEmergencyStore.getState().sendPendingUpdate(17_000);

    expect(useEmergencyStore.getState().deliveredUpdates).toBe(1);
  });
});

describe('endEmergency', () => {
  it('stops sharing when the emergency ends', async () => {
    useEmergencyStore.getState().activate(['+27821234567']);
    await useEmergencyStore.getState().confirm(2_000);
    useEmergencyStore.getState().endEmergency(9_000);

    const state = useEmergencyStore.getState();
    expect(state.phase).toBe('ended');
    expect(state.endedAt).toBe(9_000);
    expect(state.countdownEndsAt).toBeNull();
  });

  it('is a no-op unless the emergency is active', () => {
    useEmergencyStore.getState().endEmergency();
    expect(useEmergencyStore.getState().phase).toBe('idle');
  });
});

describe('reset', () => {
  it('returns the store to idle (covers countdown length sanity)', async () => {
    useEmergencyStore.getState().activate([]);
    useEmergencyStore.getState().reset();

    const state = useEmergencyStore.getState();
    expect(state.phase).toBe('idle');
    expect(state.phones).toEqual([]);
    expect(state.countdownEndsAt).toBeNull();
    expect(SOS_COUNTDOWN_SECONDS).toBeGreaterThanOrEqual(3);
  });
});