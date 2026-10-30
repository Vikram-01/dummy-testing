import type { Db, SqlValue } from '../db/types';
import { likeEscape, normalizeUrl } from '../parse/sanitize';
import type { ArticleRow } from './types';

export interface ArticleInput {
  sourceId: string;
  guid: string;
  url: string;
  title: string;
  summary: string;
  contentHtml: string | null;
  author: string | null;
  publishedAt: number;
  category: string;
  categories: string[];
  cveIds: string[];
}

/**
 * Inserts an article unless it already exists. Duplicates are detected by
 * (source, guid) and by normalized URL across all sources, so the same story
 * syndicated through two feeds is stored once. Returns true if inserted.
 */
export async function insertArticle(db: Db, a: ArticleInput, now = Date.now()): Promise<boolean> {
  const url = normalizeUrl(a.url);
  if (!url) return false;
  const r = await db.run(
    `INSERT OR IGNORE INTO articles (source_id, guid, url, title, summary, content_html, author, published_at, fetched_at, category, categories, cve_ids)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      a.sourceId,
      a.guid,
      url,
      a.title,
      a.summary,
      a.contentHtml,
      a.author,
      a.publishedAt,
      now,
      a.category,
      a.categories.length ? `|${a.categories.join('|')}|` : '',
      a.cveIds.join(','),
    ],
  );
  return r.changes > 0;
}

export interface ArticleFilter {
  q?: string;
  sourceIds?: string[];
  categories?: string[];
  group?: 'news' | 'research';
  from?: number;
  to?: number;
  /** Relative window: published within the last N days (resolved at query time). */
  days?: number;
  cveId?: string;
  bookmarkedOnly?: boolean;
  readOnly?: boolean;
}

export function buildArticleWhere(f: ArticleFilter): { where: string; params: SqlValue[] } {
  const w: string[] = [];
  const p: SqlValue[] = [];
  if (f.q?.trim()) {
    const like = `%${likeEscape(f.q.trim())}%`;
    w.push(`(a.title LIKE ? ESCAPE '\\' OR a.summary LIKE ? ESCAPE '\\' OR a.cve_ids LIKE ? ESCAPE '\\')`);
    p.push(like, like, like);
  }
  if (f.sourceIds?.length) {
    w.push(`a.source_id IN (${f.sourceIds.map(() => '?').join(',')})`);
    p.push(...f.sourceIds);
  }
  if (f.categories?.length) {
    w.push(`(${f.categories.map(() => `a.categories LIKE ? ESCAPE '\\'`).join(' OR ')})`);
    p.push(...f.categories.map((c) => `%|${likeEscape(c)}|%`));
  }
  if (f.group) {
    w.push('s.group_tag = ?');
    p.push(f.group);
  }
  if (f.from != null) {
    w.push('a.published_at >= ?');
    p.push(f.from);
  }
  if (f.days) {
    w.push('a.published_at >= ?');
    p.push(Date.now() - f.days * 86_400_000);
  }
  if (f.to != null) {
    w.push('a.published_at <= ?');
    p.push(f.to);
  }
  if (f.cveId?.trim()) {
    w.push(`a.cve_ids LIKE ? ESCAPE '\\'`);
    p.push(`%${likeEscape(f.cveId.trim().toUpperCase())}%`);
  }
  if (f.bookmarkedOnly) w.push(`EXISTS (SELECT 1 FROM bookmarks b WHERE b.item_type = 'article' AND b.item_ref = CAST(a.id AS TEXT))`);
  if (f.readOnly) w.push('a.read_at IS NOT NULL');
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
}

const SELECT = `SELECT a.*, s.name AS source_name,
  EXISTS (SELECT 1 FROM bookmarks b WHERE b.item_type = 'article' AND b.item_ref = CAST(a.id AS TEXT)) AS bookmarked
  FROM articles a JOIN sources s ON s.id = a.source_id`;

export async function listArticles(db: Db, f: ArticleFilter, limit = 30, offset = 0): Promise<ArticleRow[]> {
  const { where, params } = buildArticleWhere(f);
  const order = f.readOnly ? 'a.read_at DESC' : 'a.published_at DESC, a.id DESC';
  return db.all<ArticleRow>(`${SELECT} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
}

export async function countArticles(db: Db, f: ArticleFilter): Promise<number> {
  const { where, params } = buildArticleWhere(f);
  const r = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM articles a JOIN sources s ON s.id = a.source_id ${where}`, params);
  return r?.n ?? 0;
}

export async function getArticle(db: Db, id: number): Promise<ArticleRow | null> {
  return db.get<ArticleRow>(`${SELECT} WHERE a.id = ?`, [id]);
}

export async function markRead(db: Db, id: number, now = Date.now()): Promise<void> {
  await db.run('UPDATE articles SET read_at = ? WHERE id = ?', [now, id]);
}

export async function clearReadingHistory(db: Db): Promise<void> {
  await db.run('UPDATE articles SET read_at = NULL WHERE read_at IS NOT NULL');
}
