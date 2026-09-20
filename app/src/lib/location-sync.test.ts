import { LOCATION_PING_INTERVAL_MS, shouldSendLocationPing } from './location-sync';

describe('location sync schedule', () => {
  it('sends immediately, then waits one minute', () => {
    expect(shouldSendLocationPing(null, 1_000)).toBe(true);
    expect(shouldSendLocationPing(1_000, 1_000 + LOCATION_PING_INTERVAL_MS - 1)).toBe(false);
    expect(shouldSendLocationPing(1_000, 1_000 + LOCATION_PING_INTERVAL_MS)).toBe(true);
  });
});
