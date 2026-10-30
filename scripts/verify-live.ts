/**
 * Live integration check against the REAL sources (run on any computer with
 * internet access):   npm run verify:live
 *
 * Runs the exact sync engine the app uses, on Node with a real SQLite file,
 * against every configured news feed and the NVD, CISA KEV, GitHub Advisory,
 * CVE.org and OSV.dev APIs. Then runs a second pass to prove incremental sync
 * and duplicate prevention, restarts the database to prove persistence, and
 * prints a per-source report. Exits non-zero if any check fails.
 *
 * Optional: NVD_API_KEY=... GITHUB_TOKEN=... npm run verify:live
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { nodeDb } from '../tests/helpers/nodeDb';
import { migrate } from '../src/lib/db/migrations';
import { runSync } from '../src/lib/sync/engine';
import { countArticles } from '../src/lib/repo/articles';
import { countCves, getCve } from '../src/lib/repo/cves';
import type { SourceRow } from '../src/lib/repo/types';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigil-live-'));
const file = path.join(dir, 'vigil.db');
const failures: string[] = [];
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

async function main() {
  console.log(`Vigil live verification — database: ${file}\n`);
  let db = nodeDb(file);
  await migrate(db);
  const deps = {
    db,
    fetch: (u: string, i?: RequestInit) => fetch(u, i),
    nvdApiKey: process.env.NVD_API_KEY ?? null,
    githubToken: process.env.GITHUB_TOKEN ?? null,
    onProgress: (m: string) => process.stdout.write(`    ${m.slice(0, 110)}\n`),
  };

  console.log('Pass 1: initial sync (NVD without a key paces at 5 requests / 30 s, so this can take a few minutes)');
  const t0 = Date.now();
  const s1 = await runSync(deps, 'manual');
  console.log(`\n  ${s1.status} in ${((Date.now() - t0) / 1000).toFixed(0)} s — ${s1.message}\n`);

  const sources = await db.all<SourceRow>('SELECT * FROM sources ORDER BY kind DESC, name');
  console.log('Per-source results:');
  for (const s of sources) {
    const n = s.kind === 'news' ? (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM articles WHERE source_id = ?', [s.id]))!.n : null;
    const state = s.last_status === 'ok' ? 'OK   ' : s.last_status === 'error' ? 'ERROR' : 'skip ';
    console.log(`  ${state} ${s.name.padEnd(38)} ${n != null ? `${n} articles` : `${s.last_item_count ?? 0} new`}${s.last_error ? `  — ${s.last_error}` : ''}`);
  }
  const newsOk = sources.filter((s) => s.kind === 'news' && s.last_status === 'ok').length;
  const newsTotal = sources.filter((s) => s.kind === 'news').length;

  console.log('\nChecks:');
  check(newsOk >= Math.ceil(newsTotal * 0.8), `${newsOk}/${newsTotal} news feeds fetched and parsed`);
  check((await countArticles(db, {})) > 0, `${await countArticles(db, {})} real articles stored`);
  check(sources.find((s) => s.id === 'nvd')?.last_status === 'ok', 'NVD API reachable and parsed');
  check((await countCves(db, {})) > 0, `${await countCves(db, {})} real CVEs stored from the last ${5} days`);
  const kev = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM kev_catalog'))!.n;
  check(kev > 1000, `CISA KEV catalog loaded (${kev} entries)`);
  check(sources.find((s) => s.id === 'ghsa')?.last_status === 'ok', 'GitHub Security Advisories reachable');
  const enriched = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM cves WHERE enriched_at IS NOT NULL'))!.n;
  check(enriched > 0, `${enriched} CVEs enriched from CVE.org / OSV.dev`);
  const kevFlagged = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM cves WHERE kev = 1'))!.n;
  console.log(`  INFO  ${kevFlagged} stored CVEs are flagged as verified exploited (CISA KEV)`);

  // Known record lookup end-to-end (on-demand path used by the CVE detail screen)
  const log4 = await getCve(db, 'CVE-2021-44228');
  console.log(`  INFO  Log4Shell stored: ${log4 ? 'yes' : 'no (outside 5-day window, expected)'}`);

  console.log('\nPass 2: immediate re-sync (incremental + duplicate prevention)');
  const before = await countArticles(db, {});
  const beforeCves = await countCves(db, {});
  const s2 = await runSync(deps, 'manual');
  const after = await countArticles(db, {});
  console.log(`  ${s2.status} — ${s2.message}`);
  check(after - before === s2.newArticles, `no duplicate articles (${s2.newArticles} genuinely new)`);
  const dupUrls = (await db.get<{ n: number }>('SELECT COUNT(*) - COUNT(DISTINCT url) AS n FROM articles'))!.n;
  check(dupUrls === 0, 'every stored article URL is unique');
  check((await countCves(db, {})) >= beforeCves, 'CVE count never decreases on re-sync');
  const nvdCall = await db.get<{ cursor: string }>('SELECT cursor FROM sources WHERE id = ?', ['nvd']);
  check(!!nvdCall?.cursor, 'NVD incremental cursor saved');

  console.log('\nRestart: closing and reopening the database');
  db.close();
  db = nodeDb(file);
  await migrate(db);
  check((await countArticles(db, {})) === after, 'articles persist across restart');
  db.close();

  console.log(failures.length ? `\n${failures.length} check(s) failed.` : '\nAll live checks passed.');
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
