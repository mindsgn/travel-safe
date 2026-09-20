import { act, create } from 'react-test-renderer';
import { Pressable } from 'react-native';

import type { TripPlan } from '@/lib/api/trips';

import {
  currentLocationToTripPoint,
  suggestionToTripPoint,
  tripPointLabel,
  tripStatusMessage,
  useTripPlan,
} from './use-trip-plan';

const PLAN: TripPlan = {
  origin: { latitude: -33.9249, longitude: 18.4241, label: 'CBD' },
  destination: { latitude: -33.927, longitude: 18.447, label: 'Woodstock' },
  pathway: {
    coordinates: [
      [18.4241, -33.9249],
      [18.447, -33.927],
    ],
    distance_meters: 1000,
    duration_seconds: 700,
    provider: 'mock',
  },
  heatmap: {
    bbox: [18.4, -33.96, 18.5, -33.89],
    zoom: 12,
    cells: [],
    normalization: 'mock',
    caveats: [],
  },
};

function Harness({ planTrip }: { planTrip: () => Promise<TripPlan> }) {
  const trip = useTripPlan(planTrip, async (plan) => plan);
  return (
    <>
      <Pressable testID="set-origin" onPress={() => trip.selectOrigin(PLAN.origin)} />
      <Pressable testID="set-destination" onPress={() => trip.selectDestination(PLAN.destination)} />
      <Pressable testID="status" accessibilityHint={trip.status} />
    </>
  );
}

describe('useTripPlan helpers', () => {
  it('maps suggestions and current location to trip points', () => {
    expect(
      suggestionToTripPoint({
        id: '1',
        label: 'Woodstock, Cape Town',
        latitude: -33.927,
        longitude: 18.447,
      }),
    ).toEqual({
      latitude: -33.927,
      longitude: 18.447,
      label: 'Woodstock, Cape Town',
    });
    expect(currentLocationToTripPoint({ latitude: -33.9, longitude: 18.4 }, 'Here')).toEqual({
      latitude: -33.9,
      longitude: 18.4,
      label: 'Here',
    });
    expect(tripPointLabel({ latitude: -33.9249, longitude: 18.4241, label: '  CBD  ' })).toBe('CBD');
    expect(tripPointLabel({ latitude: -33.9249, longitude: 18.4241 })).toContain('-33.92490');
  });

  it('returns status copy for loading and error', () => {
    expect(tripStatusMessage('idle')).toBeNull();
    expect(tripStatusMessage('ready')).toBeNull();
    expect(tripStatusMessage('loading')).toBeTruthy();
    expect(tripStatusMessage('error')).toBeTruthy();
  });
});

describe('useTripPlan', () => {
  it('requests a plan once origin and destination are set', async () => {
    const planTrip = jest.fn().mockResolvedValue(PLAN);
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness planTrip={planTrip} />);
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'set-origin' }).props.onPress();
      renderer.root.findByProps({ testID: 'set-destination' }).props.onPress();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(planTrip).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByProps({ testID: 'status' }).props.accessibilityHint).toBe('ready');
  });
});
