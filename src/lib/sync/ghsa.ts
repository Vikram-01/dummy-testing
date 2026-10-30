import { HttpError, httpGetJson } from '../net/http';
import { safeHttpUrl, stripHtml, truncate } from '../parse/sanitize';
import { AffectedInput, CVE_ID_RE, CveInput, GHSA_ID_RE, upsertCve } from '../repo/cves';
import type { Severity, SourceRow } from '../repo/types';
import { CveSyncResult } from './nvd';
import { errMsg, markSourceAttempt, markSourceError, markSourceSuccess, SyncContext, tuning } from './context';

export interface GhsaAdvisory {
  ghsa_id: string;
  cve_id: string | null;
  html_url?: string;
  summary?: string;
  description?: string | null;
  severity?: string;
  published_at?: string;
  updated_at?: string;
  withdrawn_at?: string | null;
  references?: string[];
  cvss?: { score: number | null; vector_string: string | null } | null;
  cvss_severities?: {
    cvss_v3?: { score: number | null; vector_string: string | null } | null;
    cvss_v4?: { score: number | null; vector_string: string | null } | null;
  } | null;
  cwes?: { cwe_id: string; name?: string }[];
  vulnerabilities?: {
    package?: { ecosystem?: string; name?: string } | null;
    vulnerable_version_range?: string | null;
    first_patched_version?: string | null;
  }[];
}

function pickCvss(a: GhsaAdvisory): { score: number; vector: string | null; version: string | null } | null {
  const v4 = a.cvss_severities?.cvss_v4;
  const v3 = a.cvss_severities?.cvss_v3 ?? a.cvss;
  for (const c of [v3, v4]) {
    if (c && typeof c.score === 'number' && c.score > 0) {
      const ver = c.vector_string?.match(/^CVSS:(\d\.\d)/)?.[1] ?? null;
      return { score: c.score, vector: c.vector_string ?? null, version: ver };
    }
  }
  return null;
}

export function ghsaToInput(a: GhsaAdvisory): CveInput | null {
  if (a.withdrawn_at) return null;
  const id = a.cve_id && CVE_ID_RE.test(a.cve_id.toUpperCase()) ? a.cve_id.toUpperCase() : a.ghsa_id;
  if (!CVE_ID_RE.test(id) && !GHSA_ID_RE.test(id)) return null;
  const cvss = pickCvss(a);
  const sev = (a.severity ?? '').toUpperCase();
  const severity: Severity | null = cvss ? null : sev === 'MODERATE' ? 'MEDIUM' : (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(sev) ? (sev as Severity) : null);
  const affected: AffectedInput[] = [];
  const fixes: string[] = [];
  for (const v of a.vulnerabilities ?? []) {
    const name = v.package?.name;
    if (!name) continue;
    affected.push({
      vendor: '',
      product: name,
      ecosystem: v.package?.ecosystem ?? null,
      versionSpec: v.vulnerable_version_range || 'unspecified',
      fixedVersion: v.first_patched_version ?? null,
    });
    if (v.first_patched_version) fixes.push(`${name} ${v.first_patched_version}`);
  }
  const refs = [a.html_url, ...(a.references ?? [])]
    .map((u) => safeHttpUrl(u))
    .filter((u): u is string => !!u)
    .map((url) => ({ url, tags: url.includes('github.com/advisories/') ? ['Third Party Advisory'] : [], source: 'ghsa' }));
  const pub = a.published_at ? Date.parse(a.published_at) : NaN;
  const upd = a.updated_at ? Date.parse(a.updated_at) : NaN;
  return {
    id,
    title: a.summary ? truncate(stripHtml(a.summary), 300) : null,
    description: a.description ? truncate(stripHtml(a.description), 8000) : null,
    cvssScore: cvss?.score ?? null,
    cvssVersion: cvss?.version ?? null,
    cvssVector: cvss?.vector ?? null,
    severity,
    cwes: (a.cwes ?? []).map((c) => c.cwe_id).filter((c) => /^CWE-\d+$/.test(c)),
    publishedAt: Number.isFinite(pub) ? pub : null,
    lastModifiedAt: Number.isFinite(upd) ? upd : null,
    references: refs,
    affected,
    patchAvailable: fixes.length > 0,
    remediation: fixes.length ? `Upgrade to a patched release: ${fixes.slice(0, 6).join('; ')}${fixes.length > 6 ? '; …' : ''} (GitHub Security Advisory).` : null,
  };
}

export function nextLink(link: string | null): string | null {
  if (!link) return null;
  const m = link.split(',').map((s) => s.trim()).find((s) => /rel="next"/.test(s))?.match(/<([^>]+)>/);
  const url = m?.[1];
  return url && url.startsWith('https://api.github.com/') ? url : null;
}

/**
 * Incremental GitHub Advisory Database sync (reviewed advisories), using the
 * `modified` filter since the saved cursor and cursor-based pagination.
 * Unauthenticated calls are limited to 60/hour, so pages per run are capped.
 */
export async function syncGhsa(ctx: SyncContext, src: SourceRow): Promise<CveSyncResult> {
  const { db } = ctx;
  const t = tuning(ctx);
  const started = ctx.now();
  await markSourceAttempt(db, src.id, started);
  const windowStart = started - ctx.retentionDays * 86_400_000;
  const since = Math.max(windowStart, Number(src.cursor ?? 0) - 5 * 60_000);
  const sinceStr = new Date(since).toISOString().replace(/\.\d{3}Z$/, 'Z');
  let url: string | null = `${src.url}?type=reviewed&per_page=${t.ghsaPerPage}&sort=updated&direction=desc&modified=${encodeURIComponent('>=' + sinceStr)}`;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (ctx.githubToken) headers.Authorization = `Bearer ${ctx.githubToken}`;
  let added = 0;
  let updated = 0;
  let pages = 0;
  let complete = false;
  try {
    while (url && pages < t.ghsaMaxPages) {
      if (ctx.signal?.aborted) throw new Error('Sync cancelled');
      const res: { data: GhsaAdvisory[] | null; headers: Headers } = await httpGetJson<GhsaAdvisory[]>(ctx.fetch, url, { headers, retries: t.retries, backoffMs: t.backoffMs, sleep: ctx.sleep, signal: ctx.signal });
      pages++;
      if (!Array.isArray(res.data)) throw new Error('Unexpected GitHub advisories response');
      const list = res.data;
      await db.transaction(async () => {
        for (const adv of list) {
          const input = ghsaToInput(adv);
          if (!input) continue;
          if ((input.publishedAt ?? 0) < windowStart) {
            const known = await db.get('SELECT 1 AS x FROM cves WHERE id = ?', [input.id]);
            if (!known) continue;
          }
          const r = await upsertCve(db, input, 'ghsa', ctx.now());
          if (r === 'new') added++;
          else if (r === 'updated') updated++;
        }
      });
      url = nextLink(res.headers.get('link'));
      if (!url) complete = true;
    }
    await markSourceSuccess(db, src.id, ctx.now(), added, complete ? { cursor: String(started) } : {});
    await ctx.log.info(src.id, `${pages} page(s), ${added} new, ${updated} enriched${complete ? '' : ' (page cap reached; continues next sync)'}`, {
      newItems: added,
      durationMs: ctx.now() - started,
    });
    return { sourceId: src.id, ok: true, newCves: added, updatedCves: updated };
  } catch (e) {
    const rateLimited = e instanceof HttpError && (e.status === 403 || e.status === 429);
    await markSourceError(db, src.id, rateLimited ? new Error('GitHub API rate limit reached; will retry next sync') : e);
    await ctx.log.error(src.id, rateLimited ? 'GitHub API rate limit reached; will retry next sync' : errMsg(e), { durationMs: ctx.now() - started });
    return { sourceId: src.id, ok: false, newCves: added, updatedCves: updated, error: errMsg(e) };
  }
}
