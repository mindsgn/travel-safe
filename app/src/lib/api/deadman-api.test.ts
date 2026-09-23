import type { AuthSession } from './auth-session';
import { createDeadmanApi } from './deadman-api';

function fakeSession() {
  const authorizedRequest = jest.fn().mockResolvedValue({ contacts: [{ id: 'c1' }] });
  const register = jest.fn().mockResolvedValue({ userId: 'u1' });
  return { session: { authorizedRequest, register } as unknown as AuthSession, authorizedRequest, register };
}

describe('deadman api', () => {
  it('maps a check-in to the backend payload', async () => {
    const { session, authorizedRequest } = fakeSession();
    await createDeadmanApi(session).checkIn({
      clientId: 'ci_1',
      occurredAt: '2026-01-10T09:00:00.000Z',
      location: { latitude: 1, longitude: 2, accuracyM: 5, recordedAt: '2026-01-10T08:59:00.000Z' },
      device: { batteryLevel: 0.5, lowPowerMode: false },
    });
    expect(authorizedRequest).toHaveBeenCalledWith('/api/v1/check-ins', {
      method: 'POST',
      body: {
        client_id: 'ci_1',
        occurred_at: '2026-01-10T09:00:00.000Z',
        location: { latitude: 1, longitude: 2, accuracy_m: 5, recorded_at: '2026-01-10T08:59:00.000Z' },
        device: { battery_level: 0.5, low_power_mode: false },
      },
    });
  });

  it('sends null location and device when unavailable', async () => {
    const { session, authorizedRequest } = fakeSession();
    await createDeadmanApi(session).checkIn({ clientId: 'ci_2', occurredAt: 'x', location: null, device: null });
    expect(authorizedRequest.mock.calls[0][1].body).toMatchObject({ location: null, device: null });
  });

  it('unwraps the contacts list and encodes ids in paths', async () => {
    const { session, authorizedRequest } = fakeSession();
    const api = createDeadmanApi(session);
    await expect(api.listContacts()).resolves.toEqual([{ id: 'c1' }]);
    await api.deleteContact('a/b');
    expect(authorizedRequest).toHaveBeenLastCalledWith('/api/v1/contacts/a%2Fb', { method: 'DELETE' });
  });

  it('uploads location batches with their source', async () => {
    const { session, authorizedRequest } = fakeSession();
    await createDeadmanApi(session).uploadLocations(
      [{ latitude: 1, longitude: 2, accuracyM: null, recordedAt: 't' }],
      'background',
      null,
    );
    expect(authorizedRequest.mock.calls[0][1].body).toEqual({
      points: [{ latitude: 1, longitude: 2, accuracy_m: null, recorded_at: 't' }],
      source: 'background',
      device: null,
    });
  });

  it('delegates registration and profile updates', async () => {
    const { session, register, authorizedRequest } = fakeSession();
    const api = createDeadmanApi(session);
    await api.register({ name: 'T', intervalDays: 7 });
    expect(register).toHaveBeenCalledWith({ name: 'T', intervalDays: 7 });
    await api.updateProfile({ check_in_interval_days: 30 });
    expect(authorizedRequest).toHaveBeenLastCalledWith('/api/v1/me', {
      method: 'PATCH',
      body: { check_in_interval_days: 30 },
    });
  });
});
