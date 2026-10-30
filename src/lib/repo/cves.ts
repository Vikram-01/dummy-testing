import type { Db, SqlValue } from '../db/types';
import { likeEscape } from '../parse/sanitize';
import { AffectedRow, CveRow, KevRow, ReferenceRow, Severity, severityFromScore } from './types';

export interface CveReferenceInput {
  url: string;
  tags?: string[];
  source?: string | null;
}

export interface AffectedInput {
  vendor: string;
  product: string;
  ecosystem?: string | null;
  versionSpec: string;
  fixedVersion?: string | null;
}

export interface CveInput {
  id: string;
  title?: string | null;
  description?: string | null;
  cvssScore?: number | null;
  cvssVersion?: string | null;
  cvssVector?: string | null;
  severity?: Severity | null;
  cwes?: string[];
  vulnStatus?: string | null;
  publishedAt?: number | null;
  lastModifiedAt?: number | null;
  references?: CveReferenceInput[];
  affected?: AffectedInput[];
  exploitRefs?: boolean;
  patchAvailable?: boolean;
  remediation?: string | null;
}

const pick = (v: SqlValue[], order: number[]) => order.map((n) => v[n - 1]);

export type UpsertOutcome = 'new' | 'updated' | 'unchanged';

/** Sources whose core fields (description, CVSS, dates) are authoritative. */
const AUTHORITATIVE = new Set(['nvd']);

export const CVE_ID_RE = /^CVE-\d{4}-\d{4,7}$/;
export const GHSA_ID_RE = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;

export async function upsertCve(db: Db, input: CveInput, source: string, now = Date.now()): Promise<UpsertOutcome> {
  const id = input.id.toUpperCase().replace(/^GHSA/, 'GHSA');
  if (!CVE_ID_RE.test(id) && !GHSA_ID_RE.test(input.id)) throw new Error(`Invalid vulnerability id: ${input.id}`);
  const vid = CVE_ID_RE.test(id) ? id : input.id;
  const existing = await db.get<{ last_modified_at: number | null; data_sources: string; patch_available: number; exploit_refs: number }>(
    'SELECT last_modified_at, data_sources, patch_available, exploit_refs FROM cves WHERE id = ?',
    [vid],
  );
  const severity = input.severity ?? (input.cvssScore != null ? severityFromScore(input.cvssScore) : null);
  const cwes = input.cwes?.length ? [...new Set(input.cwes)].join(',') : null;
  const sources = new Set((existing?.data_sources ?? '').split(',').filter(Boolean));
  sources.add(source);
  const dataSources = [...sources].sort().join(',');

  const vals: SqlValue[] = [
    vid,
    input.title ?? null,
    input.description ?? null,
    input.cvssScore ?? null,
    input.cvssVersion ?? null,
    input.cvssVector ?? null,
    severity ?? 'UNKNOWN',
    cwes ?? '',
    input.vulnStatus ?? null,
    input.publishedAt ?? null,
    input.lastModifiedAt ?? null,
    dataSources,
    input.exploitRefs ? 1 : 0,
    input.patchAvailable ? 1 : 0,
    input.remediation ?? null,
    now,
  ];

  let outcome: UpsertOutcome;
  if (!existing) {
    await db.run(
      `INSERT INTO cves (id, title, description, cvss_score, cvss_version, cvss_vector, severity, cwes, vuln_status,
        published_at, last_modified_at, data_sources, exploit_refs, patch_available, remediation, fetched_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      vals,
    );
    outcome = 'new';
  } else if (AUTHORITATIVE.has(source)) {
    if (existing.last_modified_at != null && input.lastModifiedAt != null && input.lastModifiedAt <= existing.last_modified_at && existing.data_sources.includes(source)) {
      outcome = 'unchanged';
    } else {
      await db.run(
        `UPDATE cves SET
          title = COALESCE(?, title), description = COALESCE(?, description),
          cvss_score = COALESCE(?, cvss_score), cvss_version = COALESCE(?, cvss_version), cvss_vector = COALESCE(?, cvss_vector),
          severity = CASE WHEN ? IS NOT NULL THEN ? ELSE severity END,
          cwes = CASE WHEN ? <> '' THEN ? ELSE cwes END,
          vuln_status = COALESCE(?, vuln_status), published_at = COALESCE(?, published_at),
          last_modified_at = COALESCE(?, last_modified_at), data_sources = ?,
          exploit_refs = MAX(exploit_refs, ?), patch_available = MAX(patch_available, ?),
          remediation = COALESCE(remediation, ?), fetched_at = ?
         WHERE id = ?`,
        pick(vals, [2, 3, 4, 5, 6, 4, 7, 8, 8, 9, 10, 11, 12, 13, 14, 15, 16, 1]),
      );
      outcome = 'updated';
    }
  } else {
    // Supplementary source: only fill gaps; never overwrite NVD data.
    await db.run(
      `UPDATE cves SET
        title = COALESCE(title, ?), description = COALESCE(description, ?),
        cvss_score = COALESCE(cvss_score, ?), cvss_version = COALESCE(cvss_version, ?), cvss_vector = COALESCE(cvss_vector, ?),
        severity = CASE WHEN severity = 'UNKNOWN' AND ? <> 'UNKNOWN' THEN ? ELSE severity END,
        cwes = CASE WHEN cwes = '' THEN ? ELSE cwes END,
        published_at = COALESCE(published_at, ?), last_modified_at = MAX(COALESCE(last_modified_at, 0), COALESCE(?, 0)),
        data_sources = ?, exploit_refs = MAX(exploit_refs, ?), patch_available = MAX(patch_available, ?),
        remediation = COALESCE(remediation, ?)
       WHERE id = ?`,
        pick(vals, [2, 3, 4, 5, 6, 7, 7, 8, 10, 11, 12, 13, 14, 15, 1]),
    );
    outcome = existing.data_sources.split(',').includes(source) ? 'unchanged' : 'updated';
  }

  for (const r of input.references ?? []) {
    await db.run(
      `INSERT INTO vuln_references (cve_id, url, source, tags) VALUES (?,?,?,?)
       ON CONFLICT(cve_id, url) DO UPDATE SET tags = CASE WHEN excluded.tags <> '' THEN excluded.tags ELSE vuln_references.tags END`,
      [vid, r.url, r.source ?? source, (r.tags ?? []).join(',')],
    );
  }
  if (input.affected?.length) {
    for (const a of input.affected.slice(0, 500)) {
      await db.run(
        `INSERT INTO affected_products (cve_id, vendor, product, ecosystem, version_spec, fixed_version, source)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(cve_id, source, vendor, product, version_spec) DO UPDATE SET fixed_version = COALESCE(excluded.fixed_version, affected_products.fixed_version)`,
        [vid, a.vendor.toLowerCase().slice(0, 200), a.product.slice(0, 300), a.ecosystem ?? null, a.versionSpec.slice(0, 300), a.fixedVersion ?? null, source],
      );
    }
  }
  return outcome;
}

/* ------------------------------ queries ------------------------------ */

export type CveSort = 'published' | 'severity' | 'score' | 'modified' | 'kevAdded';

export interface CveFilter {
  q?: string;
  cveId?: string;
  severities?: Severity[];
  minScore?: number;
  maxScore?: number;
  vendor?: string;
  product?: string;
  kevOnly?: boolean;
  exploitedOnly?: boolean;
  bookmarkedOnly?: boolean;
  from?: number;
  to?: number;
  /** Relative window: published within the last N days (resolved at query time). */
  days?: number;
  sort?: CveSort;
}

export function buildCveWhere(f: CveFilter): { where: string; params: SqlValue[] } {
  const w: string[] = [];
  const p: SqlValue[] = [];
  if (f.q?.trim()) {
    const like = `%${likeEscape(f.q.trim())}%`;
    w.push(`(c.id LIKE ? ESCAPE '\\' OR c.title LIKE ? ESCAPE '\\' OR c.description LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM affected_products ap WHERE ap.cve_id = c.id AND (ap.vendor LIKE ? ESCAPE '\\' OR ap.product LIKE ? ESCAPE '\\')))`);
    p.push(like, like, like, like, like);
  }
  if (f.cveId?.trim()) {
    w.push(`c.id LIKE ? ESCAPE '\\'`);
    p.push(`%${likeEscape(f.cveId.trim().toUpperCase())}%`);
  }
  if (f.severities?.length) {
    w.push(`c.severity IN (${f.severities.map(() => '?').join(',')})`);
    p.push(...f.severities);
  }
  if (f.minScore != null) {
    w.push('c.cvss_score >= ?');
    p.push(f.minScore);
  }
  if (f.maxScore != null) {
    w.push('c.cvss_score <= ?');
    p.push(f.maxScore);
  }
  if (f.vendor?.trim()) {
    w.push(`EXISTS (SELECT 1 FROM affected_products ap WHERE ap.cve_id = c.id AND ap.vendor LIKE ? ESCAPE '\\')`);
    p.push(`%${likeEscape(f.vendor.trim().toLowerCase())}%`);
  }
  if (f.product?.trim()) {
    w.push(`EXISTS (SELECT 1 FROM affected_products ap WHERE ap.cve_id = c.id AND ap.product LIKE ? ESCAPE '\\')`);
    p.push(`%${likeEscape(f.product.trim())}%`);
  }
  if (f.kevOnly || f.exploitedOnly) w.push('c.kev = 1');
  if (f.bookmarkedOnly) w.push(`EXISTS (SELECT 1 FROM bookmarks b WHERE b.item_type = 'cve' AND b.item_ref = c.id)`);
  if (f.from != null) {
    w.push('COALESCE(c.published_at, c.fetched_at) >= ?');
    p.push(f.from);
  }
  if (f.days) {
    w.push('COALESCE(c.published_at, c.fetched_at) >= ?');
    p.push(Date.now() - f.days * 86_400_000);
  }
  if (f.to != null) {
    w.push('COALESCE(c.published_at, c.fetched_at) <= ?');
    p.push(f.to);
  }
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
}

const ORDER: Record<CveSort, string> = {
  published: 'COALESCE(c.published_at, 0) DESC, c.id DESC',
  modified: 'COALESCE(c.last_modified_at, 0) DESC, c.id DESC',
  score: 'COALESCE(c.cvss_score, -1) DESC, COALESCE(c.published_at, 0) DESC',
  severity: `CASE c.severity WHEN 'CRITICAL' THEN 5 WHEN 'HIGH' THEN 4 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 2 WHEN 'NONE' THEN 1 ELSE 0 END DESC, COALESCE(c.cvss_score, -1) DESC, COALESCE(c.published_at, 0) DESC`,
  kevAdded: 'COALESCE(c.kev_date_added, 0) DESC, COALESCE(c.cvss_score, -1) DESC',
};

export async function listCves(db: Db, f: CveFilter, limit = 30, offset = 0): Promise<CveRow[]> {
  const { where, params } = buildCveWhere(f);
  return db.all<CveRow>(
    `SELECT c.*,
       EXISTS (SELECT 1 FROM bookmarks b WHERE b.item_type = 'cve' AND b.item_ref = c.id) AS bookmarked,
       (SELECT group_concat(DISTINCT ap.vendor) FROM affected_products ap WHERE ap.cve_id = c.id AND ap.vendor <> '') AS vendors
     FROM cves c ${where} ORDER BY ${ORDER[f.sort ?? 'published']} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
}

export async function countCves(db: Db, f: CveFilter): Promise<number> {
  const { where, params } = buildCveWhere(f);
  const r = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM cves c ${where}`, params);
  return r?.n ?? 0;
}

export async function getCve(db: Db, id: string): Promise<{ cve: CveRow; affected: AffectedRow[]; references: ReferenceRow[]; kev: KevRow | null } | null> {
  const cve = await db.get<CveRow>(
    `SELECT c.*, EXISTS (SELECT 1 FROM bookmarks b WHERE b.item_type = 'cve' AND b.item_ref = c.id) AS bookmarked FROM cves c WHERE c.id = ?`,
    [id],
  );
  if (!cve) return null;
  const affected = await db.all<AffectedRow>('SELECT * FROM affected_products WHERE cve_id = ? ORDER BY source, vendor, product LIMIT 300', [id]);
  const references = await db.all<ReferenceRow>('SELECT * FROM vuln_references WHERE cve_id = ? ORDER BY (tags LIKE ?) DESC, id LIMIT 200', [id, '%Patch%']);
  const kev = await getKev(db, id);
  return { cve, affected, references, kev };
}

export async function getKev(db: Db, id: string): Promise<KevRow | null> {
  return db.get<KevRow>(
    `SELECT k.*, c.cvss_score, c.severity, (c.id IS NOT NULL) AS in_db FROM kev_catalog k LEFT JOIN cves c ON c.id = k.cve_id WHERE k.cve_id = ?`,
    [id],
  );
}

export interface KevFilter {
  q?: string;
  ransomwareOnly?: boolean;
  since?: number;
  /** Added within the last N calendar days (UTC), resolved at query time. */
  sinceDays?: number;
}

export async function listKev(db: Db, f: KevFilter, limit = 30, offset = 0): Promise<KevRow[]> {
  const w: string[] = [];
  const p: SqlValue[] = [];
  if (f.q?.trim()) {
    const like = `%${likeEscape(f.q.trim())}%`;
    w.push(`(k.cve_id LIKE ? ESCAPE '\\' OR k.vendor LIKE ? ESCAPE '\\' OR k.product LIKE ? ESCAPE '\\' OR k.name LIKE ? ESCAPE '\\')`);
    p.push(like, like, like, like);
  }
  if (f.ransomwareOnly) w.push(`k.ransomware = 'Known'`);
  if (f.since != null) {
    w.push('k.date_added >= ?');
    p.push(f.since);
  }
  if (f.sinceDays) {
    const day = 86_400_000;
    w.push('k.date_added >= ?');
    p.push(Math.floor((Date.now() - f.sinceDays * day) / day) * day);
  }
  return db.all<KevRow>(
    `SELECT k.*, c.cvss_score, c.severity, (c.id IS NOT NULL) AS in_db FROM kev_catalog k LEFT JOIN cves c ON c.id = k.cve_id
     ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY k.date_added DESC, k.cve_id DESC LIMIT ? OFFSET ?`,
    [...p, limit, offset],
  );
}

export async function cvesNeedingEnrichment(db: Db, limit: number): Promise<string[]> {
  const rows = await db.all<{ id: string }>(
    `SELECT id FROM cves WHERE id LIKE 'CVE-%' AND enriched_at IS NULL
       AND (kev = 1 OR severity IN ('CRITICAL','HIGH') OR NOT EXISTS (SELECT 1 FROM affected_products ap WHERE ap.cve_id = cves.id))
     ORDER BY kev DESC, COALESCE(cvss_score, 0) DESC, published_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.id);
}

export async function markEnriched(db: Db, id: string, now = Date.now()): Promise<void> {
  await db.run('UPDATE cves SET enriched_at = ? WHERE id = ?', [now, id]);
}
