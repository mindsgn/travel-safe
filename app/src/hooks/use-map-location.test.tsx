import * as Location from 'expo-location';
import { useEffect } from 'react';
import { act, create } from 'react-test-renderer';

import {
  useMapLocation,
  type MapLocationController,
  type MapLocationOptions,
} from '@/hooks/use-map-location';

jest.mock('expo-location', () => ({
  Accuracy: { Highest: 3, High: 2, Balanced: 1, Low: 0, Lowest: -1 },
  getProviderStatusAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const mockedLocation = Location as jest.Mocked<typeof Location>;

const providerEnabled = { locationServicesEnabled: true, gpsAvailable: true };
const granted = { status: 'granted' as const };
const denied = { status: 'denied' as const };

type ProbeProps = {
  onState: (state: MapLocationController) => void;
  options?: MapLocationOptions;
};

function Probe({ onState, options }: ProbeProps) {
  const state = useMapLocation(options);
  useEffect(() => {
    onState(state);
  }, [onState, state]);
  return null;
}

function makeWatchMock() {
  const remove = jest.fn();
  let emit:
    | ((payload: { coords: { latitude: number; longitude: number; accuracy?: number | null } }) => void)
    | undefined;
  (mockedLocation.watchPositionAsync as jest.Mock).mockImplementation(
    (_options: unknown, callback: NonNullable<typeof emit>) => {
      emit = callback;
      return Promise.resolve({ remove });
    },
  );
  return {
    remove,
    emit: (loc: { coords: { latitude: number; longitude: number; accuracy?: number | null } }) =>
      act(() => emit?.(loc)),
  };
}

async function renderProbe(onState: ProbeProps['onState'], options?: MapLocationOptions) {
  let root = null as ReturnType<typeof create> | null;
  await act(async () => {
    root = create(<Probe onState={onState} options={options} />);
  });
  return root!;
}

describe('useMapLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    (mockedLocation.getProviderStatusAsync as jest.Mock).mockResolvedValue(providerEnabled);
  });

  it('captures a position with accuracy when permission is granted', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -33.9249, longitude: 18.4241, accuracy: 9 },
    });
    const watch = makeWatchMock();

    const states: MapLocationController[] = [];
    const root = await renderProbe((state) => states.push(state));

    expect(mockedLocation.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(mockedLocation.getCurrentPositionAsync).toHaveBeenCalled();
    expect(mockedLocation.watchPositionAsync).toHaveBeenCalled();
    expect(states.at(-1)?.status).toBe('ready');
    expect(states.at(-1)?.position).toMatchObject({ latitude: -33.9249, longitude: 18.4241 });
    expect(states.at(-1)?.accuracyMeters).toBe(9);
    expect(states.at(-1)?.stale).toBe(false);

    act(() => root.unmount());
    expect(watch.remove).toHaveBeenCalled();
  });

  it('keeps updating as the watcher emits', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -33.9249, longitude: 18.4241, accuracy: 9 },
    });
    makeWatchMock();

    const states: MapLocationController[] = [];
    const root = await renderProbe((state) => states.push(state));

    act(() => {
      const emit = (mockedLocation.watchPositionAsync as jest.Mock).mock.calls[0][1] as (
        loc: { coords: { latitude: number; longitude: number; accuracy?: number | null } },
      ) => void;
      emit({ coords: { latitude: -33.92, longitude: 18.42, accuracy: 12 } });
    });

    expect(states.at(-1)?.position).toMatchObject({ latitude: -33.92, longitude: 18.42 });
    expect(states.at(-1)?.accuracyMeters).toBe(12);

    act(() => root.unmount());
  });

  it('stops early when permission is denied', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(denied);

    const states: MapLocationController[] = [];
    const root = await renderProbe((state) => states.push(state));

    expect(states.at(-1)?.status).toBe('permission-denied');
    expect(states.at(-1)?.position).toBeNull();
    expect(mockedLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(mockedLocation.watchPositionAsync).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it('reports when location services are disabled', async () => {
    (mockedLocation.getProviderStatusAsync as jest.Mock).mockResolvedValue({
      locationServicesEnabled: false,
      gpsAvailable: false,
    });

    const states: MapLocationController[] = [];
    const root = await renderProbe((state) => states.push(state));

    expect(states.at(-1)?.status).toBe('services-disabled');
    expect(mockedLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it('reports when GPS is unavailable', async () => {
    (mockedLocation.getProviderStatusAsync as jest.Mock).mockResolvedValue({
      locationServicesEnabled: true,
      gpsAvailable: false,
    });

    const states: MapLocationController[] = [];
    const root = await renderProbe((state) => states.push(state));

    expect(states.at(-1)?.status).toBe('gps-unavailable');

    act(() => root.unmount());
  });

  it('flags low accuracy as inaccurate while keeping the position', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -33.9249, longitude: 18.4241, accuracy: 900 },
    });
    makeWatchMock();

    const states: MapLocationController[] = [];
    const root = await renderProbe((state) => states.push(state));

    expect(states.at(-1)?.status).toBe('inaccurate');
    expect(states.at(-1)?.position).toMatchObject({ latitude: -33.9249, longitude: 18.4241 });

    act(() => root.unmount());
  });

  it('times out when the position fix never arrives', async () => {
    jest.useFakeTimers();
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockReturnValue(
      new Promise(() => undefined),
    );

    let latest: MapLocationController | undefined;
    let root = null as ReturnType<typeof create> | null;
    await act(async () => {
      root = create(<Probe onState={(state) => (latest = state)} options={{ requestTimeoutMs: 250 }} />);
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(latest?.status).toBe('error');
    expect(latest?.errorMessage).toContain('timed out');
    act(() => root?.unmount());
  });

  it('re-runs the location request on retry', async () => {
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -33.9249, longitude: 18.4241, accuracy: 9 },
    });
    makeWatchMock();

    let latest: MapLocationController | undefined;
    const root = await renderProbe((state) => {
      latest = state;
    });

    const callsAfterMount = (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mock.calls.length;

    await act(async () => {
      latest?.retry();
    });

    expect(
      (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mock.calls.length,
    ).toBeGreaterThan(callsAfterMount);

    act(() => root.unmount());
  });

  it('marks the position as stale after maxStaleMs elapses', async () => {
    jest.useFakeTimers();
    (mockedLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    (mockedLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -33.9249, longitude: 18.4241, accuracy: 9 },
    });
    const watch = makeWatchMock();

    let latest: MapLocationController | undefined;
    let root = null as ReturnType<typeof create> | null;
    await act(async () => {
      root = create(
        <Probe onState={(state) => (latest = state)} options={{ maxStaleMs: 1_000 }} />,
      );
    });

    expect(latest?.status).toBe('ready');

    await act(async () => {
      jest.advanceTimersByTime(2_100);
    });

    expect(latest?.stale).toBe(true);

    act(() => root?.unmount());
    expect(watch.remove).toHaveBeenCalled();
  });
});