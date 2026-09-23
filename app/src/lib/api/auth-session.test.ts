import { createJsonStore, createMemoryBackend } from '@/lib/secure-storage';

import { AuthFailedError, AuthSession, CREDENTIALS_KEY, type Credentials } from './auth-session';
import { ApiError, NetworkError, type ApiRequestOptions } from './client';

const NOW = new Date('2026-01-10T09:00:00Z');
const tokens = (suffix: string, expires = '2026-01-10T10:00:00Z') => ({
  access_token: `at_${suffix}`,
  refresh_token: `rt_${suffix}`,
  access_expires_at: expires,
  refresh_expires_at: '2026-07-10T09:00:00Z',
});

type Handler = (path: string, options: ApiRequestOptions) => unknown;

function setup(handler: Handler, initial?: Credentials) {
  const store = createJsonStore(createMemoryBackend());
  const calls: { path: string; options: ApiRequestOptions }[] = [];
  const request = jest.fn(async (path: string, options: ApiRequestOptions = {}) => {
    calls.push({ path, options });
    const result = handler(path, options);
    if (result instanceof Error) throw result;
    return result;
  });
  const session = new AuthSession(store, request as never, () => NOW);
  const ready = initial ? store.set(CREDENTIALS_KEY, initial) : Promise.resolve();
  return { session, store, calls, ready };
}

const saved: Credentials = {
  userId: 'u1',
  accountKey: 'ak_1',
  accessToken: 'at_old',
  refreshToken: 'rt_old',
  accessExpiresAt: '2026-01-10T10:00:00Z',
};

describe('AuthSession', () => {
  it('registers and stores credentials securely', async () => {
    const { session, store } = setup(() => ({ user_id: 'u1', account_key: 'ak_1', tokens: tokens('new') }));
    await session.register({ name: 'Thandi', intervalDays: 7, timezone: 'Africa/Johannesburg' });
    await expect(store.get(CREDENTIALS_KEY)).resolves.toMatchObject({
      userId: 'u1',
      accountKey: 'ak_1',
      accessToken: 'at_new',
    });
    await expect(session.userId()).resolves.toBe('u1');
  });

  it('attaches the access token to requests', async () => {
    const { session, calls, ready } = setup(() => ({ ok: true }), saved);
    await ready;
    await session.authorizedRequest('/api/v1/me');
    expect(calls[0].options.token).toBe('at_old');
  });

  it('refreshes proactively when the access token is about to expire', async () => {
    const { session, calls, ready } = setup(
      (path) => (path === '/api/v1/auth/refresh' ? tokens('fresh') : { ok: true }),
      { ...saved, accessExpiresAt: '2026-01-10T09:00:30Z' },
    );
    await ready;
    await session.authorizedRequest('/api/v1/me');
    expect(calls.map((call) => call.path)).toEqual(['/api/v1/auth/refresh', '/api/v1/me']);
    expect(calls[1].options.token).toBe('at_fresh');
  });

  it('refreshes and retries once after a 401', async () => {
    let first = true;
    const { session, calls, ready } = setup((path) => {
      if (path === '/api/v1/auth/refresh') return tokens('fresh');
      if (first) {
        first = false;
        return new ApiError('expired', 401);
      }
      return { ok: true };
    }, saved);
    await ready;
    await expect(session.authorizedRequest('/api/v1/me')).resolves.toEqual({ ok: true });
    expect(calls.map((call) => call.path)).toEqual(['/api/v1/me', '/api/v1/auth/refresh', '/api/v1/me']);
  });

  it('falls back to the account key when the refresh token is rejected', async () => {
    const { session, calls, ready } = setup(
      (path) => {
        if (path === '/api/v1/auth/refresh') return new ApiError('bad', 401);
        if (path === '/api/v1/auth/login') return tokens('login');
        return { ok: true };
      },
      { ...saved, accessExpiresAt: '2026-01-01T00:00:00Z' },
    );
    await ready;
    await session.authorizedRequest('/api/v1/me');
    expect(calls.map((call) => call.path)).toEqual(['/api/v1/auth/refresh', '/api/v1/auth/login', '/api/v1/me']);
    expect(calls[1].options.body).toEqual({ user_id: 'u1', account_key: 'ak_1' });
  });

  it('reports authentication failure when every credential is rejected', async () => {
    const { session, ready } = setup(() => new ApiError('bad', 401), { ...saved, accessExpiresAt: '2026-01-01T00:00:00Z' });
    await ready;
    await expect(session.authorizedRequest('/api/v1/me')).rejects.toBeInstanceOf(AuthFailedError);
  });

  it('propagates network errors during refresh without discarding credentials', async () => {
    const { session, store, ready } = setup(() => new NetworkError(), { ...saved, accessExpiresAt: '2026-01-01T00:00:00Z' });
    await ready;
    await expect(session.authorizedRequest('/api/v1/me')).rejects.toBeInstanceOf(NetworkError);
    await expect(store.get(CREDENTIALS_KEY)).resolves.toEqual({ ...saved, accessExpiresAt: '2026-01-01T00:00:00Z' });
  });

  it('shares one refresh between concurrent requests', async () => {
    const { session, calls, ready } = setup(
      (path) => (path === '/api/v1/auth/refresh' ? tokens('fresh') : { ok: true }),
      { ...saved, accessExpiresAt: '2026-01-01T00:00:00Z' },
    );
    await ready;
    await Promise.all([session.authorizedRequest('/a'), session.authorizedRequest('/b')]);
    expect(calls.filter((call) => call.path === '/api/v1/auth/refresh')).toHaveLength(1);
  });

  it('fails fast without credentials and can be cleared', async () => {
    const { session, store, ready } = setup(() => ({ ok: true }), saved);
    await ready;
    await session.clear();
    await expect(store.get(CREDENTIALS_KEY)).resolves.toBeNull();
    await expect(session.hasCredentials()).resolves.toBe(false);
    await expect(session.authorizedRequest('/api/v1/me')).rejects.toBeInstanceOf(AuthFailedError);
  });
});
