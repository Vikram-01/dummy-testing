import type { Db } from '../db/types';
import type { FetchLike } from '../net/http';
import { cvesNeedingEnrichment } from '../repo/cves';
import { getMeta, getSettings, setMeta } from '../repo/settings';
import type { SourceRow, SyncRunRow } from '../repo/types';
import { DEFAULT_TUNING, errMsg, Logger, SyncContext, Tuning } from './context';
import { enrichCve } from './enrich';
import { syncGhsa } from './ghsa';
import { applyKevFlags, syncKev } from './kev';
import { syncAllNews } from './news';
import { fetchNvdCve, syncNvd } from './nvd';
import { purgeExpired } from './retention';

export type SyncTrigger = 'background' | 'manual' | 'startup' | 'test';

export interface SyncDeps {
  db: Db;
  fetch: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  nvdApiKey?: string | null;
  githubToken?: string | null;
  signal?: AbortSignal;
  tuning?: Partial<Tuning>;
  /** Restrict to these source ids (manual "sync this source"). */
  onlySources?: string[];
  onProgress?: (msg: string) => void;
}

export interface SyncSummary {
  runId: number | null;
  status: SyncRunRow['status'];
  newArticles: number;
  newCves: number;
  updatedCves: number;
  newKev: string[];
  purged: number;
  failedSources: string[];
  message: string;
}

const LOCK_KEY = 'syncLock';
const LOCK_STALE_MS = 25 * 60_000;

/** In-process guard: background task and UI share one JS runtime on Android. */
let inProcessRun = false;
export const isSyncRunning = () => inProcessRun;

/** Called at app start and at the start of every background run. */
export async function recoverInterruptedRuns(db: Db, now = Date.now(), opts: { appStart?: boolean } = {}): Promise<number> {
  const lock = Number((await getMeta(db, LOCK_KEY)) ?? 0);
  const lockLive = !!lock && now - lock < LOCK_STALE_MS;
  // While a live lock exists another pass may genuinely be running in this
  // process, so only a cold app start (or a stale lock) may reclaim it.
  if (inProcessRun || (lockLive && !opts.appStart)) return 0;
  const r = await db.run(`UPDATE sync_runs SET status = 'interrupted', finished_at = ?, message = COALESCE(message, 'Interrupted (app closed or killed during sync)') WHERE status = 'running'`, [now]);
  if (lock) await setMeta(db, LOCK_KEY, null);
  return r.changes;
}

async function acquireLock(db: Db, now: number): Promise<boolean> {
  return db.transaction(async () => {
    const lock = Number((await getMeta(db, LOCK_KEY)) ?? 0);
    if (lock && now - lock < LOCK_STALE_MS) return false;
    await setMeta(db, LOCK_KEY, String(now));
    return true;
  });
}

function makeLogger(db: Db, runId: number, now: () => number, onProgress?: (m: string) => void): Logger {
  const write = (level: 'info' | 'warn' | 'error') => async (sourceId: string | null, message: string, extra?: { newItems?: number; durationMs?: number }) => {
    await db.run('INSERT INTO sync_logs (run_id, source_id, level, message, new_items, duration_ms, at) VALUES (?,?,?,?,?,?,?)', [
      runId,
      sourceId,
      level,
      message.slice(0, 1000),
      extra?.newItems ?? 0,
      extra?.durationMs ?? null,
      now(),
    ]);
    onProgress?.(`${sourceId ?? 'sync'}: ${message}`);
  };
  return { info: write('info'), warn: write('warn'), error: write('error') };
}

/**
 * Runs one full synchronization pass. Safe to call from the background task
 * and from the UI at the same time: a DB lock makes the second caller skip.
 * Individual source failures are logged and never remove stored data.
 */
export async function runSync(deps: SyncDeps, trigger: SyncTrigger): Promise<SyncSummary> {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const { db } = deps;
  const settings = await getSettings(db);
  await recoverInterruptedRuns(db, now());

  if (inProcessRun || !(await acquireLock(db, now()))) {
    return { runId: null, status: 'skipped', newArticles: 0, newCves: 0, updatedCves: 0, newKev: [], purged: 0, failedSources: [], message: 'Another sync is already running' };
  }

  inProcessRun = true;
  const started = now();
  const run = await db.run(`INSERT INTO sync_runs (trigger, started_at, status) VALUES (?, ?, 'running')`, [trigger, started]);
  const runId = run.lastInsertRowId;
  const log = makeLogger(db, runId, now, deps.onProgress);
  const ctx: SyncContext = {
    db, fetch: deps.fetch, now, sleep, log,
    retentionDays: settings.retentionDays,
    nvdApiKey: deps.nvdApiKey, githubToken: deps.githubToken,
    signal: deps.signal, tuning: deps.tuning,
  };

  const summary: SyncSummary = { runId, status: 'running', newArticles: 0, newCves: 0, updatedCves: 0, newKev: [], purged: 0, failedSources: [], message: '' };
  let okCount = 0;
  let attempted = 0;
  try {
    const all = await db.all<SourceRow>('SELECT * FROM sources');
    const enabled = all.filter((s) => (settings.enabledSources[s.id] ?? true) && s.enabled === 1 && (!deps.onlySources || deps.onlySources.includes(s.id)));
    const byId = (id: string) => enabled.find((s) => s.id === id);

    // 1. News feeds (bounded concurrency)
    const news = enabled.filter((s) => s.kind === 'news');
    const newsResults = await syncAllNews(ctx, news);
    for (const r of newsResults) {
      attempted++;
      if (r.ok) okCount++;
      else summary.failedSources.push(r.sourceId);
      summary.newArticles += r.newItems;
    }

    // 2. CISA KEV first, so NVD's incremental pass recognises KEV-listed CVEs
    const kevSrc = byId('cisa-kev');
    if (kevSrc) {
      attempted++;
      const r = await syncKev(ctx, kevSrc);
      if (r.ok) okCount++;
      else summary.failedSources.push(kevSrc.id);
      summary.newKev = r.newEntries;
    }

    // 3. NVD (authoritative CVE data)
    const nvdSrc = byId('nvd');
    if (nvdSrc) {
      attempted++;
      const r = await syncNvd(ctx, nvdSrc);
      if (r.ok) okCount++;
      else summary.failedSources.push(nvdSrc.id);
      summary.newCves += r.newCves;
      summary.updatedCves += r.updatedCves;
    }

    // 4. GitHub Security Advisories
    const ghsaSrc = byId('ghsa');
    if (ghsaSrc) {
      attempted++;
      const r = await syncGhsa(ctx, ghsaSrc);
      if (r.ok) okCount++;
      else summary.failedSources.push(ghsaSrc.id);
      summary.newCves += r.newCves;
      summary.updatedCves += r.updatedCves;
    }

    await applyKevFlags(db);

    // 5. Pull newly added KEV CVEs that NVD did not return in this window
    if (nvdSrc && summary.newKev.length) {
      const t = { ...DEFAULT_TUNING, ...deps.tuning };
      let fetched = 0;
      for (const id of summary.newKev.slice(0, 5)) {
        if (await db.get('SELECT 1 AS x FROM cves WHERE id = ?', [id])) continue;
        try {
          await sleep(deps.nvdApiKey ? t.nvdDelayWithKeyMs : t.nvdDelayNoKeyMs);
          if (await fetchNvdCve(ctx, id)) fetched++;
        } catch (e) {
          await log.warn('nvd', `Could not fetch new KEV entry ${id}: ${errMsg(e)}`);
        }
      }
      if (fetched) {
        await applyKevFlags(db);
        await log.info('nvd', `Fetched ${fetched} newly KEV-listed CVE record(s)`);
      }
    }

    // 6. Enrichment from CVE.org + OSV for high-value CVEs (bounded per run)
    const enrichOn = (byId('cve-org') || byId('osv')) && !deps.signal?.aborted;
    if (enrichOn) {
      const ids = await cvesNeedingEnrichment(db, { ...DEFAULT_TUNING, ...deps.tuning }.enrichPerRun);
      let enriched = 0;
      const errs: string[] = [];
      for (const id of ids) {
        if (deps.signal?.aborted) break;
        const r = await enrichCve(ctx, id);
        if (r.cveOrg || r.osv) enriched++;
        errs.push(...r.errors);
      }
      if (ids.length) {
        await (errs.length ? log.warn : log.info)('cve-org', `Enriched ${enriched}/${ids.length} CVE(s) from CVE.org and OSV.dev${errs.length ? `; ${errs.length} lookup error(s): ${errs[0]}` : ''}`);
      }
    }

    if (okCount > 0) await setMeta(db, 'lastSuccessAt', String(now()));
    await setMeta(db, 'lastRunAt', String(now()));

    // 7. Retention (anchored to last successful sync; bookmarks exempt)
    const purge = await purgeExpired(db, settings.retentionDays, now());
    summary.purged = purge.articles + purge.cves;
    if (summary.purged || purge.runs) {
      await log.info(null, `Retention (${settings.retentionDays} days): removed ${purge.articles} article(s), ${purge.cves} CVE(s), ${purge.runs} old sync run(s)`);
    }

    summary.status = attempted === 0 ? 'success' : okCount === attempted ? 'success' : okCount === 0 ? 'failed' : 'partial';
    summary.message =
      `${summary.newArticles} new articles, ${summary.newCves} new CVEs, ${summary.updatedCves} updated, ${summary.newKev.length} new KEV` +
      (summary.failedSources.length ? ` — ${summary.failedSources.length} source(s) unavailable` : '');
  } catch (e) {
    summary.status = okCount > 0 ? 'partial' : 'failed';
    summary.message = `Sync aborted: ${errMsg(e)}`;
    await log.error(null, summary.message);
  } finally {
    await db.run(
      `UPDATE sync_runs SET finished_at = ?, status = ?, new_articles = ?, new_cves = ?, updated_cves = ?, new_kev = ?, purged = ?, message = ? WHERE id = ?`,
      [now(), summary.status, summary.newArticles, summary.newCves, summary.updatedCves, summary.newKev.length, summary.purged, summary.message, runId],
    );
    await setMeta(db, LOCK_KEY, null);
    inProcessRun = false;
  }
  return summary;
}

export async function nextScheduledSync(db: Db): Promise<number | null> {
  const s = await getSettings(db);
  const last = Number((await getMeta(db, 'lastRunAt')) ?? NaN);
  if (!Number.isFinite(last)) return null;
  return last + s.syncIntervalMinutes * 60_000;
}

/** True when an automatic run is due (used on app foreground as a safety net). */
export async function isSyncDue(db: Db, now = Date.now()): Promise<boolean> {
  const next = await nextScheduledSync(db);
  return next == null || now >= next;
}
