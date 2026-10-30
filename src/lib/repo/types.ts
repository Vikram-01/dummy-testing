export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'UNKNOWN';
export const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN'];

export interface ArticleRow {
  id: number;
  source_id: string;
  source_name: string;
  guid: string;
  url: string;
  title: string;
  summary: string | null;
  content_html: string | null;
  author: string | null;
  published_at: number;
  fetched_at: number;
  category: string;
  categories: string;
  cve_ids: string;
  read_at: number | null;
  bookmarked: number;
}

export interface CveRow {
  id: string;
  title: string | null;
  description: string | null;
  cvss_score: number | null;
  cvss_version: string | null;
  cvss_vector: string | null;
  severity: Severity;
  cwes: string;
  vuln_status: string | null;
  published_at: number | null;
  last_modified_at: number | null;
  data_sources: string;
  kev: number;
  kev_date_added: number | null;
  kev_due_date: number | null;
  kev_ransomware: string | null;
  kev_required_action: string | null;
  exploit_refs: number;
  patch_available: number;
  remediation: string | null;
  fetched_at: number;
  enriched_at: number | null;
  bookmarked: number;
  vendors?: string | null;
}

export interface AffectedRow {
  id: number;
  cve_id: string;
  vendor: string;
  product: string;
  ecosystem: string | null;
  version_spec: string;
  fixed_version: string | null;
  source: string;
}

export interface ReferenceRow {
  id: number;
  cve_id: string;
  url: string;
  source: string | null;
  tags: string;
}

export interface KevRow {
  cve_id: string;
  vendor: string | null;
  product: string | null;
  name: string | null;
  description: string | null;
  date_added: number;
  due_date: number | null;
  ransomware: string | null;
  required_action: string | null;
  notes: string | null;
  cvss_score: number | null;
  severity: Severity | null;
  in_db: number;
}

export interface SourceRow {
  id: string;
  name: string;
  kind: 'news' | 'cve';
  url: string;
  homepage: string | null;
  default_category: string | null;
  group_tag: string | null;
  enabled: number;
  last_attempt_at: number | null;
  last_success_at: number | null;
  last_status: string | null;
  last_error: string | null;
  last_item_count: number | null;
  consecutive_failures: number;
  etag: string | null;
  last_modified_header: string | null;
  cursor: string | null;
}

export interface SyncRunRow {
  id: number;
  trigger: string;
  started_at: number;
  finished_at: number | null;
  status: 'running' | 'success' | 'partial' | 'failed' | 'interrupted' | 'skipped';
  new_articles: number;
  new_cves: number;
  updated_cves: number;
  new_kev: number;
  purged: number;
  message: string | null;
}

export interface SyncLogRow {
  id: number;
  run_id: number;
  source_id: string | null;
  level: 'info' | 'warn' | 'error';
  message: string;
  new_items: number;
  duration_ms: number | null;
  at: number;
}

export function severityFromScore(score: number | null | undefined): Severity {
  if (score == null || !Number.isFinite(score)) return 'UNKNOWN';
  if (score >= 9) return 'CRITICAL';
  if (score >= 7) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  if (score > 0) return 'LOW';
  return 'NONE';
}

export const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, NONE: 1, UNKNOWN: 0 };
