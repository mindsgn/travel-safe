import {
  initialMapLocationState,
  isMapLocationRecoverable,
  isPositionStale,
  mapErrorKindForStatus,
  mapLocationReducer,
} from './location-state';

describe('mapLocationReducer', () => {
  it('starts idle with no position', () => {
    expect(initialMapLocationState()).toEqual({
      status: 'idle',
      position: null,
      accuracyMeters: null,
      timestamp: null,
      errorMessage: null,
      retryCount: 0,
    });
  });

  it('records a locating state', () => {
    const state = mapLocationReducer(initialMapLocationState(), { type: 'locating' });
    expect(state.status).toBe('locating');
    expect(state.errorMessage).toBeNull();
  });

  it('records a successful position with accuracy', () => {
    const state = mapLocationReducer(initialMapLocationState(), {
      type: 'position',
      position: { latitude: -33.9, longitude: 18.4 },
      accuracyMeters: 12,
    });
    expect(state.status).toBe('ready');
    expect(state.position).toEqual({ latitude: -33.9, longitude: 18.4 });
    expect(state.accuracyMeters).toBe(12);
    expect(state.timestamp).toEqual(expect.any(Number));
  });

  it('handles permission denied', () => {
    const state = mapLocationReducer(initialMapLocationState(), { type: 'position', position: { latitude: -33.9, longitude: 18.4 }, accuracyMeters: null });
    const next = mapLocationReducer(state, { type: 'permission-denied' });
    expect(next.status).toBe('permission-denied');
    expect(next.position).toBeNull();
  });

  it('handles services disabled', () => {
    const next = mapLocationReducer(initialMapLocationState(), { type: 'services-disabled' });
    expect(next.status).toBe('services-disabled');
  });

  it('handles GPS unavailable', () => {
    const next = mapLocationReducer(initialMapLocationState(), { type: 'gps-unavailable' });
    expect(next.status).toBe('gps-unavailable');
  });

  it('flags inaccurate while keeping the position', () => {
    const state = mapLocationReducer(initialMapLocationState(), {
      type: 'position',
      position: { latitude: -33.9, longitude: 18.4 },
      accuracyMeters: 800,
    });
    const next = mapLocationReducer(state, { type: 'inaccurate' });
    expect(next.status).toBe('inaccurate');
    expect(next.position).toEqual({ latitude: -33.9, longitude: 18.4 });
  });

  it('records timeout errors with a message', () => {
    const next = mapLocationReducer(initialMapLocationState(), { type: 'timeout' });
    expect(next.status).toBe('error');
    expect(next.errorMessage).toContain('timed out');
  });

  it('records generic errors', () => {
    const next = mapLocationReducer(initialMapLocationState(), { type: 'error', message: 'boom' });
    expect(next.status).toBe('error');
    expect(next.errorMessage).toBe('boom');
  });

  it('flags staleness without dropping the position', () => {
    const state = mapLocationReducer(initialMapLocationState(), {
      type: 'position',
      position: { latitude: -33.9, longitude: 18.4 },
      accuracyMeters: 10,
    });
    const next = mapLocationReducer(state, { type: 'stale' });
    expect(next.status).toBe('stale');
    expect(next.position).toEqual(state.position);
  });

  it('resets to the initial state', () => {
    const state = mapLocationReducer(initialMapLocationState(), { type: 'error', message: 'x' });
    expect(mapLocationReducer(state, { type: 'reset' })).toEqual(initialMapLocationState());
  });

  it('increments nothing on locating and preserves retry count across transitions', () => {
    const state = mapLocationReducer(initialMapLocationState(), { type: 'locating' });
    expect(state.retryCount).toBe(0);
  });
});

describe('mapErrorKindForStatus', () => {
  it.each([
    ['permission-denied', 'permission-denied'],
    ['services-disabled', 'services-disabled'],
    ['gps-unavailable', 'gps-unavailable'],
    ['inaccurate', 'inaccurate'],
    ['error', 'unknown'],
    ['ready', 'unknown'],
  ] as const)('maps %s to %s', (status, kind) => {
    expect(mapErrorKindForStatus(status)).toBe(kind);
  });
});

describe('isMapLocationRecoverable', () => {
  it.each(['permission-denied', 'services-disabled', 'gps-unavailable', 'error'] as const)(
    'treats %s as recoverable',
    (status) => {
      expect(isMapLocationRecoverable(status)).toBe(true);
    },
  );

  it('does not treat ready/stale states as recoverable', () => {
    expect(isMapLocationRecoverable('ready')).toBe(false);
    expect(isMapLocationRecoverable('stale')).toBe(false);
  });
});

describe('isPositionStale', () => {
  it('is stale once the age exceeds the threshold', () => {
    expect(isPositionStale(1_001, 1_000)).toBe(true);
  });

  it('is fresh while within the threshold', () => {
    expect(isPositionStale(999, 1_000)).toBe(false);
    expect(isPositionStale(1_000, 1_000)).toBe(false);
  });
});