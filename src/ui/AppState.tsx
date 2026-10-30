import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { registerBackgroundSync, performSync } from '../lib/background/task';
import { getDb } from '../lib/db/expoDb';
import type { Db } from '../lib/db/types';
import { AppSettings, DEFAULT_SETTINGS, getSettings, saveSettings } from '../lib/repo/settings';
import { isSyncDue, isSyncRunning, recoverInterruptedRuns, SyncSummary } from '../lib/sync/engine';

interface Ctx {
  db: Db | null;
  error: string | null;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  syncing: boolean;
  progress: string | null;
  lastSummary: SyncSummary | null;
  backgroundStatus: 'registered' | 'restricted' | 'unknown';
  /** Bumped whenever stored data changes; lists re-query on change. */
  dataVersion: number;
  bump: () => void;
  syncNow: (onlySources?: string[]) => Promise<SyncSummary | null>;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [backgroundStatus, setBg] = useState<Ctx['backgroundStatus']>('unknown');
  const syncingRef = useRef(false);
  const bump = useCallback(() => setDataVersion((v) => v + 1), []);

  const syncNow = useCallback(
    async (onlySources?: string[]) => {
      if (syncingRef.current || isSyncRunning()) return null;
      syncingRef.current = true;
      setSyncing(true);
      setProgress('Starting sync');
      try {
        const s = await performSync('manual', onlySources, (m) => setProgress(m));
        setLastSummary(s);
        return s;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        syncingRef.current = false;
        setSyncing(false);
        setProgress(null);
        bump();
      }
    },
    [bump],
  );

  // Boot: open DB, run migrations, recover interrupted runs, register background job.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getDb();
        await recoverInterruptedRuns(d, Date.now(), { appStart: true });
        const s = await getSettings(d);
        if (!alive) return;
        setDb(d);
        setSettings(s);
        registerBackgroundSync(s.syncIntervalMinutes).then(setBg).catch(() => setBg('restricted'));
        if (await isSyncDue(d)) {
          syncingRef.current = true;
          setSyncing(true);
          performSync('startup', undefined, (m) => alive && setProgress(m))
            .then((sum) => alive && setLastSummary(sum))
            .catch(() => undefined)
            .finally(() => {
              syncingRef.current = false;
              if (!alive) return;
              setSyncing(false);
              setProgress(null);
              setDataVersion((v) => v + 1);
            });
        }
      } catch (e) {
        if (alive) setError(`Could not open the local database: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Safety net: when returning to the foreground, run if a sync is overdue.
  useEffect(() => {
    if (!db) return;
    const sub = RNAppState.addEventListener('change', async (st) => {
      if (st !== 'active') return;
      bump();
      if (!syncingRef.current && (await isSyncDue(db))) syncNow();
    });
    return () => sub.remove();
  }, [db, syncNow, bump]);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      if (!db) return;
      const next = await saveSettings(db, patch);
      setSettings(next);
      if (patch.syncIntervalMinutes != null) registerBackgroundSync(next.syncIntervalMinutes).then(setBg).catch(() => setBg('restricted'));
      bump();
    },
    [db, bump],
  );

  return (
    <AppCtx.Provider value={{ db, error, settings, updateSettings, syncing, progress, lastSummary, backgroundStatus, dataVersion, bump, syncNow }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

/** Non-null DB accessor for screens rendered after boot. */
export function useDb(): Db {
  const { db } = useApp();
  if (!db) throw new Error('Database not ready');
  return db;
}
