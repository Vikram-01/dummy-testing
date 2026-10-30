/**
 * Minimal async database interface. The app uses expo-sqlite; tests use
 * better-sqlite3 through the same interface, so all repository and sync
 * logic is exercised against a real SQLite engine.
 *
 * Every query MUST use bound parameters (`?`). String-built SQL with user or
 * feed data is never allowed (SQL-injection guard).
 */
export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Runs `fn` inside a single transaction; rolls back on throw. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
