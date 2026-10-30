import fs from 'fs';
import os from 'os';
import path from 'path';
import { listArticles, countArticles } from '../src/lib/repo/articles';
import { countCves, getCve, listCves, listKev } from '../src/lib/repo/cves';
import { saveSearch, listSavedSearches, toggleBookmark } from '../src/lib/repo/library';
import { getMeta, saveSettings, setMeta } from '../src/lib/repo/settings';
import { dashboardStats, listRunLogs, listRuns } from '../src/lib/repo/stats';
import { isSyncDue, nextScheduledSync, recoverInterruptedRuns, runSync, SyncDeps } from '../src/lib/sync/engine';
import { purgeExpired } from '../src/lib/sync/retention';
import { decideBackgroundRun } from '../src/lib/background/policy';
import { NEWS_SOURCES } from '../src/lib/config/sources';
import { freshDb, nodeDb } from './helpers/nodeDb';
import { fakeFetch, json, status, xml } from './helpers/fakeFetch';
import { atomFeed, cveOrgRecord, DAY_MS, ghsaAdvisory, kevCatalog, log4shellNvd, nvdPage, osvRecord, rssFeed, simpleNvdCve } from './helpers/fixtures';
import { migrate } from '../src/lib/db/migrations';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const HOUR = 3_600_000;
const fastTuning = { nvdDelayNoKeyMs: 0, nvdDelayWithKeyMs: 0, retries: 1, backoffMs: 0, nvdPageSize: 2 };

/** Builds a fake internet: every configured feed + all CVE APIs. */
function world(clock: { now: number }) {
  const feedState: Record<string, { etag: string; items: { title: string; link: string; date: number }[] }> = {};
  for (const s of NEWS_SOURCES) {
    feedState[s.url] = {
      etag: `"${s.id}-v1"`,
      items: [
        { title: `${s.name}: Fortinet patches actively exploited zero-day`, link: `${s.homepage}/2026/10/zero-day-${s.id}`, date: clock.now - 2 * HOUR },
        { title: `${s.name}: Malicious npm packages target developers`, link: `${s.homepage}/2026/10/npm-${s.id}?utm_source=rss`, date: clock.now - 30 * HOUR },
        { title: `${s.name}: Old story beyond retention`, link: `${s.homepage}/2026/09/old-${s.id}`, date: clock.now - 9 * DAY_MS },
      ],
    };
  }
  let nvdCves: unknown[] = [];
  let kev = kevCatalog([{ cveID: 'CVE-2021-44228', dateAdded: '2021-12-10', ransomware: 'Known' }]);
  let ghsa: unknown[] = [];
  const down = new Set<string>();

  const routes: Record<string, (u: string, h: Record<string, string>, n: number) => Response> = {};
  for (const s of NEWS_SOURCES) {
    routes[s.url] = (_u, h) => {
      if (down.has(s.id)) return status(503);
      const st = feedState[s.url];
      if (h['if-none-match'] === st.etag) return status(304);
      const body = s.id === 'projectzero' ? atomFeed(st.items.map((i) => ({ title: i.title, href: i.link, id: i.link, date: i.date }))) : rssFeed(st.items);
      return xml(body, { etag: st.etag });
    };
  }
  routes['https://services.nvd.nist.gov/rest/json/cves/2.0'] = (u) => {
    if (down.has('nvd')) return status(503);
    const q = new URL(u).searchParams;
    const id = q.get('cveId');
    if (id) return json(nvdPage(nvdCves.filter((c: any) => c.id === id)));
    const start = Number(q.get('startIndex') ?? 0);
    const size = Number(q.get('resultsPerPage') ?? 2000);
    return json(nvdPage(nvdCves.slice(start, start + size), start, nvdCves.length));
  };
  routes['https://www.cisa.gov/'] = (_u, h) => {
    if (down.has('cisa-kev')) return status(500);
    const etag = `"kev-${kev.vulnerabilities.length}"`;
    if (h['if-none-match'] === etag) return status(304);
    return json(kev, { etag });
  };
  routes['https://api.github.com/advisories'] = () => (down.has('ghsa') ? status(403) : json(ghsa));
  routes['https://cveawg.mitre.org/api/cve/CVE-2021-44228'] = () => json(cveOrgRecord());
  routes['https://cveawg.mitre.org/api/cve/'] = () => status(404);
  routes['https://api.osv.dev/v1/vulns/CVE-2021-44228'] = () => json(osvRecord());
  routes['https://api.osv.dev/v1/vulns/'] = () => status(404);

  const f = fakeFetch(routes);
  return {
    ...f,
    feedState,
    down,
    setNvd: (c: unknown[]) => (nvdCves = c),
    setKev: (k: ReturnType<typeof kevCatalog>) => (kev = k),
    setGhsa: (g: unknown[]) => (ghsa = g),
  };
}

function deps(db: any, w: ReturnType<typeof world>, clock: { now: number }, extra: Partial<SyncDeps> = {}): SyncDeps {
  return { db, fetch: w.fetch, now: () => clock.now, sleep: async () => {}, tuning: fastTuning, ...extra };
}

describe('full synchronization against all sources', () => {
  it('fetches every news source and CVE feed, deduplicates, and categorizes', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    w.setNvd([log4shellNvd(NOW), simpleNvdCve('CVE-2026-40001', NOW, 0.5, 9.8), simpleNvdCve('CVE-2026-40002', NOW, 2, 5.3), simpleNvdCve('CVE-2026-40003', NOW, 3, null)]);
    w.setGhsa([ghsaAdvisory(NOW)]);

    const s1 = await runSync(deps(db, w, clock), 'test');
    expect(s1.status).toBe('success');
    expect(s1.failedSources).toEqual([]);
    // 22 sources x 2 in-window items (the 9-day-old item is outside retention)
    expect(s1.newArticles).toBe(NEWS_SOURCES.length * 2);
    expect(await countArticles(db, {})).toBe(44);
    expect(s1.newCves).toBe(4);

    // every configured news source produced data
    const stats = await dashboardStats(db, 5, NOW);
    expect(stats.bySource).toHaveLength(NEWS_SOURCES.length);
    expect(stats.criticalCves).toBe(2);
    expect(stats.cvss9Plus).toBe(2);
    expect(stats.kevTotal).toBe(121);

    // categories assigned by rules
    const zero = await listArticles(db, { categories: ['Zero-Day Vulnerabilities'] }, 100);
    expect(zero).toHaveLength(22);
    const supply = await listArticles(db, { categories: ['Supply Chain Security'] }, 100);
    // 22 npm stories + Sonatype's zero-day post, tagged via the source's default category
    expect(supply).toHaveLength(23);
    expect(supply.filter((a) => a.category === 'Supply Chain Security')).toHaveLength(22);
    // research group view
    const research = await listArticles(db, { group: 'research' }, 100);
    expect(research.every((a) => NEWS_SOURCES.find((s) => s.id === a.source_id)!.group === 'research')).toBe(true);

    // Log4Shell merged across NVD + KEV + GHSA + CVE.org + OSV with verified exploitation
    const d = (await getCve(db, 'CVE-2021-44228'))!;
    expect(d.cve).toMatchObject({ kev: 1, kev_ransomware: 'Known', severity: 'CRITICAL', cvss_score: 10, exploit_refs: 1, patch_available: 1 });
    expect(d.cve.data_sources.split(',').sort()).toEqual(['cve.org', 'ghsa', 'nvd', 'osv']);
    expect(d.cve.description).toMatch(/^Apache Log4j2 2.0-beta9/); // NVD stays authoritative
    expect(d.affected.map((a) => a.source)).toEqual(expect.arrayContaining(['nvd', 'ghsa', 'cve.org', 'osv']));
    expect(d.references.some((r) => r.url.startsWith('javascript:'))).toBe(false);
    expect(d.cve.enriched_at).toBe(NOW);
    db.close();
  });

  it('second sync uses conditional requests and NVD incremental window without duplicates', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    w.setNvd([simpleNvdCve('CVE-2026-40001', NOW, 0.5, 7.5)]);
    await runSync(deps(db, w, clock), 'test');

    clock.now = NOW + HOUR;
    w.calls.length = 0;
    // NVD now reports a modification (rescored) plus a brand new CVE
    w.setNvd([
      simpleNvdCve('CVE-2026-40001', NOW, 0.5, 9.1, { lastModified: new Date(NOW + 30 * 60_000).toISOString().replace('Z', '') }),
      simpleNvdCve('CVE-2026-40010', NOW + HOUR, 0.01, 8.1),
    ]);
    const s2 = await runSync(deps(db, w, clock), 'background');
    expect(s2.status).toBe('success');
    expect(s2.newArticles).toBe(0); // all feeds answered 304 Not Modified
    expect(w.calls.filter((c) => c.headers['if-none-match']).length).toBeGreaterThanOrEqual(NEWS_SOURCES.length);
    const nvdCall = w.calls.find((c) => c.url.startsWith('https://services.nvd.nist.gov') && !c.url.includes('cveId'))!;
    expect(decodeURIComponent(nvdCall.url)).toContain('lastModStartDate=2026-10-30T11:55:00.000+00:00');
    expect(s2.newCves).toBe(1);
    expect(s2.updatedCves).toBe(1);
    const c = (await getCve(db, 'CVE-2026-40001'))!.cve;
    expect(c).toMatchObject({ cvss_score: 9.1, severity: 'CRITICAL' });
    expect(await countCves(db, {})).toBe(2);

    // re-serving identical feed content without ETag still creates no duplicates
    for (const st of Object.values(w.feedState)) st.etag = '"changed"';
    const s3 = await runSync(deps(db, w, { now: NOW + 2 * HOUR }), 'manual');
    expect(s3.newArticles).toBe(0);
    expect(await countArticles(db, {})).toBe(44);
    db.close();
  });

  it('paginates NVD results', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    w.setNvd(Array.from({ length: 5 }, (_, i) => simpleNvdCve(`CVE-2026-5000${i}`, NOW, 1, 6)));
    const s = await runSync(deps(db, w, clock), 'test');
    expect(s.newCves).toBe(5);
    expect(w.calls.filter((c) => c.url.includes('/cves/2.0?') && !c.url.includes('cveId')).length).toBe(3); // page size 2
    db.close();
  });
});

describe('failures and resilience', () => {
  it('continues when sources are down and never deletes their stored data', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    w.setNvd([simpleNvdCve('CVE-2026-40001', NOW, 0.5, 9.8)]);
    await runSync(deps(db, w, clock), 'test');
    const before = await countArticles(db, { sourceIds: ['bleepingcomputer'] });
    expect(before).toBe(2);

    w.down.add('bleepingcomputer');
    w.down.add('nvd');
    w.down.add('ghsa');
    clock.now = NOW + HOUR;
    const s = await runSync(deps(db, w, clock), 'background');
    expect(s.status).toBe('partial');
    expect(s.failedSources.sort()).toEqual(['bleepingcomputer', 'ghsa', 'nvd']);
    expect(await countArticles(db, { sourceIds: ['bleepingcomputer'] })).toBe(before);
    expect(await countCves(db, {})).toBe(1);

    const src = await db.get<any>('SELECT * FROM sources WHERE id = ?', ['nvd']);
    expect(src).toMatchObject({ last_status: 'error', consecutive_failures: 1 });
    expect(src.last_error).toMatch(/HTTP 503/);
    const ghsa = await db.get<any>('SELECT last_error FROM sources WHERE id = ?', ['ghsa']);
    expect(ghsa.last_error).toMatch(/rate limit/);

    // NVD cursor did not advance, so the next successful run re-covers the gap
    const cursor = JSON.parse((await db.get<any>('SELECT cursor FROM sources WHERE id = ?', ['nvd'])).cursor);
    expect(cursor.lastMod).toBe(NOW);

    const logs = await listRunLogs(db, s.runId!);
    expect(logs.filter((l) => l.level === 'error').map((l) => l.source_id).sort()).toEqual(['bleepingcomputer', 'ghsa', 'nvd']);
    db.close();
  });

  it('marks the run failed when everything is unreachable, keeping data intact', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    await runSync(deps(db, w, clock), 'test');
    const n = await countArticles(db, {});
    const offline = fakeFetch({});
    const s = await runSync({ ...deps(db, w, clock), fetch: offline.fetch }, 'background');
    expect(s.status).toBe('failed');
    expect(await countArticles(db, {})).toBe(n);
    db.close();
  });

  it('rejects an incomplete KEV catalog instead of shrinking it', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    await runSync(deps(db, w, clock), 'test');
    w.setKev({ ...kevCatalog([]), vulnerabilities: [] } as any);
    clock.now += HOUR;
    const s = await runSync(deps(db, w, clock), 'test');
    expect(s.failedSources).toContain('cisa-kev');
    expect((await db.get<any>('SELECT COUNT(*) AS n FROM kev_catalog')).n).toBe(121);
    db.close();
  });

  it('prevents overlapping syncs', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    const [a, b] = await Promise.all([runSync(deps(db, w, clock), 'background'), runSync(deps(db, w, clock), 'manual')]);
    expect([a.status, b.status]).toContain('skipped');
    db.close();
  });
});

describe('CISA KEV monitoring', () => {
  it('detects newly added KEV entries, flags CVEs and fetches missing records', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    w.setNvd([simpleNvdCve('CVE-2026-40001', NOW, 0.5, 9.8)]);
    const first = await runSync(deps(db, w, clock), 'test');
    expect(first.newKev).toEqual([]); // initial catalog load is a baseline

    // CISA adds two entries: one CVE we store, one we do not yet have.
    w.setKev(kevCatalog([
      { cveID: 'CVE-2021-44228', dateAdded: '2021-12-10', ransomware: 'Known' },
      { cveID: 'CVE-2026-40001', dateAdded: '2026-10-30', vendor: 'Example', product: 'Router' },
      { cveID: 'CVE-2026-40099', dateAdded: '2026-10-30', vendor: 'Example', product: 'Gateway' },
    ]));
    w.setNvd([simpleNvdCve('CVE-2026-40001', NOW, 0.5, 9.8), simpleNvdCve('CVE-2026-40099', NOW, 20, 8.8)]);
    clock.now = NOW + HOUR;
    const s = await runSync(deps(db, w, clock), 'background');
    expect(s.newKev.sort()).toEqual(['CVE-2026-40001', 'CVE-2026-40099']);
    expect((await getCve(db, 'CVE-2026-40001'))!.cve.kev).toBe(1);
    // the older CVE was pulled by ID from NVD because it is now known-exploited
    expect((await getCve(db, 'CVE-2026-40099'))!.cve).toMatchObject({ kev: 1, cvss_score: 8.8 });
    expect((await listCves(db, { exploitedOnly: true }, 50)).map((c) => c.id)).toEqual(expect.arrayContaining(['CVE-2026-40001', 'CVE-2026-40099']));
    const recent = await listKev(db, { since: NOW - 5 * DAY_MS });
    expect(recent.map((k) => k.cve_id).sort()).toEqual(['CVE-2026-40001', 'CVE-2026-40099']);
    expect((await listKev(db, { ransomwareOnly: true })).map((k) => k.cve_id)).toEqual(['CVE-2021-44228']);
    db.close();
  });
});

describe('5-day retention', () => {
  it('purges data older than 5 days but keeps bookmarks and recent items', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    w.setNvd([simpleNvdCve('CVE-2026-40001', NOW, 4, 9.8), simpleNvdCve('CVE-2026-40002', NOW, 4.5, 5)]);
    await runSync(deps(db, w, clock), 'test');
    const keep = (await listArticles(db, { sourceIds: ['krebs'] }, 10)).find((a) => a.title.includes('npm'))!;
    await toggleBookmark(db, 'article', String(keep.id));
    await toggleBookmark(db, 'cve', 'CVE-2026-40002');

    // 3 days later the 30-hour-old items (now ~4.25 days) are still kept
    clock.now = NOW + 3 * DAY_MS;
    for (const st of Object.values(w.feedState)) st.items = [];
    w.down.add('nvd');
    await runSync(deps(db, w, clock), 'background');
    expect(await countArticles(db, {})).toBe(44);

    // 4.5 days later: zero-day items are 4.6 days old (kept); npm items 5.75 days (purged)
    clock.now = NOW + 4.5 * DAY_MS;
    const s = await runSync(deps(db, w, clock), 'background');
    expect(s.purged).toBeGreaterThan(0);
    const remaining = await listArticles(db, {}, 100);
    expect(remaining.filter((a) => a.title.includes('npm')).map((a) => a.id)).toEqual([keep.id]); // bookmarked survives
    expect(remaining.filter((a) => a.title.includes('zero-day'))).toHaveLength(22);
    expect((await getCve(db, 'CVE-2026-40001'))).toBeNull(); // 8.5 days old
    expect((await getCve(db, 'CVE-2026-40002'))).not.toBeNull(); // bookmarked
    expect((await db.get<any>('SELECT COUNT(*) AS n FROM kev_catalog')).n).toBe(121); // reference data kept
    db.close();
  });

  it('anchors the window to the last successful sync so offline devices keep data', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    await runSync(deps(db, w, clock), 'test');
    expect(await getMeta(db, 'lastSuccessAt')).toBe(String(NOW));
    const n = await countArticles(db, {});
    // Ten days offline: every source fails, nothing is purged.
    clock.now = NOW + 10 * DAY_MS;
    const s = await runSync({ ...deps(db, w, clock), fetch: fakeFetch({}).fetch }, 'background');
    expect(s.status).toBe('failed');
    expect(await countArticles(db, {})).toBe(n);
    const direct = await purgeExpired(db, 5, clock.now);
    expect(direct.articles).toBe(0);
    db.close();
  });

  it('respects a changed retention setting', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    await saveSettings(db, { retentionDays: 1 });
    const s = await runSync(deps(db, w, clock), 'test');
    expect(s.newArticles).toBe(22); // only items within 1 day
    db.close();
  });
});

describe('persistence and restart recovery', () => {
  it('keeps data across restarts and recovers a run killed mid-sync', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigil-'));
    const file = path.join(dir, 'vigil.db');
    const clock = { now: NOW };
    const w = world(clock);
    w.setNvd([simpleNvdCve('CVE-2026-40001', NOW, 0.5, 9.8)]);

    let db = await freshDb(file);
    await runSync(deps(db, w, clock), 'test');
    await toggleBookmark(db, 'cve', 'CVE-2026-40001');
    await saveSearch(db, 'Critical Fortinet', { scope: 'all', q: 'fortinet', severities: ['CRITICAL'] });
    // Simulate the OS killing the app mid-sync: a 'running' row and a held lock remain.
    await db.run(`INSERT INTO sync_runs (trigger, started_at, status) VALUES ('background', ?, 'running')`, [NOW + 1000]);
    await setMeta(db, 'syncLock', String(NOW + 1000));
    db.close();

    db = nodeDb(file);
    expect(await migrate(db)).toBe(1); // idempotent, no duplicate seed rows
    expect((await db.get<any>('SELECT COUNT(*) AS n FROM sources')).n).toBe(27);
    expect(await countArticles(db, {})).toBe(44);
    expect((await getCve(db, 'CVE-2026-40001'))!.cve.bookmarked).toBe(1);
    expect(await listSavedSearches(db)).toHaveLength(1);

    expect(await recoverInterruptedRuns(db, NOW + 2000, { appStart: true })).toBe(1);
    const runs = await listRuns(db);
    expect(runs[0].status).toBe('interrupted');
    clock.now = NOW + HOUR;
    const s = await runSync(deps(db, w, clock), 'startup');
    expect(s.status).toBe('success');
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('hourly scheduling', () => {
  it('computes the next run from the configured interval', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    expect(await isSyncDue(db, NOW)).toBe(true);
    await runSync(deps(db, w, clock), 'test');
    expect(await nextScheduledSync(db)).toBe(NOW + HOUR);
    expect(await isSyncDue(db, NOW + 59 * 60_000)).toBe(false);
    expect(await isSyncDue(db, NOW + HOUR)).toBe(true);
    await saveSettings(db, { syncIntervalMinutes: 180 });
    expect(await nextScheduledSync(db)).toBe(NOW + 3 * HOUR);
    db.close();
  });

  it('background policy skips when not due, offline, or on cellular with Wi-Fi only', () => {
    const base = { due: true, online: true, wifi: true, wifiOnly: false };
    expect(decideBackgroundRun(base)).toEqual({ run: true });
    expect(decideBackgroundRun({ ...base, due: false }).run).toBe(false);
    expect(decideBackgroundRun({ ...base, online: false }).run).toBe(false);
    expect(decideBackgroundRun({ ...base, wifi: false, wifiOnly: true }).run).toBe(false);
    expect(decideBackgroundRun({ ...base, wifi: false }).run).toBe(true);
  });

  it('simulates 24 hourly background runs without duplicates', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    for (let h = 0; h < 24; h++) {
      clock.now = NOW + h * HOUR;
      // one fresh story per source per hour
      for (const src of NEWS_SOURCES) {
        const st = w.feedState[src.url];
        st.items.push({ title: `Hourly ransomware update ${h}`, link: `${src.homepage}/hourly-${h}`, date: clock.now - 60_000 });
        st.etag = `"v${h + 2}"`;
      }
      const s = await runSync(deps(db, w, clock), 'background');
      expect(['success']).toContain(s.status);
    }
    // 44 initial + one new story per source per hour, none duplicated
    const total = await countArticles(db, {});
    expect(total).toBe(44 + 24 * NEWS_SOURCES.length);
    expect((await listRuns(db, 100)).length).toBe(24);
    db.close();
  });
});

describe('search and filters', () => {
  it('filters CVEs by severity, score, vendor, product, id and sorts', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    w.setNvd([log4shellNvd(NOW), simpleNvdCve('CVE-2026-40001', NOW, 0.5, 9.8), simpleNvdCve('CVE-2026-40002', NOW, 2, 5.3), simpleNvdCve('CVE-2026-40003', NOW, 3, null)]);
    await runSync(deps(db, w, clock), 'test');
    expect((await listCves(db, { severities: ['CRITICAL'] })).map((c) => c.id).sort()).toEqual(['CVE-2021-44228', 'CVE-2026-40001']);
    expect((await listCves(db, { severities: ['UNKNOWN'] })).map((c) => c.id)).toEqual(['CVE-2026-40003']);
    expect((await listCves(db, { minScore: 9 })).length).toBe(2);
    expect((await listCves(db, { vendor: 'apache' })).map((c) => c.id)).toEqual(['CVE-2021-44228']);
    expect((await listCves(db, { product: 'log4j' })).map((c) => c.id)).toEqual(['CVE-2021-44228']);
    expect((await listCves(db, { cveId: '2026-40002' })).map((c) => c.id)).toEqual(['CVE-2026-40002']);
    expect((await listCves(db, { q: 'JNDI' })).map((c) => c.id)).toEqual(['CVE-2021-44228']);
    expect((await listCves(db, { sort: 'score' }))[0].cvss_score).toBe(10);
    expect((await listCves(db, { sort: 'severity' })).at(-1)!.severity).toBe('UNKNOWN');
    expect((await listCves(db, { q: "%' OR 1=1 --" })).length).toBe(0); // injection-safe
    db.close();
  });

  it('filters news by source, date range, category and keyword', async () => {
    const db = await freshDb();
    const clock = { now: NOW };
    const w = world(clock);
    await runSync(deps(db, w, clock), 'test');
    expect(await countArticles(db, { sourceIds: ['krebs', 'talos'] })).toBe(4);
    expect(await countArticles(db, { from: NOW - 6 * HOUR })).toBe(22);
    expect(await countArticles(db, { q: 'npm' })).toBe(22);
    expect(await countArticles(db, { q: 'npm', categories: ['Supply Chain Security'], sourceIds: ['snyk'] })).toBe(1);
    expect(await countArticles(db, { q: '100%' })).toBe(0);
    db.close();
  });
});
