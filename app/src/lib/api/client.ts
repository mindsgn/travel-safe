import { getApiBaseUrl } from '@/lib/config';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly field: string | null;

  constructor(message: string, status: number, code: string | null = null, field: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

/** The request never reached the server (offline, DNS, TLS, or timeout). */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
};

export type ApiRequester = <T>(path: string, options?: ApiRequestOptions) => Promise<T>;

const DEFAULT_TIMEOUT_MS = 15_000;

export function joinApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

type ErrorBody = { error?: { code?: string; message?: string; field?: string | null } };

async function readError(response: Response): Promise<ApiError> {
  let body: ErrorBody | null = null;
  try {
    body = JSON.parse(await response.text()) as ErrorBody;
  } catch {
    body = null;
  }
  const error = body?.error;
  return new ApiError(
    error?.message ?? `Request failed with ${response.status}`,
    response.status,
    error?.code ?? null,
    error?.field ?? null,
  );
}

export const apiRequest: ApiRequester = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = joinApiUrl(options.baseUrl ?? getApiBaseUrl(), path);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
};

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Server-side outages (5xx, 429) are transient; other 4xx mean the request itself is wrong. */
export function isTransientError(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  return error instanceof ApiError && (error.status >= 500 || error.status === 429);
}
