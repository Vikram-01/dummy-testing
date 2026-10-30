export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  constructor(public status: number, message: string, public retryAfterMs?: number) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface HttpOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** Base backoff; doubles each attempt with jitter. */
  backoffMs?: number;
  maxBytes?: number;
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}

export interface HttpResult {
  status: number;
  body: string;
  headers: Headers;
  notModified: boolean;
}

export const USER_AGENT = 'Vigil/1.0 (+security news & CVE reader; Android)';
export const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryable(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function parseRetryAfter(h: string | null): number | undefined {
  if (!h) return undefined;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 120_000);
  const at = Date.parse(h);
  return Number.isFinite(at) ? Math.max(0, Math.min(at - Date.now(), 120_000)) : undefined;
}

/**
 * HTTPS-only GET with timeout, bounded retries, exponential backoff with
 * jitter, Retry-After support and a response-size cap.
 */
export async function httpGet(fetchImpl: FetchLike, url: string, opts: HttpOptions = {}): Promise<HttpResult> {
  if (!url.startsWith('https://')) throw new Error(`Refusing non-HTTPS URL: ${url}`);
  const { retries = 3, backoffMs = 1500, timeoutMs = 30_000, maxBytes = 20_000_000, sleep = defaultSleep } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal?.aborted) throw new Error('Aborted');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const onAbort = () => ctl.abort();
    opts.signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...opts.headers },
        signal: ctl.signal,
        redirect: 'follow',
      });
      if (res.status === 304) return { status: 304, body: '', headers: res.headers, notModified: true };
      if (!res.ok) {
        const ra = parseRetryAfter(res.headers.get('retry-after'));
        throw new HttpError(res.status, `HTTP ${res.status} for ${new URL(url).host}`, ra);
      }
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len > maxBytes) throw new HttpError(413, 'Response too large');
      const body = await res.text();
      if (body.length > maxBytes) throw new HttpError(413, 'Response too large');
      return { status: res.status, body, headers: res.headers, notModified: false };
    } catch (e) {
      lastErr = e;
      const status = e instanceof HttpError ? e.status : 0; // 0 = network/timeout
      if (opts.signal?.aborted) throw e;
      if (attempt === retries || (status !== 0 && !retryable(status))) break;
      const ra = e instanceof HttpError ? e.retryAfterMs : undefined;
      const delay = ra ?? backoffMs * 2 ** attempt * (0.75 + Math.random() * 0.5);
      await sleep(delay);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }
  const host = new URL(url).host;
  if (lastErr instanceof Error && lastErr.name === 'AbortError') throw new Error(`Timed out fetching ${host}`);
  if (lastErr instanceof HttpError) throw lastErr;
  // Network-level failure (DNS, TLS, refused, offline): name the host and cause.
  const cause = (lastErr as { cause?: { code?: string; message?: string } })?.cause;
  const detail = cause?.code ?? cause?.message ?? (lastErr instanceof Error ? lastErr.message : String(lastErr));
  throw new Error(`Could not reach ${host} (${detail})`);
}

export async function httpGetJson<T>(fetchImpl: FetchLike, url: string, opts: HttpOptions = {}): Promise<{ data: T | null; headers: Headers; notModified: boolean }> {
  const r = await httpGet(fetchImpl, url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } });
  if (r.notModified) return { data: null, headers: r.headers, notModified: true };
  try {
    return { data: JSON.parse(r.body) as T, headers: r.headers, notModified: false };
  } catch {
    throw new Error(`Invalid JSON from ${new URL(url).host}`);
  }
}
