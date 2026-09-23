import { ApiError, NetworkError } from './api/client';
import type { CheckInPayload, CheckInResponse } from './api/deadman-api';
import { performCheckIn, type CheckInDeps } from './check-in-service';

const NOW = new Date('2026-01-10T09:00:00Z');
const location = { latitude: -33.9, longitude: 18.4, accuracyM: 10, recordedAt: NOW.toISOString() };

function deps(overrides: Partial<CheckInDeps> = {}): CheckInDeps {
  return {
    now: () => NOW,
    captureLocation: async () => location,
    readDevice: async () => ({ batteryLevel: 0.8, lowPowerMode: false }),
    send: async (payload: CheckInPayload) =>
      ({ check_in: { client_id: payload.clientId }, status: { state: 'armed' } }) as unknown as CheckInResponse,
    createId: () => 'ci_test_0001',
    ...overrides,
  };
}

describe('performCheckIn', () => {
  it('reports synced only after the server confirms', async () => {
    const send = jest.fn(deps().send);
    const { outcome, queue } = await performCheckIn([], deps({ send }));
    expect(outcome).toMatchObject({ kind: 'synced', locationIncluded: true });
    expect(queue).toEqual([]);
    expect(send).toHaveBeenCalledWith({
      clientId: 'ci_test_0001',
      occurredAt: NOW.toISOString(),
      location,
      device: { batteryLevel: 0.8, lowPowerMode: false },
    });
  });

  it('records the check-in locally when the network is unavailable', async () => {
    const { outcome, queue } = await performCheckIn([], deps({ send: jest.fn().mockRejectedValue(new NetworkError()) }));
    expect(outcome).toEqual({ kind: 'local', reason: 'offline' });
    expect(queue).toHaveLength(1);
    expect(queue[0].clientId).toBe('ci_test_0001');
  });

  it('records the check-in locally when the API is unavailable', async () => {
    const { outcome } = await performCheckIn([], deps({ send: jest.fn().mockRejectedValue(new ApiError('down', 503)) }));
    expect(outcome).toEqual({ kind: 'local', reason: 'offline' });
  });

  it('reports authentication failure separately', async () => {
    const { outcome, queue } = await performCheckIn([], deps({ send: jest.fn().mockRejectedValue(new ApiError('no', 401)) }));
    expect(outcome).toEqual({ kind: 'local', reason: 'auth' });
    expect(queue).toHaveLength(1);
  });

  it('reports a permanent server rejection without claiming success', async () => {
    const { outcome, queue } = await performCheckIn([], deps({ send: jest.fn().mockRejectedValue(new ApiError('no', 404)) }));
    expect(outcome).toEqual({ kind: 'rejected' });
    expect(queue).toEqual([]);
  });

  it('still checks in when location is unavailable or denied', async () => {
    const { outcome } = await performCheckIn(
      [],
      deps({ captureLocation: jest.fn().mockRejectedValue(new Error('denied')), readDevice: async () => null }),
    );
    expect(outcome).toMatchObject({ kind: 'synced', locationIncluded: false });
  });

  it('sends older queued check-ins first, then the new one', async () => {
    const sent: string[] = [];
    const older = { clientId: 'ci_old', occurredAt: 'x', location: null, device: null, attempts: 1 };
    const { outcome, queue } = await performCheckIn(
      [older],
      deps({
        send: async (payload) => {
          sent.push(payload.clientId);
          return { check_in: { client_id: payload.clientId } } as unknown as CheckInResponse;
        },
      }),
    );
    expect(sent).toEqual(['ci_old', 'ci_test_0001']);
    expect(outcome.kind).toBe('synced');
    expect(queue).toEqual([]);
  });
});
