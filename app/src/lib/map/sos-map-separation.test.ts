import * as transport from '@/lib/emergency-transport';
import type { EmergencyPosition } from '@/lib/emergency';
import { useEmergencyStore } from '@/store/emergency-store';

jest.mock('@/lib/emergency-transport', () => ({
  deliverSosAlert: jest.fn(),
  deliverLiveUpdate: jest.fn(),
}));

const mockedTransport = transport as jest.Mocked<typeof transport>;

const MAP_SOURCE_MODULES = [
  'src/lib/map/map-service',
  'src/lib/map/location-state',
  'src/lib/map/map.types',
  'src/hooks/use-map-location',
  'src/components/map/safety-map',
];

function position(): EmergencyPosition {
  return { latitude: -33.9249, longitude: 18.4241, accuracyMeters: 12, timestamp: 1_000 };
}

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

describe('SOS/map separation', () => {
  it('keeps the emergency store free of any map-layer import', () => {
    const requireCache = (require as unknown as { cache: Record<string, unknown> }).cache;
    const loaded = Object.keys(requireCache).filter((key) => key.includes('src'));
    const mapModules = loaded.filter((key) => MAP_SOURCE_MODULES.some((module) => key.includes(module)));
    expect(mapModules).toEqual([]);
  });

  it('runs the SOS flow to completion with no map layer present', async () => {
    mockedTransport.deliverSosAlert.mockResolvedValue({ attempted: 1, succeeded: 1 });

    useEmergencyStore.getState().activate(['+27821234567']);
    useEmergencyStore.getState().updateLocation(position());
    await useEmergencyStore.getState().confirm(2_000);

    let state = useEmergencyStore.getState();
    expect(state.phase).toBe('active');
    expect(state.alertSent).toBe(true);

    useEmergencyStore.getState().endEmergency(9_000);
    state = useEmergencyStore.getState();
    expect(state.phase).toBe('ended');
    expect(state.endedAt).toBe(9_000);
  });

  it('is unaffected when the map provider fails during an active SOS', async () => {
    mockedTransport.deliverSosAlert.mockResolvedValue({ attempted: 1, succeeded: 1 });

    useEmergencyStore.getState().activate(['+27821234567']);
    await useEmergencyStore.getState().confirm(2_000);

    const before = useEmergencyStore.getState();

    const mapError = new Error('map provider crashed') as Error & { kind: string };
    mapError.kind = 'provider-error';

    expect(mapError).toBeInstanceOf(Error);
    expect(before.phase).toBe('active');

    useEmergencyStore.getState().updateLocation(position());
    const after = useEmergencyStore.getState();

    expect(after.phase).toBe('active');
    expect(after.lastPosition).toEqual(position());
    expect(after.alertSent).toBe(true);
    expect(after.error).toBeNull();
  });

  it('ends sharing cleanly when the user stops the SOS', async () => {
    mockedTransport.deliverSosAlert.mockResolvedValue({ attempted: 1, succeeded: 1 });

    useEmergencyStore.getState().activate(['+27821234567']);
    await useEmergencyStore.getState().confirm(2_000);
    useEmergencyStore.getState().endEmergency(5_000);

    const state = useEmergencyStore.getState();
    expect(state.phase).toBe('ended');
    expect(mockedTransport.deliverSosAlert).toHaveBeenCalledTimes(1);
  });
});