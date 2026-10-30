import type { Db } from '../db/types';

/* ----------------------------- bookmarks ----------------------------- */

export type BookmarkType = 'article' | 'cve';

export async function isBookmarked(db: Db, type: BookmarkType, ref: string): Promise<boolean> {
  return !!(await db.get('SELECT 1 AS x FROM bookmarks WHERE item_type = ? AND item_ref = ?', [type, ref]));
}

export async function toggleBookmark(db: Db, type: BookmarkType, ref: string, now = Date.now()): Promise<boolean> {
  return db.transaction(async () => {
    if (await isBookmarked(db, type, ref)) {
      await db.run('DELETE FROM bookmarks WHERE item_type = ? AND item_ref = ?', [type, ref]);
      return false;
    }
    await db.run('INSERT INTO bookmarks (item_type, item_ref, created_at) VALUES (?,?,?)', [type, ref, now]);
    return true;
  });
}

/* --------------------------- saved searches -------------------------- */

export interface SavedSearchQuery {
  scope: 'all' | 'news' | 'cves';
  q?: string;
  sourceIds?: string[];
  categories?: string[];
  severities?: string[];
  minScore?: number;
  vendor?: string;
  product?: string;
  cveId?: string;
  exploitedOnly?: boolean;
  days?: number;
}

export interface SavedSearch {
  id: number;
  name: string;
  query: SavedSearchQuery;
  created_at: number;
}

export async function listSavedSearches(db: Db): Promise<SavedSearch[]> {
  const rows = await db.all<{ id: number; name: string; query_json: string; created_at: number }>('SELECT * FROM saved_searches ORDER BY created_at DESC');
  return rows.flatMap((r) => {
    try {
      return [{ id: r.id, name: r.name, query: JSON.parse(r.query_json) as SavedSearchQuery, created_at: r.created_at }];
    } catch {
      return [];
    }
  });
}

export async function saveSearch(db: Db, name: string, query: SavedSearchQuery, now = Date.now()): Promise<number> {
  const clean = name.trim().slice(0, 80) || 'Saved search';
  const r = await db.run('INSERT INTO saved_searches (name, query_json, created_at) VALUES (?,?,?)', [clean, JSON.stringify(query), now]);
  return r.lastInsertRowId;
}

export async function deleteSavedSearch(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM saved_searches WHERE id = ?', [id]);
}
