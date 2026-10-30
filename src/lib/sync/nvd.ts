import { httpGetJson } from '../net/http';
import { stripHtml, safeHttpUrl, truncate } from '../parse/sanitize';
import { CveInput, upsertCve, AffectedInput } from '../repo/cves';
import type { Severity, SourceRow } from '../repo/types';
import { errMsg, markSourceAttempt, markSourceError, markSourceSuccess, SyncContext, tuning } from './context';

/* ------------------------- NVD 2.0 response types ------------------------- */

interface NvdCvssData { version: string; vectorString: string; baseScore: number; baseSeverity?: string }
interface NvdMetric { source?: string; type?: 'Primary' | 'Secondary'; cvssData: NvdCvssData; baseSeverity?: string }
interface NvdCpeMatch {
  vulnerable: boolean;
  criteria: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}
export interface NvdCve {
  id: string;
  published?: string;
  lastModified?: string;
  vulnStatus?: string;
  descriptions?: { lang: string; value: string }[];
  metrics?: Record<string, NvdMetric[] | undefined>;
  weaknesses?: { source?: string; type?: string; description: { lang: string; value: string }[] }[];
  configurations?: { nodes?: { cpeMatch?: NvdCpeMatch[] }[] }[];
  references?: { url: string; source?: string; tags?: string[] }[];
  cisaExploitAdd?: string;
  cisaActionDue?: string;
  cisaRequiredAction?: string;
  cisaVulnerabilityName?: string;
}
export interface NvdResponse {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  vulnerabilities: { cve: NvdCve }[];
}

/** NVD timestamps are UTC without a zone designator. */
export function nvdDate(s?: string): number | null {
  if (!s) return null;
  const t = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(t) ? t : null;
}

/** NVD expects ISO-8601 with an explicit offset, e.g. 2026-10-30T12:00:00.000+00:00 */
export function nvdParam(ms: number): string {
  return encodeURIComponent(new Date(ms).toISOString().replace('Z', '+00:00'));
}

const METRIC_ORDER = ['cvssMetricV40', 'cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2'];

export function pickMetric(metrics: NvdCve['metrics']): { score: number; version: string; vector: string; severity: Severity } | null {
  if (!metrics) return null;
  for (const key of METRIC_ORDER) {
    const list = metrics[key];
    if (!list?.length) continue;
    const m = list.find((x) => x.type === 'Primary') ?? list[0];
    const sev = (m.cvssData.baseSeverity ?? m.baseSeverity ?? '').toUpperCase();
    return {
      score: m.cvssData.baseScore,
      version: m.cvssData.version,
      vector: m.cvssData.vectorString,
      severity: (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(sev) ? sev : 'UNKNOWN') as Severity,
    };
  }
  return null;
}

function unescapeCpe(s: string) {
  return s.replace(/\\(.)/g, '$1');
}

export function parseCpeMatches(cve: NvdCve): AffectedInput[] {
  const out: AffectedInput[] = [];
  const seen = new Set<string>();
  for (const conf of cve.configurations ?? []) {
    for (const node of conf.nodes ?? []) {
      for (const m of node.cpeMatch ?? []) {
        if (!m.vulnerable) continue;
        const parts = m.criteria.split(/(?<!\\):/);
        if (parts.length < 6 || parts[0] !== 'cpe') continue;
        const vendor = unescapeCpe(parts[3]);
        const product = unescapeCpe(parts[4]).replace(/_/g, ' ');
        const ver = unescapeCpe(parts[5]);
        const spec: string[] = [];
        if (ver && ver !== '*' && ver !== '-') spec.push(`= ${ver}`);
        if (m.versionStartIncluding) spec.push(`>= ${m.versionStartIncluding}`);
        if (m.versionStartExcluding) spec.push(`> ${m.versionStartExcluding}`);
        if (m.versionEndIncluding) spec.push(`<= ${m.versionEndIncluding}`);
        if (m.versionEndExcluding) spec.push(`< ${m.versionEndExcluding}`);
        const versionSpec = spec.length ? spec.join(', ') : 'all versions (per NVD CPE)';
        const key = `${vendor}|${product}|${versionSpec}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ vendor, product, versionSpec, fixedVersion: m.versionEndExcluding ?? null });
      }
    }
  }
  return out;
}

export function nvdToInput(cve: NvdCve): CveInput {
  const desc = cve.descriptions?.find((d) => d.lang === 'en')?.value ?? cve.descriptions?.[0]?.value ?? null;
  const metric = pickMetric(cve.metrics);
  const cwes = (cve.weaknesses ?? [])
    .flatMap((w) => w.description.map((d) => d.value))
    .filter((v) => /^CWE-\d+$/.test(v));
  const refs = (cve.references ?? [])
    .map((r) => ({ url: safeHttpUrl(r.url), tags: r.tags ?? [], source: r.source ?? 'nvd' }))
    .filter((r): r is { url: string; tags: string[]; source: string } => !!r.url);
  const hasExploitRef = refs.some((r) => r.tags.includes('Exploit'));
  const hasPatch = refs.some((r) => r.tags.includes('Patch') || r.tags.includes('Vendor Advisory') || r.tags.includes('Release Notes'));
  const remediationParts: string[] = [];
  if (cve.cisaRequiredAction) remediationParts.push(`CISA required action: ${cve.cisaRequiredAction}`);
  if (refs.some((r) => r.tags.includes('Patch'))) remediationParts.push('A vendor patch is referenced by NVD; apply the update linked under References.');
  else if (refs.some((r) => r.tags.includes('Vendor Advisory'))) remediationParts.push('Follow the vendor advisory linked under References.');
  if (refs.some((r) => r.tags.includes('Mitigation'))) remediationParts.push('Mitigation guidance is referenced by NVD.');
  return {
    id: cve.id,
    title: cve.cisaVulnerabilityName ?? null,
    description: desc ? truncate(stripHtml(desc), 8000) : null,
    cvssScore: metric?.score ?? null,
    cvssVersion: metric?.version ?? null,
    cvssVector: metric?.vector ?? null,
    severity: metric?.severity ?? null,
    cwes,
    vulnStatus: cve.vulnStatus ?? null,
    publishedAt: nvdDate(cve.published),
    lastModifiedAt: nvdDate(cve.lastModified),
    references: refs.slice(0, 150),
    affected: parseCpeMatches(cve),
    exploitRefs: hasExploitRef,
    patchAvailable: hasPatch,
    remediation: remediationParts.length ? remediationParts.join(' ') : null,
  };
}

export interface NvdCursor {
  lastMod: number;
}

export interface CveSyncResult {
  sourceId: string;
  ok: boolean;
  newCves: number;
  updatedCves: number;
  error?: string;
}

/**
 * Incremental NVD sync.
 * - First run: CVEs PUBLISHED within the retention window (pubStartDate).
 * - Later runs: CVEs MODIFIED since the saved cursor (lastModStartDate) with a
 *   5-minute overlap. New CVEs and updates to stored or KEV-listed CVEs are
 *   kept; modifications to old CVEs we never stored are skipped.
 * - Pages of up to 2000, paced for the public rate limit (5 req / 30 s).
 * - The cursor only advances after every page succeeded.
 */
export async function syncNvd(ctx: SyncContext, src: SourceRow): Promise<CveSyncResult> {
  const { db } = ctx;
  const t = tuning(ctx);
  const started = ctx.now();
  await markSourceAttempt(db, src.id, started);
  const end = started;
  const windowStart = end - ctx.retentionDays * 86_400_000;
  let cursor: NvdCursor | null = null;
  try {
    cursor = src.cursor ? (JSON.parse(src.cursor) as NvdCursor) : null;
  } catch {
    cursor = null;
  }
  const incremental = !!cursor && cursor.lastMod > windowStart;
  const range = incremental
    ? `lastModStartDate=${nvdParam(cursor!.lastMod - 5 * 60_000)}&lastModEndDate=${nvdParam(end)}`
    : `pubStartDate=${nvdParam(windowStart)}&pubEndDate=${nvdParam(end)}`;
  const headers: Record<string, string> = {};
  if (ctx.nvdApiKey) headers.apiKey = ctx.nvdApiKey;
  const delay = ctx.nvdApiKey ? t.nvdDelayWithKeyMs : t.nvdDelayNoKeyMs;

  let startIndex = 0;
  let total = Infinity;
  let added = 0;
  let updated = 0;
  let pages = 0;
  try {
    while (startIndex < total) {
      if (ctx.signal?.aborted) throw new Error('Sync cancelled');
      if (pages > 0) await ctx.sleep(delay);
      const url = `${src.url}?${range}&resultsPerPage=${t.nvdPageSize}&startIndex=${startIndex}&noRejected`;
      const { data } = await httpGetJson<NvdResponse>(ctx.fetch, url, {
        headers,
        retries: t.retries,
        backoffMs: Math.max(t.backoffMs, delay),
        sleep: ctx.sleep,
        signal: ctx.signal,
        timeoutMs: 60_000,
        maxBytes: 60_000_000,
      });
      if (!data || !Array.isArray(data.vulnerabilities)) throw new Error('Unexpected NVD response shape');
      pages++;
      total = data.totalResults;
      await db.transaction(async () => {
        for (const { cve } of data.vulnerabilities) {
          const input = nvdToInput(cve);
          if (incremental && (input.publishedAt ?? 0) < windowStart) {
            const known = await db.get('SELECT 1 AS x FROM cves WHERE id = ? UNION SELECT 1 FROM kev_catalog WHERE cve_id = ?', [cve.id, cve.id]);
            if (!known) continue;
          }
          const r = await upsertCve(db, input, 'nvd', ctx.now());
          if (r === 'new') added++;
          else if (r === 'updated') updated++;
        }
      });
      startIndex += data.vulnerabilities.length;
      if (data.vulnerabilities.length === 0) break;
    }
    await markSourceSuccess(db, src.id, ctx.now(), added, { cursor: JSON.stringify({ lastMod: end } satisfies NvdCursor) });
    await ctx.log.info(src.id, `${incremental ? 'Incremental' : 'Initial'} sync: ${pages} page(s), ${added} new, ${updated} updated`, {
      newItems: added,
      durationMs: ctx.now() - started,
    });
    return { sourceId: src.id, ok: true, newCves: added, updatedCves: updated };
  } catch (e) {
    await markSourceError(db, src.id, e);
    await ctx.log.error(src.id, `${errMsg(e)} (kept ${added} new / ${updated} updated from completed pages; cursor not advanced)`, {
      durationMs: ctx.now() - started,
    });
    return { sourceId: src.id, ok: false, newCves: added, updatedCves: updated, error: errMsg(e) };
  }
}

/** Fetches a single CVE from NVD on demand (e.g. a KEV entry not yet stored). */
export async function fetchNvdCve(ctx: SyncContext, id: string): Promise<boolean> {
  const headers: Record<string, string> = {};
  if (ctx.nvdApiKey) headers.apiKey = ctx.nvdApiKey;
  const { data } = await httpGetJson<NvdResponse>(ctx.fetch, `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(id)}`, {
    headers,
    retries: 2,
    sleep: ctx.sleep,
    signal: ctx.signal,
  });
  const cve = data?.vulnerabilities?.[0]?.cve;
  if (!cve) return false;
  await ctx.db.transaction(async () => {
    await upsertCve(ctx.db, nvdToInput(cve), 'nvd', ctx.now());
  });
  return true;
}
