import {
  captureCurrentLocation,
  JOURNEY_TASK,
  samplesFromTaskData,
  startJourneyTracking,
  stopJourneyTracking,
  toSample,
  type LocationApi,
} from './location';

const fix = (latitude: number) => ({
  coords: { latitude, longitude: 18.4, accuracy: 12 },
  timestamp: Date.parse('2026-01-10T09:00:00Z'),
});

function api(overrides: Partial<Record<keyof LocationApi, jest.Mock>> = {}) {
  return {
    getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getLastKnownPositionAsync: jest.fn(async () => null),
    getCurrentPositionAsync: jest.fn(async () => fix(-33.9)),
    startLocationUpdatesAsync: jest.fn(async () => undefined),
    stopLocationUpdatesAsync: jest.fn(async () => undefined),
    hasStartedLocationUpdatesAsync: jest.fn(async () => false),
    ...overrides,
  } as unknown as LocationApi & Record<keyof LocationApi, jest.Mock>;
}

describe('captureCurrentLocation', () => {
  it('returns null without prompting when permission is denied', async () => {
    const fake = api({ getForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })) });
    await expect(captureCurrentLocation(fake)).resolves.toBeNull();
    expect(fake.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('prefers a recent cached fix', async () => {
    const fake = api({ getLastKnownPositionAsync: jest.fn(async () => fix(-1)) });
    await expect(captureCurrentLocation(fake)).resolves.toMatchObject({ latitude: -1 });
    expect(fake.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('asks for a current fix when no recent one exists', async () => {
    await expect(captureCurrentLocation(api())).resolves.toEqual({
      latitude: -33.9,
      longitude: 18.4,
      accuracyM: 12,
      recordedAt: '2026-01-10T09:00:00.000Z',
    });
  });

  it('falls back to any cached fix when GPS is slow', async () => {
    const lastKnown = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(fix(-2));
    const fake = api({
      getLastKnownPositionAsync: lastKnown,
      getCurrentPositionAsync: jest.fn(() => new Promise(() => undefined)),
    });
    await expect(captureCurrentLocation(fake, 10)).resolves.toMatchObject({ latitude: -2 });
  });

  it('returns null when location is unavailable', async () => {
    const fake = api({ getCurrentPositionAsync: jest.fn().mockRejectedValue(new Error('no gps')) });
    await expect(captureCurrentLocation(fake)).resolves.toBeNull();
  });
});

describe('journey tracking', () => {
  it('starts background updates with a visible indicator', async () => {
    const fake = api();
    await startJourneyTracking(fake);
    expect(fake.startLocationUpdatesAsync).toHaveBeenCalledWith(
      JOURNEY_TASK,
      expect.objectContaining({ showsBackgroundLocationIndicator: true, distanceInterval: 250 }),
    );
  });

  it('does not start twice and stops cleanly', async () => {
    const fake = api({ hasStartedLocationUpdatesAsync: jest.fn(async () => true) });
    await startJourneyTracking(fake);
    expect(fake.startLocationUpdatesAsync).not.toHaveBeenCalled();
    await stopJourneyTracking(fake);
    expect(fake.stopLocationUpdatesAsync).toHaveBeenCalledWith(JOURNEY_TASK);
  });

  it('parses task payloads defensively', () => {
    expect(samplesFromTaskData({ locations: [fix(1)] })).toEqual([toSample(fix(1))]);
    expect(samplesFromTaskData(null)).toEqual([]);
    expect(samplesFromTaskData({ locations: 'nope' })).toEqual([]);
  });
});
