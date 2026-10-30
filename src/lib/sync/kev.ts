import type { Db } from '../db/types';
import { httpGetJson } from '../net/http';
import { stripHtml } from '../parse/sanitize';
import { CVE_ID_RE } from '../repo/cves';
import type { SourceRow } from '../repo/types';
import { errMsg, markSourceAttempt, markSourceError, markSourceSuccess, SyncContext, tuning } from './context';

export interface KevEntry {
  cveID: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded: string; // YYYY-MM-DD
  shortDescription?: string;
  requiredAction?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string; // "Known" | "Unknown"
  notes?: string;
}

export interface KevCatalog {
  title?: string;
  catalogVersion?: string;
  dateReleased?: string;
  count?: number;
  vulnerabilities: KevEntry[];
}

/** KEV dates are calendar dates (US Eastern publication); store as UTC midnight. */
export function kevDate(s?: string): number | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return Date.parse(`${s}T00:00:00Z`);
}

export interface KevSyncResult {
  sourceId: string;
  ok: boolean;
  newEntries: string[];
  error?: string;
}

/**
 * Downloads the full CISA KEV catalog (conditional GET; ~1-2 MB when changed),
 * upserts it, and returns the CVE IDs that are new since the last sync.
 * KEV listing is CISA's confirmation of active exploitation, so it is the
 * app's only "verified exploited" signal.
 */
export async function syncKev(ctx: SyncContext, src: SourceRow): Promise<KevSyncResult> {
  const { db } = ctx;
  const started = ctx.now();
  await markSourceAttempt(db, src.id, started);
  try {
    const headers: Record<string, string> = {};
    if (src.etag) headers['If-None-Match'] = src.etag;
    if (src.last_modified_header) headers['If-Modified-Since'] = src.last_modified_header;
    const t = tuning(ctx);
    const res = await httpGetJson<KevCatalog>(ctx.fetch, src.url, { headers, retries: t.retries, backoffMs: t.backoffMs, sleep: ctx.sleep, signal: ctx.signal, timeoutMs: 60_000 });
    if (res.notModified) {
      await markSourceSuccess(db, src.id, ctx.now(), 0);
      await applyKevFlags(db);
      await ctx.log.info(src.id, 'KEV catalog not modified', { durationMs: ctx.now() - started });
      return { sourceId: src.id, ok: true, newEntries: [] };
    }
    const cat = res.data;
    if (!cat || !Array.isArray(cat.vulnerabilities) || cat.vulnerabilities.length < 100) {
      // A truncated/empty catalog must never wipe or shrink what we have.
      throw new Error('KEV catalog response looks incomplete; keeping existing data');
    }
    const known = new Set((await db.all<{ cve_id: string }>('SELECT cve_id FROM kev_catalog')).map((r) => r.cve_id));
    const hadAny = known.size > 0;
    const newEntries: string[] = [];
    await db.transaction(async () => {
      for (const v of cat.vulnerabilities) {
        const id = String(v.cveID ?? '').toUpperCase();
        const added = kevDate(v.dateAdded);
        if (!CVE_ID_RE.test(id) || added == null) continue;
        await db.run(
          `INSERT INTO kev_catalog (cve_id, vendor, product, name, description, date_added, due_date, ransomware, required_action, notes, first_seen_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(cve_id) DO UPDATE SET vendor=excluded.vendor, product=excluded.product, name=excluded.name,
             description=excluded.description, date_added=excluded.date_added, due_date=excluded.due_date,
             ransomware=excluded.ransomware, required_action=excluded.required_action, notes=excluded.notes`,
          [
            id,
            stripHtml(v.vendorProject) || null,
            stripHtml(v.product) || null,
            stripHtml(v.vulnerabilityName) || null,
            stripHtml(v.shortDescription) || null,
            added,
            kevDate(v.dueDate),
            v.knownRansomwareCampaignUse === 'Known' ? 'Known' : v.knownRansomwareCampaignUse === 'Unknown' ? 'Unknown' : null,
            stripHtml(v.requiredAction) || null,
            stripHtml(v.notes) || null,
            ctx.now(),
          ],
        );
        // first insert of the whole catalog is a baseline, not "new" alerts
        if (hadAny && !known.has(id)) newEntries.push(id);
        known.add(id);
      }
    });
    await applyKevFlags(db);
    await markSourceSuccess(db, src.id, ctx.now(), newEntries.length, {
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    });
    await ctx.log.info(src.id, `Catalog v${cat.catalogVersion ?? '?'}: ${cat.vulnerabilities.length} entries, ${newEntries.length} newly added`, {
      newItems: newEntries.length,
      durationMs: ctx.now() - started,
    });
    return { sourceId: src.id, ok: true, newEntries };
  } catch (e) {
    await markSourceError(db, src.id, e);
    await ctx.log.error(src.id, errMsg(e), { durationMs: ctx.now() - started });
    return { sourceId: src.id, ok: false, newEntries: [], error: errMsg(e) };
  }
}

/** Copies KEV status onto stored CVE records. */
export async function applyKevFlags(db: Db): Promise<void> {
  await db.run(
    `UPDATE cves SET
       kev = 1,
       kev_date_added = (SELECT date_added FROM kev_catalog k WHERE k.cve_id = cves.id),
       kev_due_date = (SELECT due_date FROM kev_catalog k WHERE k.cve_id = cves.id),
       kev_ransomware = (SELECT ransomware FROM kev_catalog k WHERE k.cve_id = cves.id),
       kev_required_action = (SELECT required_action FROM kev_catalog k WHERE k.cve_id = cves.id),
       title = COALESCE(title, (SELECT name FROM kev_catalog k WHERE k.cve_id = cves.id))
     WHERE id IN (SELECT cve_id FROM kev_catalog)`,
  );
}
