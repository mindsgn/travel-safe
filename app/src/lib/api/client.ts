import { getApiBaseUrl } from '@/lib/config';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type ApiRequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
};

export function joinApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = joinApiUrl(options.baseUrl ?? getApiBaseUrl(), path);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetchImpl(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw new ApiError(`Request failed with ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}
