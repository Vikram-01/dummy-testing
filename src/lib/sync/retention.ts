import type { Db } from '../db/types';
import { getMeta } from '../repo/settings';

export interface PurgeResult {
  articles: number;
  cves: number;
  runs: number;
  cutoff: number;
}

/**
 * Age-based retention (default 5 days).
 *
 * - The cutoff is measured back from the LAST SUCCESSFUL SYNC, not from the
 *   wall clock. A device that has been offline for a week keeps its last
 *   5 days of data instead of purging everything; data is never removed
 *   because a source happens to be unavailable.
 * - Bookmarked articles and CVEs are never purged.
 * - Articles: kept while published within the window.
 * - CVEs: kept while published, modified or added to CISA KEV within the window.
 * - Sync history: runs (and their logs, via FK cascade) older than the window.
 * - The CISA KEV catalog itself is reference data replaced on each sync, so
 *   it is not trimmed (the KEV screen and "in KEV" flags depend on it).
 */
export async function purgeExpired(db: Db, retentionDays: number, now = Date.now()): Promise<PurgeResult> {
  const lastOk = Number((await getMeta(db, 'lastSuccessAt')) ?? NaN);
  const anchor = Number.isFinite(lastOk) ? Math.min(now, lastOk) : now;
  const cutoff = anchor - retentionDays * 86_400_000;
  return db.transaction(async () => {
    const a = await db.run(
      `DELETE FROM articles WHERE published_at < ?
         AND NOT EXISTS (SELECT 1 FROM bookmarks b WHERE b.item_type = 'article' AND b.item_ref = CAST(articles.id AS TEXT))`,
      [cutoff],
    );
    const c = await db.run(
      `DELETE FROM cves WHERE MAX(COALESCE(published_at,0), COALESCE(last_modified_at,0), COALESCE(kev_date_added,0), fetched_at * (published_at IS NULL)) < ?
         AND NOT EXISTS (SELECT 1 FROM bookmarks b WHERE b.item_type = 'cve' AND b.item_ref = cves.id)`,
      [cutoff],
    );
    const r = await db.run(`DELETE FROM sync_runs WHERE started_at < ? AND status <> 'running'`, [cutoff]);
    // Bookmarks whose target no longer exists (e.g. removed before exemption) are cleaned up.
    await db.run(`DELETE FROM bookmarks WHERE item_type = 'article' AND NOT EXISTS (SELECT 1 FROM articles WHERE CAST(articles.id AS TEXT) = bookmarks.item_ref)`);
    return { articles: a.changes, cves: c.changes, runs: r.changes, cutoff };
  });
}
