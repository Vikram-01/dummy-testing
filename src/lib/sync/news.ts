import { classify, extractCveIds, type Category } from '../config/categories';
import { httpGet } from '../net/http';
import { parseFeed } from '../parse/feed';
import { insertArticle } from '../repo/articles';
import type { SourceRow } from '../repo/types';
import { errMsg, markSourceAttempt, markSourceError, markSourceSuccess, SyncContext, tuning } from './context';

export interface SourceResult {
  sourceId: string;
  ok: boolean;
  newItems: number;
  notModified?: boolean;
  error?: string;
}

/**
 * Fetches one RSS/Atom source incrementally:
 * - Conditional GET (ETag / Last-Modified) so unchanged feeds cost ~nothing.
 * - Items outside the retention window are skipped.
 * - Duplicates are ignored at insert time (guid per source + normalized URL).
 * Failure of one source never affects stored data or other sources.
 */
export async function syncNewsSource(ctx: SyncContext, src: SourceRow): Promise<SourceResult> {
  const { db } = ctx;
  const started = ctx.now();
  await markSourceAttempt(db, src.id, started);
  try {
    const headers: Record<string, string> = { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8' };
    if (src.etag) headers['If-None-Match'] = src.etag;
    if (src.last_modified_header) headers['If-Modified-Since'] = src.last_modified_header;
    const t = tuning(ctx);
    const res = await httpGet(ctx.fetch, src.url, { headers, retries: t.retries, backoffMs: t.backoffMs, sleep: ctx.sleep, signal: ctx.signal, maxBytes: 15_000_000 });
    if (res.notModified) {
      await markSourceSuccess(db, src.id, ctx.now(), 0);
      await ctx.log.info(src.id, 'Not modified since last sync', { durationMs: ctx.now() - started });
      return { sourceId: src.id, ok: true, newItems: 0, notModified: true };
    }
    const items = parseFeed(res.body, src.url);
    if (items.length === 0) throw new Error('Feed returned no parseable items');
    const windowStart = ctx.now() - ctx.retentionDays * 86_400_000;
    let added = 0;
    await db.transaction(async () => {
      for (const it of items) {
        // Undated items are stamped with fetch time so they stay in order.
        const published = Math.min(it.publishedAt ?? ctx.now(), ctx.now() + 60_000);
        if (published < windowStart) continue;
        const cls = classify(it.title, `${it.summary} ${it.categories.join(' ')}`, (src.default_category as Category) ?? null);
        const inserted = await insertArticle(
          db,
          {
            sourceId: src.id,
            guid: it.guid,
            url: it.url,
            title: it.title,
            summary: it.summary,
            contentHtml: it.contentHtml,
            author: it.author,
            publishedAt: published,
            category: cls.primary,
            categories: cls.all,
            cveIds: extractCveIds(`${it.title} ${it.summary}`),
          },
          ctx.now(),
        );
        if (inserted) added++;
      }
    });
    await markSourceSuccess(db, src.id, ctx.now(), added, {
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    });
    await ctx.log.info(src.id, `${items.length} items in feed, ${added} new`, { newItems: added, durationMs: ctx.now() - started });
    return { sourceId: src.id, ok: true, newItems: added };
  } catch (e) {
    await markSourceError(db, src.id, e);
    await ctx.log.error(src.id, errMsg(e), { durationMs: ctx.now() - started });
    return { sourceId: src.id, ok: false, newItems: 0, error: errMsg(e) };
  }
}

/** Runs sources with bounded concurrency. */
export async function syncAllNews(ctx: SyncContext, sources: SourceRow[], concurrency = 4): Promise<SourceResult[]> {
  const results: SourceResult[] = [];
  let i = 0;
  const worker = async () => {
    while (i < sources.length) {
      if (ctx.signal?.aborted) return;
      const src = sources[i++];
      results.push(await syncNewsSource(ctx, src));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  return results;
}
