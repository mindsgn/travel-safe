import {
  ApiError,
  apiRequest,
  isAuthError,
  isNetworkError,
  isTransientError,
  joinApiUrl,
  NetworkError,
} from './client';

function response(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as Response;
}

describe('api client', () => {
  it('joins base URLs and paths', () => {
    expect(joinApiUrl('https://api.example/', '/api/v1/me')).toBe('https://api.example/api/v1/me');
    expect(joinApiUrl('https://api.example', 'api/v1/me')).toBe('https://api.example/api/v1/me');
  });

  it('sends JSON with a bearer token and parses the response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { ok: true }));
    const result = await apiRequest<{ ok: boolean }>('/api/v1/check-ins', {
      method: 'POST',
      body: { hello: 'world' },
      token: 'at_123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      baseUrl: 'https://api.example',
    });
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.example/api/v1/check-ins');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ hello: 'world' }));
    expect(init.headers.Authorization).toBe('Bearer at_123');
  });

  it('returns nothing for 204 responses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(204));
    await expect(
      apiRequest('/x', { fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: 'https://api.example' }),
    ).resolves.toBeUndefined();
  });

  it('throws ApiError with the server error code', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(response(422, { error: { code: 'invalid_email', message: 'Bad', field: 'email' } }));
    await expect(
      apiRequest('/x', { fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: 'https://api.example' }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 422, code: 'invalid_email', field: 'email' });
  });

  it('throws ApiError even when the error body is not JSON', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 502, text: async () => '<html>' });
    await expect(
      apiRequest('/x', { fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: 'https://api.example' }),
    ).rejects.toMatchObject({ status: 502, code: null });
  });

  it('wraps connection failures in NetworkError', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(
      apiRequest('/x', { fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: 'https://api.example' }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('classifies errors', () => {
    expect(isNetworkError(new NetworkError())).toBe(true);
    expect(isAuthError(new ApiError('x', 401))).toBe(true);
    expect(isAuthError(new ApiError('x', 403))).toBe(false);
    expect(isTransientError(new ApiError('x', 503))).toBe(true);
    expect(isTransientError(new ApiError('x', 429))).toBe(true);
    expect(isTransientError(new ApiError('x', 422))).toBe(false);
    expect(isTransientError(new NetworkError())).toBe(true);
  });
});
