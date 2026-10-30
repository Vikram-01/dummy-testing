import type { Db } from '../db/types';
import type { FetchLike } from '../net/http';

export interface Logger {
  info(sourceId: string | null, msg: string, extra?: { newItems?: number; durationMs?: number }): Promise<void>;
  warn(sourceId: string | null, msg: string, extra?: { newItems?: number; durationMs?: number }): Promise<void>;
  error(sourceId: string | null, msg: string, extra?: { newItems?: number; durationMs?: number }): Promise<void>;
}

export interface SyncContext {
  db: Db;
  fetch: FetchLike;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  log: Logger;
  retentionDays: number;
  nvdApiKey?: string | null;
  githubToken?: string | null;
  signal?: AbortSignal;
  /** Overrides for tests (smaller pages, no rate-limit waits). */
  tuning?: Partial<Tuning>;
}

export interface Tuning {
  nvdPageSize: number;
  nvdDelayNoKeyMs: number;
  nvdDelayWithKeyMs: number;
  ghsaPerPage: number;
  ghsaMaxPages: number;
  enrichPerRun: number;
  retries: number;
  backoffMs: number;
}

export const DEFAULT_TUNING: Tuning = {
  nvdPageSize: 2000,
  nvdDelayNoKeyMs: 6500, // public limit: 5 requests / 30 s
  nvdDelayWithKeyMs: 700, // keyed limit: 50 requests / 30 s
  ghsaPerPage: 100,
  ghsaMaxPages: 8, // unauthenticated limit: 60 requests / hour
  enrichPerRun: 15,
  retries: 3,
  backoffMs: 2000,
};

export function tuning(ctx: SyncContext): Tuning {
  return { ...DEFAULT_TUNING, ...ctx.tuning };
}

export async function markSourceAttempt(db: Db, id: string, now: number) {
  await db.run('UPDATE sources SET last_attempt_at = ? WHERE id = ?', [now, id]);
}

export async function markSourceSuccess(db: Db, id: string, now: number, count: number, extra: { etag?: string | null; lastModified?: string | null; cursor?: string | null } = {}) {
  await db.run(
    `UPDATE sources SET last_success_at = ?, last_status = 'ok', last_error = NULL, last_item_count = ?, consecutive_failures = 0,
       etag = COALESCE(?, etag), last_modified_header = COALESCE(?, last_modified_header), cursor = COALESCE(?, cursor)
     WHERE id = ?`,
    [now, count, extra.etag ?? null, extra.lastModified ?? null, extra.cursor ?? null, id],
  );
}

export async function markSourceError(db: Db, id: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  await db.run(
    `UPDATE sources SET last_status = 'error', last_error = ?, consecutive_failures = consecutive_failures + 1 WHERE id = ?`,
    [msg.slice(0, 500), id],
  );
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
