import * as SQLite from 'expo-sqlite';
import type { Db, RunResult, SqlValue } from './types';

/**
 * expo-sqlite adapter. A single connection is shared by the UI and the
 * background task (same JS runtime). Transactions are serialized with a
 * promise queue so concurrent sync workers never interleave BEGIN/COMMIT.
 */
export function wrapExpoDb(raw: SQLite.SQLiteDatabase): Db {
  let queue: Promise<unknown> = Promise.resolve();
  const db: Db = {
    exec: (sql) => raw.execAsync(sql),
    run: async (sql, params: SqlValue[] = []): Promise<RunResult> => {
      const r = await raw.runAsync(sql, params);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    all: (sql, params: SqlValue[] = []) => raw.getAllAsync(sql, params),
    get: (sql, params: SqlValue[] = []) => raw.getFirstAsync(sql, params),
    transaction: <T>(fn: () => Promise<T>): Promise<T> => {
      const next = queue.then(async () => {
        await raw.execAsync('BEGIN IMMEDIATE');
        try {
          const out = await fn();
          await raw.execAsync('COMMIT');
          return out;
        } catch (e) {
          await raw.execAsync('ROLLBACK').catch(() => undefined);
          throw e;
        }
      });
      queue = next.catch(() => undefined);
      return next;
    },
  };
  return db;
}

let instance: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!instance) {
    instance = (async () => {
      const raw = await SQLite.openDatabaseAsync('vigil.db');
      await raw.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      const db = wrapExpoDb(raw);
      const { migrate } = await import('./migrations');
      await migrate(db);
      return db;
    })();
    instance.catch(() => {
      instance = null;
    });
  }
  return instance;
}
