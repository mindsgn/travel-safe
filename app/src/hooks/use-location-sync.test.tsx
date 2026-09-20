import { useEffect } from 'react';
import { act, create } from 'react-test-renderer';

import { useLocationSync, type LocationSyncController } from './use-location-sync';

type ProbeProps = {
  onState: (state: LocationSyncController) => void;
  deviceCode: string;
  position: { latitude: number; longitude: number } | null;
  intervalMs?: number;
  saveLocation: jest.Mock;
};

function Probe({ onState, ...options }: ProbeProps) {
  const state = useLocationSync(options);
  useEffect(() => {
    onState(state);
  }, [onState, state]);
  return null;
}

describe('useLocationSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves GPS immediately and again after a minute, without loading a heatmap', async () => {
    const saveLocation = jest.fn().mockResolvedValue(undefined);
    const states: LocationSyncController[] = [];

    await act(async () => {
      create(
        <Probe
          onState={(state) => states.push(state)}
          deviceCode="TS-ABC12345"
          position={{ latitude: -33.92, longitude: 18.42 }}
          intervalMs={60_000}
          saveLocation={saveLocation}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(saveLocation).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.lastSyncedAt).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(saveLocation).toHaveBeenCalledTimes(2);
  });
});
