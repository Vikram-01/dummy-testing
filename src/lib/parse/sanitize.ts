/**
 * Content safety helpers. Feed content is untrusted. We never execute it:
 * - Plain-text fields are stripped of all markup and entity-decoded.
 * - Rich article bodies go through an allow-list sanitizer and are then
 *   rendered in a WebView with JavaScript disabled, no file access and a
 *   strict Content-Security-Policy (see ui/SafeHtml.tsx).
 */

const ENTITY_MAP: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return '';
      try {
        return String.fromCodePoint(code);
      } catch {
        return '';
      }
    }
    return ENTITY_MAP[e.toLowerCase()] ?? m;
  });
}

/** Removes all tags (and script/style bodies) and returns normalized text. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  let s = String(html);
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = s.replace(/<(script|style|noscript|iframe|object|embed|svg|template)[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n');
  s = s.replace(/<[^>]*>/g, ' ');
  s = decodeEntities(s);
  // Remove a second layer of markup that was entity-encoded in the feed.
  s = s.replace(/<(script|style|iframe|object|embed|svg|template)[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<[^>]*>/g, ' ');
  return s.replace(/[ \t\f\v ]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + '…';
}

/** Returns a canonical https URL or null. Rejects non-http(s) schemes. */
export function safeHttpUrl(raw: string | null | undefined, base?: string): string | null {
  if (!raw) return null;
  const trimmed = decodeEntities(String(raw).trim());
  let u: URL;
  try {
    u = base ? new URL(trimmed, base) : new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  if (u.protocol === 'http:') u.protocol = 'https:'; // upgrade; all listed publishers serve HTTPS
  return u.toString();
}

const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|_hsenc|_hsmi|ref|source|rss|feed)$/i;

/** Normalized URL used for cross-feed duplicate detection. */
export function normalizeUrl(raw: string): string | null {
  const s = safeHttpUrl(raw);
  if (!s) return null;
  const u = new URL(s);
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  const keep: [string, string][] = [];
  u.searchParams.forEach((v, k) => {
    if (!TRACKING_PARAMS.test(k)) keep.push([k, v]);
  });
  keep.sort(([a], [b]) => a.localeCompare(b));
  u.search = keep.length ? '?' + keep.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString();
}

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'em', 'strong', 'b', 'i', 'u', 's', 'sub', 'sup', 'a', 'img', 'figure', 'figcaption', 'table', 'thead',
  'tbody', 'tr', 'th', 'td', 'span', 'div', 'small', 'mark', 'dl', 'dt', 'dd',
]);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

/**
 * Allow-list HTML sanitizer. Drops dangerous elements with their content,
 * removes every attribute not explicitly allowed (all on* handlers, style,
 * srcset, etc.) and keeps only http(s) URLs.
 */
export function sanitizeHtml(html: string | null | undefined, baseUrl?: string): string {
  if (!html) return '';
  let s = String(html).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style|noscript|iframe|frame|frameset|object|embed|applet|svg|math|template|form|input|button|textarea|select|link|meta|base)\b[\s\S]*?(<\/\1\s*>|$)/gi, '');
  s = s.replace(/<(script|style|iframe|object|embed|link|meta|base|input|form)\b[^>]*\/?>/gi, '');
  const rewritten = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (full.startsWith('</')) return `</${tag}>`;
    const allowed = ALLOWED_ATTRS[tag];
    const out: string[] = [];
    if (allowed) {
      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(rawAttrs))) {
        const name = m[1].toLowerCase();
        if (!allowed.has(name)) continue;
        let val = m[3] ?? m[4] ?? m[5] ?? '';
        if (name === 'href' || name === 'src') {
          const safe = safeHttpUrl(val, baseUrl);
          if (!safe) continue;
          val = safe;
        }
        out.push(`${name}="${escapeAttr(decodeEntities(val))}"`);
      }
    }
    if (tag === 'a') out.push('rel="noopener noreferrer nofollow"');
    const selfClose = tag === 'br' || tag === 'hr' || tag === 'img';
    return `<${tag}${out.length ? ' ' + out.join(' ') : ''}${selfClose ? ' /' : ''}>`;
  });
  // Any '<' that is not one of the well-formed allowed tags emitted above is
  // stray markup (e.g. an unterminated tag) and is neutralised as text.
  const tags = [...ALLOWED_TAGS].join('|');
  return rewritten.replace(new RegExp(`<(?!/?(?:${tags})\\b[^<>]*>)`, 'gi'), '&lt;');
}

export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeHtml(s: string): string {
  return escapeAttr(s).replace(/'/g, '&#39;');
}

/** Escapes LIKE wildcards so user search text is matched literally. */
export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}
