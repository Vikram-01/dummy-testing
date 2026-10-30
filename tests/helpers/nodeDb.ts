import Database from 'better-sqlite3';
import type { Db, SqlValue } from '../../src/lib/db/types';
import { migrate } from '../../src/lib/db/migrations';

/** better-sqlite3 implementation of the app's Db interface (real SQLite). */
export function nodeDb(file = ':memory:'): Db & { raw: Database.Database; close(): void } {
  const raw = new Database(file);
  raw.pragma('foreign_keys = ON');
  const norm = (p: SqlValue[] = []) => p.map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
  let queue: Promise<unknown> = Promise.resolve();
  return {
    raw,
    close: () => raw.close(),
    exec: async (sql) => {
      raw.exec(sql);
    },
    run: async (sql, params) => {
      const r = raw.prepare(sql).run(...norm(params));
      return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) };
    },
    all: async <T>(sql: string, params?: SqlValue[]) => raw.prepare(sql).all(...norm(params)) as T[],
    get: async <T>(sql: string, params?: SqlValue[]) => (raw.prepare(sql).get(...norm(params)) as T) ?? null,
    transaction: <T>(fn: () => Promise<T>) => {
      const next = queue.then(async () => {
        raw.exec('BEGIN IMMEDIATE');
        try {
          const out = await fn();
          raw.exec('COMMIT');
          return out;
        } catch (e) {
          raw.exec('ROLLBACK');
          throw e;
        }
      });
      queue = next.catch(() => undefined);
      return next as Promise<T>;
    },
  };
}

export async function freshDb(file?: string) {
  const db = nodeDb(file);
  await migrate(db);
  return db;
}
