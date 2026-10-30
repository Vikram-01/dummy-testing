import { XMLParser } from 'fast-xml-parser';
import { safeHttpUrl, sanitizeHtml, stripHtml, truncate } from './sanitize';

export interface FeedItem {
  guid: string;
  url: string;
  title: string;
  summary: string;
  contentHtml: string | null;
  author: string | null;
  publishedAt: number | null;
  categories: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: false as unknown as string,
  processEntities: false, // we decode ourselves; avoids entity-expansion attacks
  htmlEntities: false,
  trimValues: true,
  parseTagValue: false,
  isArray: (name) => ['item', 'entry', 'link', 'category'].includes(name),
});

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('#text' in o) return text(o['#text']);
  }
  return '';
}

export function parseDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s.trim());
  if (Number.isFinite(t)) return t;
  // RFC-822 with non-standard zone names, e.g. "Mon, 27 Oct 2026 10:00:00 EDT"
  const zones: Record<string, string> = { EDT: '-0400', EST: '-0500', CDT: '-0500', CST: '-0600', MDT: '-0600', MST: '-0700', PDT: '-0700', PST: '-0800', UT: '+0000' };
  const m = s.trim().match(/^(.*\d{2}:\d{2}(?::\d{2})?)\s+([A-Z]{2,4})$/);
  if (m && zones[m[2]]) {
    const t2 = Date.parse(`${m[1]} ${zones[m[2]]}`);
    if (Number.isFinite(t2)) return t2;
  }
  return null;
}

function atomLink(links: unknown): string {
  if (!Array.isArray(links)) return text(links);
  let fallback = '';
  for (const l of links) {
    if (typeof l === 'string') {
      fallback ||= l;
      continue;
    }
    const o = l as Record<string, string>;
    const rel = o['@_rel'] ?? 'alternate';
    if (rel === 'alternate' && o['@_href']) return o['@_href'];
    fallback ||= o['@_href'] ?? '';
  }
  return fallback;
}

/** Parses RSS 2.0, RSS 1.0 (RDF) and Atom documents. Throws on non-feed input. */
export function parseFeed(xml: string, feedUrl: string): FeedItem[] {
  if (xml.length > 15_000_000) throw new Error('Feed too large');
  // Reject DOCTYPE/ENTITY declarations outright (XXE / billion-laughs guard).
  if (/<!DOCTYPE[^>]*\[|<!ENTITY/i.test(xml.slice(0, 5000))) throw new Error('Feed contains DTD entity declarations');
  const doc = parser.parse(xml) as Record<string, any>;
  let rawItems: any[] = [];
  let kind: 'rss' | 'atom';
  if (doc.rss?.channel) {
    kind = 'rss';
    const ch = Array.isArray(doc.rss.channel) ? doc.rss.channel[0] : doc.rss.channel;
    rawItems = ch.item ?? [];
  } else if (doc['rdf:RDF']) {
    kind = 'rss';
    rawItems = doc['rdf:RDF'].item ?? [];
  } else if (doc.feed) {
    kind = 'atom';
    rawItems = doc.feed.entry ?? [];
  } else {
    throw new Error('Not an RSS or Atom feed');
  }

  const out: FeedItem[] = [];
  for (const it of rawItems) {
    const title = stripHtml(text(it.title));
    const link = kind === 'atom' ? atomLink(it.link) : text(it.link) || text(it.guid);
    const url = safeHttpUrl(link, feedUrl);
    if (!title || !url) continue;
    const guid = (text(it.guid) || text(it.id) || url).trim();
    const contentRaw = text(it['content:encoded']) || (kind === 'atom' ? text(it.content) : '');
    const summaryRaw = text(it.description) || text(it.summary) || text(it['media:description']) || contentRaw;
    const summary = truncate(stripHtml(summaryRaw), 600);
    const contentHtml = contentRaw ? sanitizeHtml(contentRaw, url) : null;
    const published = parseDate(text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date']));
    const authorRaw = it['dc:creator'] ?? it.author;
    const author = stripHtml(typeof authorRaw === 'object' && authorRaw?.name ? text(authorRaw.name) : text(authorRaw)) || null;
    const categories = (Array.isArray(it.category) ? it.category : [])
      .map((c: any) => stripHtml(typeof c === 'object' ? c['@_term'] ?? text(c) : text(c)))
      .filter(Boolean);
    out.push({
      guid: guid.slice(0, 1000),
      url,
      title: truncate(title, 400),
      summary,
      contentHtml: contentHtml && stripHtml(contentHtml).length > summary.length + 40 ? contentHtml : null,
      author: author ? truncate(author, 120) : null,
      publishedAt: published,
      categories,
    });
  }
  return out;
}
