import { ApiError, apiRequest, isAuthError, type ApiRequester, type ApiRequestOptions } from '@/lib/api/client';
import type { JsonStore } from '@/lib/secure-storage';

export const CREDENTIALS_KEY = 'auth-credentials';
const EXPIRY_MARGIN_MS = 60_000;

export type Credentials = {
  userId: string;
  accountKey: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
};

type RegisterResponse = { user_id: string; account_key: string; tokens: TokenResponse };

export type RegisterInput = { name: string; intervalDays: number; timezone?: string };

export class AuthFailedError extends ApiError {
  constructor() {
    super('Authentication failed', 401, 'auth_failed');
    this.name = 'AuthFailedError';
  }
}

/**
 * Keeps the app signed in without user interaction: refresh the access token, and if
 * the refresh token is gone too, sign in again with the device-bound account key.
 */
export class AuthSession {
  private credentials: Credentials | null = null;
  private loaded = false;
  private renewing: Promise<Credentials> | null = null;

  constructor(
    private readonly store: JsonStore,
    private readonly request: ApiRequester = apiRequest,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async load(): Promise<Credentials | null> {
    if (!this.loaded) {
      this.credentials = await this.store.get<Credentials>(CREDENTIALS_KEY);
      this.loaded = true;
    }
    return this.credentials;
  }

  private async save(credentials: Credentials): Promise<Credentials> {
    this.credentials = credentials;
    this.loaded = true;
    await this.store.set(CREDENTIALS_KEY, credentials);
    return credentials;
  }

  private apply(base: Credentials, tokens: TokenResponse): Credentials {
    return {
      ...base,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessExpiresAt: tokens.access_expires_at,
    };
  }

  async hasCredentials(): Promise<boolean> {
    return (await this.load()) !== null;
  }

  async userId(): Promise<string | null> {
    return (await this.load())?.userId ?? null;
  }

  async register(input: RegisterInput): Promise<Credentials> {
    const response = await this.request<RegisterResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: { name: input.name, check_in_interval_days: input.intervalDays, timezone: input.timezone ?? null },
    });
    return this.save(
      this.apply(
        { userId: response.user_id, accountKey: response.account_key, accessToken: '', refreshToken: '', accessExpiresAt: '' },
        response.tokens,
      ),
    );
  }

  private async renew(current: Credentials): Promise<Credentials> {
    try {
      const tokens = await this.request<TokenResponse>('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refresh_token: current.refreshToken },
      });
      return await this.save(this.apply(current, tokens));
    } catch (error) {
      if (!isAuthError(error)) throw error;
    }
    try {
      const tokens = await this.request<TokenResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: { user_id: current.userId, account_key: current.accountKey },
      });
      return await this.save(this.apply(current, tokens));
    } catch (error) {
      if (isAuthError(error)) throw new AuthFailedError();
      throw error;
    }
  }

  private renewOnce(current: Credentials): Promise<Credentials> {
    if (!this.renewing) {
      this.renewing = this.renew(current).finally(() => {
        this.renewing = null;
      });
    }
    return this.renewing;
  }

  private isFresh(credentials: Credentials): boolean {
    const expires = Date.parse(credentials.accessExpiresAt);
    return Number.isFinite(expires) && expires - EXPIRY_MARGIN_MS > this.now().getTime();
  }

  async authorizedRequest<T>(path: string, options: Omit<ApiRequestOptions, 'token'> = {}): Promise<T> {
    let credentials = await this.load();
    if (!credentials) throw new AuthFailedError();
    if (!this.isFresh(credentials)) credentials = await this.renewOnce(credentials);
    try {
      return await this.request<T>(path, { ...options, token: credentials.accessToken });
    } catch (error) {
      if (!isAuthError(error)) throw error;
      credentials = await this.renewOnce(credentials);
      return this.request<T>(path, { ...options, token: credentials.accessToken });
    }
  }

  async clear(): Promise<void> {
    this.credentials = null;
    this.loaded = true;
    await this.store.remove(CREDENTIALS_KEY);
  }
}
