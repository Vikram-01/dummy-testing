import { classify, extractCveIds } from '../src/lib/config/categories';
import { httpGet, HttpError } from '../src/lib/net/http';
import { parseDate, parseFeed } from '../src/lib/parse/feed';
import { likeEscape, normalizeUrl, safeHttpUrl, sanitizeHtml, stripHtml } from '../src/lib/parse/sanitize';
import { normalizeSettings } from '../src/lib/repo/settings';
import { severityFromScore } from '../src/lib/repo/types';
import { cveOrgToInput, osvToInput } from '../src/lib/sync/enrich';
import { ghsaToInput, nextLink } from '../src/lib/sync/ghsa';
import { kevDate } from '../src/lib/sync/kev';
import { nvdDate, nvdParam, nvdToInput, parseCpeMatches, pickMetric } from '../src/lib/sync/nvd';
import { fakeFetch, status } from './helpers/fakeFetch';
import { atomFeed, cveOrgRecord, ghsaAdvisory, log4shellNvd, osvRecord, rssFeed } from './helpers/fixtures';

const noSleep = async () => {};

describe('sanitization and XSS guards', () => {
  it('removes scripts, event handlers, styles and javascript: URLs', () => {
    const dirty = `<p onclick="steal()">Hi <a href="javascript:alert(1)">x</a> <a href="https://ok.example/a">ok</a></p>
      <script>alert(1)</script><img src=x onerror=alert(1)><iframe src="https://evil"></iframe>
      <svg onload=alert(1)><circle/></svg><a href="data:text/html,<script>">d</a><div style="background:url(javascript:1)">s</div>`;
    const clean = sanitizeHtml(dirty, 'https://site.example/post');
    // No live tag may carry script, handlers, styles or non-http URLs; stray
    // fragments are allowed only as escaped text (&lt;...).
    expect(clean).not.toMatch(/<[^>]*(script|\bon\w+=|javascript:|data:|style=)/i);
    expect(clean).not.toMatch(/<(script|iframe|svg|div style)/i);
    expect(clean).toContain('href="https://ok.example/a"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it('resolves relative links and upgrades http to https', () => {
    expect(sanitizeHtml('<a href="/x">x</a>', 'https://site.example/a/b')).toContain('https://site.example/x');
    expect(safeHttpUrl('http://example.com/a')).toBe('https://example.com/a');
    expect(safeHttpUrl('file:///etc/passwd')).toBeNull();
    expect(safeHttpUrl('https://user:pw@example.com')).toBeNull();
  });

  it('strips markup to plain text and decodes entities, including double-encoded tags', () => {
    expect(stripHtml('<p>A &amp; B&#8217;s <b>bold</b></p>&lt;script&gt;x&lt;/script&gt;')).toBe('A & B’s bold');
  });

  it('normalizes URLs for duplicate detection', () => {
    expect(normalizeUrl('https://www.Example.com/post/?utm_source=rss&utm_medium=feed&id=2#top')).toBe('https://example.com/post?id=2');
    expect(normalizeUrl('http://example.com/post/')).toBe('https://example.com/post');
  });

  it('escapes LIKE wildcards in user search', () => {
    expect(likeEscape('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });
});

describe('feed parsing', () => {
  const now = Date.parse('2026-10-30T10:00:00Z');
  it('parses RSS 2.0 with CDATA, content:encoded and categories', () => {
    const items = parseFeed(
      rssFeed([{ title: 'Critical flaw &amp; exploit', link: 'https://news.example/a?utm_source=rss', date: now, desc: '<p>Short <b>summary</b> of CVE-2026-1234.</p>', content: `<p>${'Long body. '.repeat(30)}</p><script>x()</script>`, category: 'Vulnerability' }]),
      'https://news.example/feed',
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Critical flaw & exploit', summary: 'Short summary of CVE-2026-1234.', author: 'Staff Writer', publishedAt: now, categories: ['Vulnerability'] });
    expect(items[0].contentHtml).toContain('Long body.');
    expect(items[0].contentHtml).not.toContain('script');
  });

  it('parses Atom and prefers rel="alternate" links', () => {
    const items = parseFeed(atomFeed([{ title: 'Project post', href: 'https://blog.example/p/1', id: 'tag:blog,2026:1', date: now }]), 'https://blog.example/feed');
    expect(items[0]).toMatchObject({ url: 'https://blog.example/p/1', guid: 'tag:blog,2026:1', publishedAt: now, author: 'Researcher' });
  });

  it('rejects DTD entity declarations and non-feeds', () => {
    expect(() => parseFeed('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><rss><channel></channel></rss>', 'https://x.example')).toThrow(/DTD/);
    expect(() => parseFeed('<html><body>not a feed</body></html>', 'https://x.example')).toThrow(/Not an RSS/);
  });

  it('parses RFC-822 dates with US zone names', () => {
    expect(parseDate('Thu, 29 Oct 2026 14:00:00 EDT')).toBe(Date.parse('2026-10-29T18:00:00Z'));
    expect(parseDate('garbage')).toBeNull();
  });
});

describe('rule-based categorization', () => {
  it.each([
    ['LockBit affiliate deploys new ransomware strain against hospitals', 'Malware and Ransomware'],
    ['Malicious npm packages steal developer credentials in supply chain attack', 'Supply Chain Security'],
    ['Prompt injection flaw lets attackers hijack AI agents', 'AI Security'],
    ['Kubernetes ingress controller bug allows container escape', 'Container and Kubernetes Security'],
    ['Fortinet patches actively exploited zero-day in FortiGate SSL VPN', 'Zero-Day Vulnerabilities'],
    ['Retailer confirms data breach exposing 2 million customer records', 'Data Breaches'],
    ['New SBOM guidance from CISA on software bill of materials', 'SBOM and Software Composition Analysis'],
  ])('%s -> %s', (title, expected) => {
    expect(classify(title, '').primary).toBe(expected);
  });

  it('does not treat "said" as AI and falls back to the source default', () => {
    expect(classify('Officials said the agency will publish guidance', '', 'Cloud Security').primary).not.toBe('AI Security');
    expect(classify('Weekly update', 'Nothing matches here', 'Cloud Security').primary).toBe('Cloud Security');
  });

  it('extracts CVE ids', () => {
    expect(extractCveIds('See cve-2026-12345 and CVE-2026-12345, CVE-2025-1')).toEqual(['CVE-2026-12345']);
  });
});

describe('CVE source mappings', () => {
  const now = Date.parse('2026-10-30T10:00:00Z');

  it('maps NVD 2.0 records (Log4Shell) correctly', () => {
    const input = nvdToInput(log4shellNvd(now) as any);
    expect(input).toMatchObject({ id: 'CVE-2021-44228', cvssScore: 10, cvssVersion: '3.1', severity: 'CRITICAL', exploitRefs: true, patchAvailable: true, vulnStatus: 'Analyzed' });
    expect(input.cwes).toEqual(['CWE-502', 'CWE-400', 'CWE-20', 'CWE-917']);
    expect(input.title).toBe('Apache Log4j2 Remote Code Execution Vulnerability');
    expect(input.remediation).toMatch(/CISA required action/);
    expect(input.references!.map((r) => r.url)).not.toContain('javascript:alert(1)');
    expect(input.references!.find((r) => r.url.includes('packetstorm'))!.url.startsWith('https://')).toBe(true);
  });

  it('prefers newest CVSS version and Primary metrics', () => {
    expect(pickMetric({ cvssMetricV2: [{ cvssData: { version: '2.0', vectorString: 'v2', baseScore: 5 }, baseSeverity: 'MEDIUM' }], cvssMetricV31: [{ type: 'Secondary', cvssData: { version: '3.1', vectorString: 'a', baseScore: 7.5, baseSeverity: 'HIGH' } }, { type: 'Primary', cvssData: { version: '3.1', vectorString: 'b', baseScore: 9.8, baseSeverity: 'CRITICAL' } }] })).toMatchObject({ score: 9.8, vector: 'b' });
    expect(pickMetric({})).toBeNull();
  });

  it('parses only vulnerable CPE matches with version ranges', () => {
    const a = parseCpeMatches(log4shellNvd(now) as any);
    expect(a).toHaveLength(3);
    expect(a[0]).toEqual({ vendor: 'apache', product: 'log4j', versionSpec: '>= 2.0.1, < 2.3.1', fixedVersion: '2.3.1' });
    expect(a[2].versionSpec).toBe('= 2.0');
    expect(a.some((x) => x.vendor === 'microsoft')).toBe(false);
  });

  it('handles NVD timestamps and parameters as UTC', () => {
    expect(nvdDate('2026-10-30T10:00:00.000')).toBe(now);
    expect(decodeURIComponent(nvdParam(now))).toBe('2026-10-30T10:00:00.000+00:00');
  });

  it('maps GitHub advisories, skipping withdrawn ones', () => {
    const g = ghsaToInput(ghsaAdvisory(now) as any)!;
    expect(g).toMatchObject({ id: 'CVE-2021-44228', cvssScore: 10, cvssVersion: '3.1', patchAvailable: true });
    expect(g.affected![0]).toMatchObject({ product: 'org.apache.logging.log4j:log4j-core', ecosystem: 'maven', versionSpec: '>= 2.13.0, < 2.15.0', fixedVersion: '2.15.0' });
    expect(ghsaToInput(ghsaAdvisory(now, { withdrawn: true }) as any)).toBeNull();
    expect(ghsaToInput(ghsaAdvisory(now, { cve: null, ghsa: 'GHSA-xxxx-xxxx-xxxx' }) as any)!.id).toBe('GHSA-xxxx-xxxx-xxxx');
    expect(nextLink('<https://api.github.com/advisories?after=abc>; rel="next", <https://api.github.com/x>; rel="prev"')).toBe('https://api.github.com/advisories?after=abc');
    expect(nextLink('<https://evil.example/next>; rel="next"')).toBeNull();
  });

  it('maps CVE.org CNA records and OSV ranges', () => {
    const c = cveOrgToInput('CVE-2021-44228', cveOrgRecord())!;
    expect(c.affected).toHaveLength(3);
    expect(c.affected![0]).toMatchObject({ vendor: 'Apache Software Foundation', product: 'Apache Log4j2', versionSpec: '>= 2.0-beta9, < 2.3.1', fixedVersion: '2.3.1' });
    expect(c.remediation).toMatch(/message lookups feature has been completely removed/);
    const o = osvToInput('CVE-2021-44228', osvRecord());
    expect(o.affected!.map((x) => x.versionSpec)).toEqual(['>= 2.13.0, < 2.15.0', '< 2.3.1']);
    expect(o.references![0].tags).toEqual(['Patch']);
  });

  it('derives severity bands and KEV dates', () => {
    expect([9.8, 7, 4, 0.1, 0, null].map(severityFromScore)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN']);
    expect(kevDate('2021-12-10')).toBe(Date.parse('2021-12-10T00:00:00Z'));
    expect(kevDate('12/10/2021')).toBeNull();
  });
});

describe('HTTP client resilience', () => {
  it('retries 5xx with backoff then succeeds', async () => {
    const f = fakeFetch({ 'https://a.example/': (_u, _h, n) => (n < 3 ? status(503) : new Response('ok')) });
    const r = await httpGet(f.fetch, 'https://a.example/x', { sleep: noSleep, backoffMs: 1 });
    expect(r.body).toBe('ok');
    expect(f.calls).toHaveLength(3);
  });

  it('honours Retry-After on 429', async () => {
    const waits: number[] = [];
    const f = fakeFetch({ 'https://a.example/': (_u, _h, n) => (n === 1 ? status(429, { 'retry-after': '7' }) : new Response('ok')) });
    await httpGet(f.fetch, 'https://a.example/x', { sleep: async (ms) => void waits.push(ms) });
    expect(waits).toEqual([7000]);
  });

  it('does not retry 404 and rejects non-HTTPS', async () => {
    const f = fakeFetch({ 'https://a.example/': () => status(404) });
    await expect(httpGet(f.fetch, 'https://a.example/x', { sleep: noSleep })).rejects.toBeInstanceOf(HttpError);
    expect(f.calls).toHaveLength(1);
    await expect(httpGet(f.fetch, 'http://a.example/x')).rejects.toThrow(/non-HTTPS/);
  });

  it('gives up after bounded retries on network failure', async () => {
    const f = fakeFetch({});
    await expect(httpGet(f.fetch, 'https://down.example/x', { sleep: noSleep, retries: 2 })).rejects.toThrow(/Could not reach down.example \(Network request failed/);
    expect(f.calls).toHaveLength(3);
  });

  it('times out slow responses', async () => {
    const slow = (async (_u: string, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as any;
    await expect(httpGet(slow, 'https://slow.example/', { timeoutMs: 20, retries: 0 })).rejects.toThrow(/Timed out/);
  });
});

describe('settings', () => {
  it('defaults to hourly sync and 5-day retention, clamped to safe ranges', () => {
    expect(normalizeSettings({})).toMatchObject({ syncIntervalMinutes: 60, retentionDays: 5, theme: 'dark' });
    expect(normalizeSettings({ syncIntervalMinutes: 1, retentionDays: 1000 })).toMatchObject({ syncIntervalMinutes: 15, retentionDays: 90 });
  });
});
