import type { FetchLike } from '../../src/lib/net/http';

export interface Call {
  url: string;
  headers: Record<string, string>;
}

type Handler = (url: string, headers: Record<string, string>, n: number) => Response | Promise<Response>;

/**
 * Route-based fetch double. Routes are matched by URL prefix (longest wins).
 * Unrouted URLs fail like an unreachable host.
 */
export function fakeFetch(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const counts = new Map<string, number>();
  const fn: FetchLike = async (url, init) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers as HeadersInit).forEach((v, k) => (headers[k.toLowerCase()] = v));
    calls.push({ url, headers });
    const key = Object.keys(routes)
      .filter((p) => url.startsWith(p))
      .sort((a, b) => b.length - a.length)[0];
    if (!key) throw new TypeError(`Network request failed: ${url}`);
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    return routes[key](url, headers, n);
  };
  return { fetch: fn, calls, routes };
}

export const xml = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/rss+xml', ...headers } });
export const json = (body: unknown, headers: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
export const status = (code: number, headers: Record<string, string> = {}) => new Response(code === 304 ? null : 'error', { status: code, headers });
