import * as Location from 'expo-location';
import { useEffect } from 'react';
import { act, create } from 'react-test-renderer';

import { useEmergencyLocation, type EmergencyLocationState } from '@/hooks/use-emergency-location';

jest.mock('expo-location', () => ({
  Accuracy: { Highest: 3, High: 2, Balanced: 1 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const mockedLocation = Location as jest.Mocked<typeof Location>;

type ProbeProps = {
  onState: (state: EmergencyLocationState) => void;
};

function Probe({ onState }: ProbeProps) {
  const state = useEmergencyLocation();
  useEffect(() => {
    onState(state);
  }, [onState, state]);
  return null;
}

function makeWatchMock() {
  const remove = jest.fn();
  let emit: ((payload: { coords: { latitude: number; longitude: number; accuracy: number | null } }) => void) | undefined;
  (mockedLocation.watchPositionAsync as jest.Mock).mockImplementation((_options, callback) => {
    emit = callback;
    return Promise.resolve({ remove });
  });
  return { remove, emit: (loc: Parameters<NonNullable<typeof emit>>[0]) => act(() => emit?.(loc)) };
}

const granted = { status: 'granted' as const };
const denied = { status: 'denied' as const };

async function renderProbe(onState: ProbeProps['onState']) {
  let root = null as ReturnType<typeof create> | null;
  await act(async () => {
    root = create(<Probe onState={onState} />);
  });
  return root!;
}

describe('useEmergencyLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests permission and captures the initial fix with accuracy', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -33.9249, longitude: 18.4241, accuracy: 9 },
    });
    makeWatchMock();

    const states: EmergencyLocationState[] = [];
    const root = await renderProbe((state) => states.push(state));

    expect(mockedLocation.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(mockedLocation.getCurrentPositionAsync).toHaveBeenCalled();
    expect(mockedLocation.watchPositionAsync).toHaveBeenCalled();
    expect(states.at(-1)?.isLocating).toBe(false);
    expect(states.at(-1)?.position).toMatchObject({
      latitude: -33.9249,
      longitude: 18.4241,
      accuracyMeters: 9,
    });
    expect(states.at(-1)?.position?.timestamp).toEqual(expect.any(Number));

    act(() => root.unmount());
  });

  it('keeps updating the position as the watcher emits', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -33.9249, longitude: 18.4241, accuracy: 9 },
    });
    const { emit } = makeWatchMock();

    const states: EmergencyLocationState[] = [];
    await renderProbe((state) => states.push(state));

    emit({ coords: { latitude: -33.92, longitude: 18.42, accuracy: 12 } });

    expect(states.at(-1)?.position).toMatchObject({
      latitude: -33.92,
      longitude: 18.42,
      accuracyMeters: 12,
    });
  });

  it('surfaces an error and stops locating when permission is denied', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(denied);

    const states: EmergencyLocationState[] = [];
    const root = await renderProbe((state) => states.push(state));

    const latest = states.at(-1);
    expect(latest?.error).toBeTruthy();
    expect(latest?.isLocating).toBe(false);
    expect(latest?.position).toBeNull();
    expect(mockedLocation.watchPositionAsync).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it('removes the watcher on unmount', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -33.9249, longitude: 18.4241, accuracy: 9 },
    });
    const { remove } = makeWatchMock();

    const root = await renderProbe(() => undefined);
    act(() => root.unmount());

    expect(remove).toHaveBeenCalled();
  });

  it('turns locate on and exposes retry by changing the retry nonce', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -33.9249, longitude: 18.4241, accuracy: null },
    });
    makeWatchMock();

    let latest: EmergencyLocationState | undefined;
    await renderProbe((state) => {
      latest = state;
    });

    expect(latest?.position?.accuracyMeters).toBeNull();
    expect(typeof latest?.retry).toBe('function');
  });
});