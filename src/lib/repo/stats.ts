import type { Db } from '../db/types';
import { getMeta } from './settings';
import type { CveRow, KevRow, Severity, SourceRow, SyncLogRow, SyncRunRow } from './types';

export interface DashboardStats {
  totalArticles: number;
  articlesToday: number;
  totalCves: number;
  criticalCves: number;
  highCves: number;
  cvss9Plus: number;
  kevInWindow: number;
  kevTotal: number;
  severity: { severity: Severity; n: number }[];
  bySource: { source_id: string; name: string; n: number }[];
  latestCves: CveRow[];
  exploitedAlerts: KevRow[];
  lastRun: SyncRunRow | null;
  lastSuccessAt: number | null;
  sourcesFailing: number;
  sourcesTotal: number;
}

export function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function dashboardStats(db: Db, retentionDays: number, now = Date.now()): Promise<DashboardStats> {
  const n = async (sql: string, p: (string | number)[] = []) => (await db.get<{ n: number }>(sql, p))?.n ?? 0;
  const windowStart = now - retentionDays * 86_400_000;
  const [totalArticles, articlesToday, totalCves, criticalCves, highCves, cvss9Plus, kevInWindow, kevTotal] = await Promise.all([
    n('SELECT COUNT(*) AS n FROM articles'),
    n('SELECT COUNT(*) AS n FROM articles WHERE published_at >= ?', [startOfLocalDay(now)]),
    n('SELECT COUNT(*) AS n FROM cves'),
    n(`SELECT COUNT(*) AS n FROM cves WHERE severity = 'CRITICAL'`),
    n(`SELECT COUNT(*) AS n FROM cves WHERE severity = 'HIGH'`),
    n('SELECT COUNT(*) AS n FROM cves WHERE cvss_score >= 9'),
    n('SELECT COUNT(*) AS n FROM kev_catalog WHERE date_added >= ?', [windowStart]),
    n('SELECT COUNT(*) AS n FROM kev_catalog'),
  ]);
  const severity = await db.all<{ severity: Severity; n: number }>('SELECT severity, COUNT(*) AS n FROM cves GROUP BY severity');
  const bySource = await db.all<{ source_id: string; name: string; n: number }>(
    'SELECT a.source_id, s.name, COUNT(*) AS n FROM articles a JOIN sources s ON s.id = a.source_id GROUP BY a.source_id ORDER BY n DESC',
  );
  const latestCves = await db.all<CveRow>(
    `SELECT c.*, 0 AS bookmarked FROM cves c WHERE c.id LIKE 'CVE-%' ORDER BY COALESCE(c.published_at,0) DESC LIMIT 5`,
  );
  const exploitedAlerts = await db.all<KevRow>(
    `SELECT k.*, c.cvss_score, c.severity, (c.id IS NOT NULL) AS in_db FROM kev_catalog k LEFT JOIN cves c ON c.id = k.cve_id
     WHERE k.date_added >= ? ORDER BY k.date_added DESC LIMIT 5`,
    [windowStart],
  );
  const lastRun = await db.get<SyncRunRow>(`SELECT * FROM sync_runs WHERE status <> 'running' ORDER BY started_at DESC LIMIT 1`);
  const ls = await getMeta(db, 'lastSuccessAt');
  const failing = await n(`SELECT COUNT(*) AS n FROM sources WHERE enabled = 1 AND last_status = 'error'`);
  const total = await n('SELECT COUNT(*) AS n FROM sources WHERE enabled = 1');
  return {
    totalArticles, articlesToday, totalCves, criticalCves, highCves, cvss9Plus, kevInWindow, kevTotal,
    severity, bySource, latestCves, exploitedAlerts, lastRun,
    lastSuccessAt: ls ? Number(ls) : null, sourcesFailing: failing, sourcesTotal: total,
  };
}

export async function listSources(db: Db): Promise<SourceRow[]> {
  return db.all<SourceRow>('SELECT * FROM sources ORDER BY kind DESC, name');
}

export async function listRuns(db: Db, limit = 30, offset = 0): Promise<SyncRunRow[]> {
  return db.all<SyncRunRow>('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ? OFFSET ?', [limit, offset]);
}

export async function listRunLogs(db: Db, runId: number): Promise<SyncLogRow[]> {
  return db.all<SyncLogRow>('SELECT * FROM sync_logs WHERE run_id = ? ORDER BY id', [runId]);
}

export async function distinctVendors(db: Db, limit = 200): Promise<string[]> {
  const rows = await db.all<{ vendor: string }>(
    `SELECT vendor FROM affected_products WHERE vendor <> '' GROUP BY vendor ORDER BY COUNT(*) DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.vendor);
}
