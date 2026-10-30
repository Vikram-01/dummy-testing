import { HttpError, httpGetJson } from '../net/http';
import { safeHttpUrl, stripHtml, truncate } from '../parse/sanitize';
import { AffectedInput, CveInput, markEnriched, upsertCve } from '../repo/cves';
import { errMsg, SyncContext } from './context';

/* ------------------------------ CVE.org ------------------------------ */

interface CveOrgVersion { version?: string; status?: string; lessThan?: string; lessThanOrEqual?: string; versionType?: string }
interface CveOrgRecord {
  cveMetadata?: { cveId: string; state?: string; datePublished?: string; dateUpdated?: string };
  containers?: {
    cna?: {
      title?: string;
      descriptions?: { lang: string; value: string }[];
      affected?: { vendor?: string; product?: string; packageName?: string; collectionURL?: string; defaultStatus?: string; versions?: CveOrgVersion[] }[];
      problemTypes?: { descriptions?: { cweId?: string }[] }[];
      references?: { url: string; tags?: string[] }[];
      solutions?: { lang: string; value: string }[];
      workarounds?: { lang: string; value: string }[];
    };
  };
}

export function cveOrgToInput(id: string, rec: CveOrgRecord): CveInput | null {
  const cna = rec.containers?.cna;
  if (!cna || rec.cveMetadata?.state === 'REJECTED') return null;
  const affected: AffectedInput[] = [];
  for (const a of cna.affected ?? []) {
    const vendor = (a.vendor ?? '').trim();
    const product = (a.product ?? a.packageName ?? '').trim();
    if (!product || /^n\/a$/i.test(product)) continue;
    const versions = (a.versions ?? []).filter((v) => v.status === 'affected');
    if (!versions.length) {
      if (a.defaultStatus === 'affected') affected.push({ vendor, product, versionSpec: 'all versions (per CNA)' });
      continue;
    }
    for (const v of versions.slice(0, 40)) {
      const parts: string[] = [];
      const base = v.version && v.version !== '0' && v.version !== '*' ? v.version : null;
      if (v.lessThan || v.lessThanOrEqual) {
        if (base) parts.push(`>= ${base}`);
        if (v.lessThan && v.lessThan !== '*') parts.push(`< ${v.lessThan}`);
        if (v.lessThanOrEqual && v.lessThanOrEqual !== '*') parts.push(`<= ${v.lessThanOrEqual}`);
      } else if (base) {
        parts.push(`= ${base}`);
      }
      affected.push({
        vendor,
        product,
        versionSpec: parts.join(', ') || 'unspecified',
        fixedVersion: v.lessThan && v.lessThan !== '*' ? v.lessThan : null,
      });
    }
  }
  const solution = [...(cna.solutions ?? []), ...(cna.workarounds ?? [])].find((s) => s.lang?.startsWith('en'))?.value;
  const desc = cna.descriptions?.find((d) => d.lang?.startsWith('en'))?.value;
  return {
    id,
    title: cna.title ? truncate(stripHtml(cna.title), 300) : null,
    description: desc ? truncate(stripHtml(desc), 8000) : null,
    cwes: (cna.problemTypes ?? []).flatMap((p) => p.descriptions ?? []).map((d) => d.cweId ?? '').filter((c) => /^CWE-\d+$/.test(c)),
    references: (cna.references ?? [])
      .map((r) => ({ url: safeHttpUrl(r.url), tags: r.tags ?? [], source: 'cve.org' }))
      .filter((r): r is { url: string; tags: string[]; source: string } => !!r.url),
    affected,
    patchAvailable: (cna.references ?? []).some((r) => (r.tags ?? []).some((t) => /patch/i.test(t))),
    remediation: solution ? `Vendor guidance (CVE record): ${truncate(stripHtml(solution), 1200)}` : null,
  };
}

/* -------------------------------- OSV -------------------------------- */

interface OsvRecord {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  affected?: {
    package?: { ecosystem?: string; name?: string };
    ranges?: { type?: string; events?: { introduced?: string; fixed?: string; last_affected?: string }[] }[];
  }[];
  references?: { type?: string; url: string }[];
}

export function osvToInput(id: string, rec: OsvRecord): CveInput {
  const affected: AffectedInput[] = [];
  for (const a of rec.affected ?? []) {
    const name = a.package?.name;
    if (!name) continue;
    for (const r of (a.ranges ?? []).filter((x) => x.type !== 'GIT')) {
      let intro: string | null = null;
      for (const ev of r.events ?? []) {
        if (ev.introduced != null) intro = ev.introduced;
        if (ev.fixed != null || ev.last_affected != null) {
          const parts: string[] = [];
          if (intro && intro !== '0') parts.push(`>= ${intro}`);
          if (ev.fixed != null) parts.push(`< ${ev.fixed}`);
          if (ev.last_affected != null) parts.push(`<= ${ev.last_affected}`);
          affected.push({ vendor: '', product: name, ecosystem: a.package?.ecosystem ?? null, versionSpec: parts.join(', ') || 'all versions', fixedVersion: ev.fixed ?? null });
          intro = null;
        }
      }
      if (intro != null) {
        affected.push({ vendor: '', product: name, ecosystem: a.package?.ecosystem ?? null, versionSpec: intro === '0' ? 'all versions (no fix listed)' : `>= ${intro} (no fix listed)` });
      }
    }
  }
  return {
    id,
    title: rec.summary ? truncate(stripHtml(rec.summary), 300) : null,
    description: rec.details ? truncate(stripHtml(rec.details), 8000) : null,
    references: (rec.references ?? [])
      .map((r) => ({ url: safeHttpUrl(r.url), tags: r.type ? [r.type === 'FIX' ? 'Patch' : r.type === 'ADVISORY' ? 'Vendor Advisory' : r.type] : [], source: 'osv' }))
      .filter((r): r is { url: string; tags: string[]; source: string } => !!r.url)
      .slice(0, 60),
    affected,
    patchAvailable: affected.some((x) => !!x.fixedVersion),
  };
}

/**
 * Enriches one CVE from CVE.org (CNA record: affected products/versions,
 * solutions) and OSV.dev (package ecosystems and fixed versions).
 * A 404 simply means the database has no record; that is not an error.
 */
export async function enrichCve(ctx: SyncContext, id: string): Promise<{ cveOrg: boolean; osv: boolean; errors: string[] }> {
  const errors: string[] = [];
  let cveOrg = false;
  let osv = false;
  const opts = { retries: 1, backoffMs: 1500, sleep: ctx.sleep, signal: ctx.signal, timeoutMs: 20_000 };
  try {
    const { data } = await httpGetJson<CveOrgRecord>(ctx.fetch, `https://cveawg.mitre.org/api/cve/${encodeURIComponent(id)}`, opts);
    const input = data ? cveOrgToInput(id, data) : null;
    if (input) {
      await ctx.db.transaction(async () => {
        await upsertCve(ctx.db, input, 'cve.org', ctx.now());
      });
      cveOrg = true;
    }
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 404)) errors.push(`CVE.org: ${errMsg(e)}`);
  }
  try {
    const { data } = await httpGetJson<OsvRecord>(ctx.fetch, `https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, opts);
    if (data?.id) {
      await ctx.db.transaction(async () => {
        await upsertCve(ctx.db, osvToInput(id, data), 'osv', ctx.now());
      });
      osv = true;
    }
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 404)) errors.push(`OSV: ${errMsg(e)}`);
  }
  if (errors.length === 0) await markEnriched(ctx.db, id, ctx.now());
  return { cveOrg, osv, errors };
}
