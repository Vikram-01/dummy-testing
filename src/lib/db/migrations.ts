import type { Db } from './types';
import { NEWS_SOURCES, CVE_SOURCES } from '../config/sources';

/**
 * Ordered schema migrations. The applied version is tracked in
 * PRAGMA user_version. Never edit a shipped migration; append a new one.
 */
export const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('news','cve')),
    url TEXT NOT NULL,
    homepage TEXT,
    default_category TEXT,
    group_tag TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_attempt_at INTEGER,
    last_success_at INTEGER,
    last_status TEXT,
    last_error TEXT,
    last_item_count INTEGER,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    etag TEXT,
    last_modified_header TEXT,
    cursor TEXT
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    guid TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content_html TEXT,
    author TEXT,
    published_at INTEGER NOT NULL,
    fetched_at INTEGER NOT NULL,
    category TEXT NOT NULL,
    categories TEXT NOT NULL DEFAULT '',
    cve_ids TEXT NOT NULL DEFAULT '',
    read_at INTEGER,
    UNIQUE (source_id, guid),
    UNIQUE (url)
  );
  CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id, published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category, published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(read_at DESC);

  CREATE TABLE IF NOT EXISTS cves (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    cvss_score REAL,
    cvss_version TEXT,
    cvss_vector TEXT,
    severity TEXT NOT NULL DEFAULT 'UNKNOWN',
    cwes TEXT NOT NULL DEFAULT '',
    vuln_status TEXT,
    published_at INTEGER,
    last_modified_at INTEGER,
    data_sources TEXT NOT NULL DEFAULT '',
    kev INTEGER NOT NULL DEFAULT 0,
    kev_date_added INTEGER,
    kev_due_date INTEGER,
    kev_ransomware TEXT,
    kev_required_action TEXT,
    exploit_refs INTEGER NOT NULL DEFAULT 0,
    patch_available INTEGER NOT NULL DEFAULT 0,
    remediation TEXT,
    fetched_at INTEGER NOT NULL,
    enriched_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_cves_published ON cves(published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cves_score ON cves(cvss_score DESC);
  CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves(severity, published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cves_kev ON cves(kev, kev_date_added DESC);
  CREATE INDEX IF NOT EXISTS idx_cves_modified ON cves(last_modified_at DESC);

  CREATE TABLE IF NOT EXISTS affected_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cve_id TEXT NOT NULL REFERENCES cves(id) ON DELETE CASCADE,
    vendor TEXT NOT NULL DEFAULT '',
    product TEXT NOT NULL DEFAULT '',
    ecosystem TEXT,
    version_spec TEXT NOT NULL DEFAULT '',
    fixed_version TEXT,
    source TEXT NOT NULL,
    UNIQUE (cve_id, source, vendor, product, version_spec)
  );
  CREATE INDEX IF NOT EXISTS idx_affected_vendor ON affected_products(vendor);
  CREATE INDEX IF NOT EXISTS idx_affected_product ON affected_products(product);

  CREATE TABLE IF NOT EXISTS vuln_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cve_id TEXT NOT NULL REFERENCES cves(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    source TEXT,
    tags TEXT NOT NULL DEFAULT '',
    UNIQUE (cve_id, url)
  );

  CREATE TABLE IF NOT EXISTS kev_catalog (
    cve_id TEXT PRIMARY KEY,
    vendor TEXT,
    product TEXT,
    name TEXT,
    description TEXT,
    date_added INTEGER NOT NULL,
    due_date INTEGER,
    ransomware TEXT,
    required_action TEXT,
    notes TEXT,
    first_seen_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kev_added ON kev_catalog(date_added DESC);

  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL CHECK (item_type IN ('article','cve')),
    item_ref TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (item_type, item_ref)
  );

  CREATE TABLE IF NOT EXISTS saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    query_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trigger TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    status TEXT NOT NULL,
    new_articles INTEGER NOT NULL DEFAULT 0,
    new_cves INTEGER NOT NULL DEFAULT 0,
    updated_cves INTEGER NOT NULL DEFAULT 0,
    new_kev INTEGER NOT NULL DEFAULT 0,
    purged INTEGER NOT NULL DEFAULT 0,
    message TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON sync_runs(started_at DESC);

  CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
    source_id TEXT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    new_items INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sync_logs_run ON sync_logs(run_id);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export async function migrate(db: Db): Promise<number> {
  await db.exec('PRAGMA foreign_keys = ON;');
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i++) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[i]);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    });
    version = i + 1;
  }
  await seedSources(db);
  return version;
}

/** Inserts/refreshes the static source catalog without touching sync state. */
export async function seedSources(db: Db): Promise<void> {
  await db.transaction(async () => {
    for (const s of [...NEWS_SOURCES, ...CVE_SOURCES]) {
      await db.run(
        `INSERT INTO sources (id, name, kind, url, homepage, default_category, group_tag)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url,
           homepage=excluded.homepage, default_category=excluded.default_category,
           group_tag=excluded.group_tag`,
        [s.id, s.name, s.kind, s.url, s.homepage, s.defaultCategory ?? null, s.group ?? null],
      );
    }
  });
}
