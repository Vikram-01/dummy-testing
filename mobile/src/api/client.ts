import { config } from '@/config';
import { log } from '@/lib/log';
import { secureStorage } from '@/lib/secureStorage';
import type { TokenPair } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork() {
    return this.code === 'network' || this.code === 'timeout';
  }
  get isAuth() {
    return this.status === 401;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type DemoHandler = (method: Method, path: string, body?: unknown) => Promise<unknown>;

/** Access token lives in memory only. `demoHandler` is the on-device API when the app runs without a server. */
let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshInFlight: Promise<void> | null = null;
let demoHandler: DemoHandler | null = null;
let baseOverride: string | null = null;
let onSessionExpired: (reason: string) => void = () => undefined;

export const apiSession = {
  setTokens(t: Pick<TokenPair, 'access_token' | 'expires_in'>) {
    accessToken = t.access_token;
    accessExpiresAt = Date.now() + t.expires_in * 1000;
  },
  clear() {
    accessToken = null;
    accessExpiresAt = 0;
  },
  hasAccessToken: () => accessToken != null,
  setDemoHandler(h: DemoHandler | null) {
    demoHandler = h;
  },
  isDemo: () => demoHandler != null,
  setBaseOverride(url: string | null) {
    baseOverride = url;
  },
  onExpired(cb: (reason: string) => void) {
    onSessionExpired = cb;
  },
};

export function baseUrl(): string {
  const b = (config.demoModeAvailable && baseOverride) || config.apiBaseUrl;
  return b.replace(/\/+$/, '');
}

async function rawFetch(method: Method, path: string, body: unknown, token: string | null): Promise<unknown> {
  const root = baseUrl();
  if (!root) throw new ApiError(0, 'not_configured', 'Server address is not configured for this build.');
  if (!root.startsWith('https://')) throw new ApiError(0, 'insecure', 'Only HTTPS connections are allowed.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let res: Response;
  try {
    res = await fetch(root + config.apiPrefix + path, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    throw new ApiError(0, aborted ? 'timeout' : 'network', aborted ? 'The server took too long to respond.' : 'No connection to the server.');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = json?.error;
    const detail = Array.isArray(json?.detail) ? json.detail[0]?.msg : undefined;
    throw new ApiError(res.status, err?.code ?? (res.status === 422 ? 'validation_error' : 'http_' + res.status),
      err?.message ?? detail ?? `Request failed (${res.status})`);
  }
  return json;
}

/** Rotates the refresh token. Concurrent callers share one request. */
export function refreshSession(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const rt = await secureStorage.getRefreshToken();
      if (!rt) throw new ApiError(401, 'no_session', 'Please sign in.');
      try {
        const t = (await rawFetch('POST', '/auth/refresh', { refresh_token: rt }, null)) as TokenPair;
        await secureStorage.setRefreshToken(t.refresh_token);
        await secureStorage.setSessionId(t.session_id);
        apiSession.setTokens(t);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          apiSession.clear();
          await secureStorage.clearSession();
          onSessionExpired(e.code);
        }
        throw e;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function api<T>(method: Method, path: string, opts: { body?: unknown; auth?: boolean } = {}): Promise<T> {
  if (demoHandler) {
    try {
      return (await demoHandler(method, path, opts.body)) as T;
    } catch (e: any) {
      throw new ApiError(e?.status ?? 500, e?.code ?? 'local_error', e?.message ?? 'Something went wrong on this device.');
    }
  }
  const auth = opts.auth ?? true;
  if (auth && (!accessToken || Date.now() > accessExpiresAt - 30_000)) {
    await refreshSession();
  }
  try {
    return (await rawFetch(method, path, opts.body, auth ? accessToken : null)) as T;
  } catch (e) {
    if (auth && e instanceof ApiError && e.status === 401 && e.code !== 'session_revoked') {
      log.debug('access token rejected, refreshing once');
      await refreshSession();
      return (await rawFetch(method, path, opts.body, accessToken)) as T;
    }
    if (e instanceof ApiError && e.code === 'session_revoked') {
      apiSession.clear();
      await secureStorage.clearSession();
      onSessionExpired(e.code);
    }
    throw e;
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return 'Something went wrong. Please try again.';
}
