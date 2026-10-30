/**
 * TEST FIXTURES ONLY. Shapes mirror the real NVD 2.0, CISA KEV, GitHub
 * advisories, CVE.org and OSV payloads. CVE details used here are real,
 * well-documented public records (e.g. Log4Shell) so mappings are checked
 * against known-correct values. Nothing here ships in the app.
 */
const DAY = 86_400_000;
export const iso = (ms: number) => new Date(ms).toISOString();
export const rfc822 = (ms: number) => new Date(ms).toUTCString();
export const nvdTs = (ms: number) => new Date(ms).toISOString().replace('Z', '');

export function rssFeed(items: { title: string; link: string; guid?: string; date: number; desc?: string; content?: string; category?: string }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>Test</title><link>https://example.org</link>
${items
  .map(
    (i) => `<item>
  <title><![CDATA[${i.title}]]></title>
  <link>${i.link}</link>
  <guid isPermaLink="false">${i.guid ?? i.link}</guid>
  <pubDate>${rfc822(i.date)}</pubDate>
  <dc:creator><![CDATA[Staff Writer]]></dc:creator>
  ${i.category ? `<category><![CDATA[${i.category}]]></category>` : ''}
  <description><![CDATA[${i.desc ?? 'Summary text.'}]]></description>
  ${i.content ? `<content:encoded><![CDATA[${i.content}]]></content:encoded>` : ''}
</item>`,
  )
  .join('\n')}
</channel></rss>`;
}

export function atomFeed(entries: { title: string; href: string; id: string; date: number; summary?: string }[]) {
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Test</title>
${entries
  .map(
    (e) => `<entry><id>${e.id}</id><title type="html">${e.title}</title>
  <link rel="replies" href="${e.href}#comments"/><link rel="alternate" type="text/html" href="${e.href}"/>
  <published>${iso(e.date)}</published><updated>${iso(e.date)}</updated>
  <author><name>Researcher</name></author>
  <summary type="html">${e.summary ?? 'Atom summary'}</summary></entry>`,
  )
  .join('\n')}
</feed>`;
}

export function log4shellNvd(now: number, opts: { published?: number; modified?: number; score?: number } = {}) {
  return {
    id: 'CVE-2021-44228',
    sourceIdentifier: 'security@apache.org',
    published: nvdTs(opts.published ?? now - 1 * DAY),
    lastModified: nvdTs(opts.modified ?? now - 1 * DAY),
    vulnStatus: 'Analyzed',
    cisaExploitAdd: '2021-12-10',
    cisaActionDue: '2021-12-24',
    cisaRequiredAction: 'For all affected software assets for which updates exist, the only acceptable remediation actions are: 1) Apply updates; OR 2) remove affected assets from agency networks.',
    cisaVulnerabilityName: 'Apache Log4j2 Remote Code Execution Vulnerability',
    descriptions: [
      { lang: 'en', value: 'Apache Log4j2 2.0-beta9 through 2.15.0 (excluding security releases 2.12.2, 2.12.3, and 2.3.1) JNDI features used in configuration, log messages, and parameters do not protect against attacker controlled LDAP and other JNDI related endpoints.' },
      { lang: 'es', value: 'Apache Log4j2 ...' },
    ],
    metrics: {
      cvssMetricV31: [
        { source: 'nvd@nist.gov', type: 'Primary', cvssData: { version: '3.1', vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H', baseScore: opts.score ?? 10.0, baseSeverity: 'CRITICAL' } },
      ],
      cvssMetricV2: [{ source: 'nvd@nist.gov', type: 'Primary', cvssData: { version: '2.0', vectorString: 'AV:N/AC:M/Au:N/C:C/I:C/A:C', baseScore: 9.3 }, baseSeverity: 'HIGH' }],
    },
    weaknesses: [
      { source: 'security@apache.org', type: 'Primary', description: [{ lang: 'en', value: 'CWE-502' }, { lang: 'en', value: 'CWE-400' }, { lang: 'en', value: 'CWE-20' }] },
      { source: 'nvd@nist.gov', type: 'Primary', description: [{ lang: 'en', value: 'CWE-917' }] },
    ],
    configurations: [
      {
        nodes: [
          {
            operator: 'OR',
            negate: false,
            cpeMatch: [
              { vulnerable: true, criteria: 'cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*', versionStartIncluding: '2.0.1', versionEndExcluding: '2.3.1' },
              { vulnerable: true, criteria: 'cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*', versionStartIncluding: '2.13.0', versionEndExcluding: '2.15.0' },
              { vulnerable: true, criteria: 'cpe:2.3:a:apache:log4j:2.0:beta9:*:*:*:*:*:*' },
              { vulnerable: false, criteria: 'cpe:2.3:o:microsoft:windows:-:*:*:*:*:*:*:*' },
            ],
          },
        ],
      },
    ],
    references: [
      { url: 'https://logging.apache.org/log4j/2.x/security.html', source: 'security@apache.org', tags: ['Release Notes', 'Vendor Advisory'] },
      { url: 'http://packetstormsecurity.com/files/165225/Apache-Log4j2-2.14.1-Remote-Code-Execution.html', source: 'security@apache.org', tags: ['Exploit', 'Third Party Advisory', 'VDB Entry'] },
      { url: 'javascript:alert(1)', source: 'evil', tags: ['Patch'] },
    ],
  };
}

export function simpleNvdCve(id: string, now: number, ageDays: number, score: number | null, extra: Record<string, unknown> = {}) {
  const t = now - ageDays * DAY;
  return {
    id,
    published: nvdTs(t),
    lastModified: nvdTs(t),
    vulnStatus: 'Awaiting Analysis',
    descriptions: [{ lang: 'en', value: `Test description for ${id} affecting Example Router firmware.` }],
    metrics: score == null ? {} : { cvssMetricV31: [{ source: 'cna@example.org', type: 'Secondary', cvssData: { version: '3.1', vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', baseScore: score, baseSeverity: score >= 9 ? 'CRITICAL' : score >= 7 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW' } }] },
    weaknesses: [{ source: 'cna@example.org', type: 'Secondary', description: [{ lang: 'en', value: 'CWE-78' }] }],
    references: [{ url: `https://vendor.example.com/advisories/${id}`, source: 'cna@example.org', tags: ['Vendor Advisory'] }],
    ...extra,
  };
}

export function nvdPage(cves: unknown[], startIndex = 0, total?: number) {
  return { resultsPerPage: cves.length, startIndex, totalResults: total ?? cves.length, format: 'NVD_CVE', version: '2.0', timestamp: new Date().toISOString(), vulnerabilities: cves.map((cve) => ({ cve })) };
}

/** KEV catalogs must contain >= 100 rows to be accepted (truncation guard). */
export function kevCatalog(entries: { cveID: string; dateAdded: string; ransomware?: 'Known' | 'Unknown'; vendor?: string; product?: string; name?: string }[]) {
  const filler = Array.from({ length: 120 }, (_, i) => ({
    cveID: `CVE-2019-${String(10000 + i)}`,
    vendorProject: 'LegacyVendor',
    product: 'LegacyProduct',
    vulnerabilityName: 'Legacy Vulnerability',
    dateAdded: '2021-11-03',
    shortDescription: 'Older catalog entry.',
    requiredAction: 'Apply updates per vendor instructions.',
    dueDate: '2022-05-03',
    knownRansomwareCampaignUse: 'Unknown',
    notes: '',
  }));
  return {
    title: 'CISA Catalog of Known Exploited Vulnerabilities',
    catalogVersion: '2026.10.30',
    dateReleased: '2026-10-30T17:00:00.000Z',
    count: filler.length + entries.length,
    vulnerabilities: [
      ...entries.map((e) => ({
        cveID: e.cveID,
        vendorProject: e.vendor ?? 'Apache',
        product: e.product ?? 'Log4j2',
        vulnerabilityName: e.name ?? 'Apache Log4j2 Remote Code Execution Vulnerability',
        dateAdded: e.dateAdded,
        shortDescription: 'Apache Log4j2 contains a vulnerability where JNDI features do not protect against attacker-controlled JNDI-related endpoints.',
        requiredAction: 'Apply updates per vendor instructions.',
        dueDate: '2021-12-24',
        knownRansomwareCampaignUse: e.ransomware ?? 'Unknown',
        notes: 'https://logging.apache.org/log4j/2.x/security.html',
      })),
      ...filler,
    ],
  };
}

export function ghsaAdvisory(now: number, opts: { cve?: string | null; ghsa?: string; ageDays?: number; withdrawn?: boolean } = {}) {
  const t = iso(now - (opts.ageDays ?? 1) * DAY);
  return {
    ghsa_id: opts.ghsa ?? 'GHSA-jfh8-c2jp-5v3q',
    cve_id: opts.cve === undefined ? 'CVE-2021-44228' : opts.cve,
    url: 'https://api.github.com/advisories/GHSA-jfh8-c2jp-5v3q',
    html_url: `https://github.com/advisories/${opts.ghsa ?? 'GHSA-jfh8-c2jp-5v3q'}`,
    summary: 'Remote code injection in Log4j',
    description: 'Logging untrusted data with log4j versions 2.0-beta9 through 2.14.1 can result in remote code execution.',
    type: 'reviewed',
    severity: 'critical',
    published_at: t,
    updated_at: t,
    withdrawn_at: opts.withdrawn ? t : null,
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-44228'],
    cvss_severities: { cvss_v3: { vector_string: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H', score: 10.0 }, cvss_v4: { vector_string: null, score: 0 } },
    cwes: [{ cwe_id: 'CWE-502', name: 'Deserialization of Untrusted Data' }],
    vulnerabilities: [
      { package: { ecosystem: 'maven', name: 'org.apache.logging.log4j:log4j-core' }, vulnerable_version_range: '>= 2.13.0, < 2.15.0', first_patched_version: '2.15.0', vulnerable_functions: [] },
      { package: { ecosystem: 'maven', name: 'org.apache.logging.log4j:log4j-core' }, vulnerable_version_range: '>= 2.0-beta9, < 2.3.1', first_patched_version: '2.3.1', vulnerable_functions: [] },
    ],
  };
}

export function cveOrgRecord() {
  return {
    dataType: 'CVE_RECORD',
    dataVersion: '5.1',
    cveMetadata: { cveId: 'CVE-2021-44228', state: 'PUBLISHED', datePublished: '2021-12-10T00:00:00.000Z' },
    containers: {
      cna: {
        title: 'Apache Log4j2 JNDI features do not protect against attacker controlled LDAP and other JNDI related endpoints',
        affected: [
          {
            vendor: 'Apache Software Foundation',
            product: 'Apache Log4j2',
            versions: [
              { version: '2.0-beta9', status: 'affected', lessThan: '2.3.1', versionType: 'custom' },
              { version: '2.4', status: 'affected', lessThan: '2.12.2', versionType: 'custom' },
              { version: '2.13.0', status: 'affected', lessThan: '2.15.0', versionType: 'custom' },
            ],
          },
        ],
        problemTypes: [{ descriptions: [{ cweId: 'CWE-502', lang: 'en', type: 'CWE' }] }],
        references: [{ url: 'https://logging.apache.org/log4j/2.x/security.html', tags: ['patch'] }],
        solutions: [{ lang: 'en', value: 'In Log4j 2.12.2 (for Java 7) and 2.16.0 (for Java 8 or later) the message lookups feature has been completely removed.' }],
      },
    },
  };
}

export function osvRecord() {
  return {
    id: 'CVE-2021-44228',
    aliases: ['GHSA-jfh8-c2jp-5v3q'],
    summary: 'Remote code injection in Log4j',
    affected: [
      {
        package: { ecosystem: 'Maven', name: 'org.apache.logging.log4j:log4j-core' },
        ranges: [
          { type: 'ECOSYSTEM', events: [{ introduced: '2.13.0' }, { fixed: '2.15.0' }] },
          { type: 'ECOSYSTEM', events: [{ introduced: '0' }, { fixed: '2.3.1' }] },
        ],
      },
    ],
    references: [{ type: 'FIX', url: 'https://github.com/apache/logging-log4j2/pull/608' }],
  };
}

export const DAY_MS = DAY;
