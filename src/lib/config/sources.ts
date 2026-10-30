import type { Category } from './categories';

export interface SourceDef {
  id: string;
  name: string;
  kind: 'news' | 'cve';
  /** Official RSS/Atom feed or API endpoint (HTTPS only). */
  url: string;
  homepage: string;
  /** Fallback category when no rule matches. */
  defaultCategory?: Category;
  /** 'news' = journalism outlets, 'research' = vendor/lab research blogs. */
  group?: 'news' | 'research';
}

/**
 * Official, publicly offered RSS/Atom feeds. The app only reads what each
 * publisher exposes in its feed; it does not crawl article pages.
 */
export const NEWS_SOURCES: SourceDef[] = [
  { id: 'thehackernews', name: 'The Hacker News', kind: 'news', group: 'news', url: 'https://feeds.feedburner.com/TheHackersNews', homepage: 'https://thehackernews.com' },
  { id: 'bleepingcomputer', name: 'BleepingComputer', kind: 'news', group: 'news', url: 'https://www.bleepingcomputer.com/feed/', homepage: 'https://www.bleepingcomputer.com' },
  { id: 'krebs', name: 'Krebs on Security', kind: 'news', group: 'news', url: 'https://krebsonsecurity.com/feed/', homepage: 'https://krebsonsecurity.com', defaultCategory: 'Threat Intelligence' },
  { id: 'darkreading', name: 'Dark Reading', kind: 'news', group: 'news', url: 'https://www.darkreading.com/rss.xml', homepage: 'https://www.darkreading.com' },
  { id: 'securityweek', name: 'SecurityWeek', kind: 'news', group: 'news', url: 'https://www.securityweek.com/feed/', homepage: 'https://www.securityweek.com' },
  { id: 'cyberscoop', name: 'CyberScoop', kind: 'news', group: 'news', url: 'https://cyberscoop.com/feed/', homepage: 'https://cyberscoop.com' },
  { id: 'infosecmag', name: 'Infosecurity Magazine', kind: 'news', group: 'news', url: 'https://www.infosecurity-magazine.com/rss/news/', homepage: 'https://www.infosecurity-magazine.com' },
  { id: 'scmedia', name: 'SC Media', kind: 'news', group: 'news', url: 'https://www.scworld.com/feed', homepage: 'https://www.scworld.com' },
  { id: 'projectzero', name: 'Google Project Zero', kind: 'news', group: 'research', url: 'https://googleprojectzero.blogspot.com/feeds/posts/default', homepage: 'https://googleprojectzero.blogspot.com', defaultCategory: 'Vulnerability Research' },
  { id: 'talos', name: 'Cisco Talos', kind: 'news', group: 'research', url: 'https://blog.talosintelligence.com/rss/', homepage: 'https://blog.talosintelligence.com', defaultCategory: 'Threat Intelligence' },
  { id: 'unit42', name: 'Palo Alto Unit 42', kind: 'news', group: 'research', url: 'https://unit42.paloaltonetworks.com/feed/', homepage: 'https://unit42.paloaltonetworks.com', defaultCategory: 'Threat Intelligence' },
  { id: 'mandiant', name: 'Mandiant (Google Threat Intelligence)', kind: 'news', group: 'research', url: 'https://feeds.feedburner.com/threatintelligence/pvexyqv7v0v', homepage: 'https://cloud.google.com/blog/topics/threat-intelligence', defaultCategory: 'Threat Intelligence' },
  { id: 'sans-isc', name: 'SANS Internet Storm Center', kind: 'news', group: 'research', url: 'https://isc.sans.edu/rssfeed_full.xml', homepage: 'https://isc.sans.edu', defaultCategory: 'Threat Intelligence' },
  { id: 'portswigger', name: 'PortSwigger Research', kind: 'news', group: 'research', url: 'https://portswigger.net/research/rss', homepage: 'https://portswigger.net/research', defaultCategory: 'Application Security' },
  { id: 'owasp', name: 'OWASP', kind: 'news', group: 'research', url: 'https://owasp.org/feed.xml', homepage: 'https://owasp.org', defaultCategory: 'Application Security' },
  { id: 'projectdiscovery', name: 'ProjectDiscovery', kind: 'news', group: 'research', url: 'https://projectdiscovery.io/blog/rss.xml', homepage: 'https://projectdiscovery.io/blog', defaultCategory: 'Penetration Testing' },
  { id: 'sonatype', name: 'Sonatype', kind: 'news', group: 'research', url: 'https://www.sonatype.com/blog/rss.xml', homepage: 'https://www.sonatype.com/blog', defaultCategory: 'Supply Chain Security' },
  { id: 'snyk', name: 'Snyk', kind: 'news', group: 'research', url: 'https://snyk.io/blog/feed/', homepage: 'https://snyk.io/blog', defaultCategory: 'Application Security' },
  { id: 'aws-security', name: 'AWS Security Blog', kind: 'news', group: 'research', url: 'https://aws.amazon.com/blogs/security/feed/', homepage: 'https://aws.amazon.com/blogs/security', defaultCategory: 'Cloud Security' },
  { id: 'wiz', name: 'Wiz Research', kind: 'news', group: 'research', url: 'https://www.wiz.io/feed/rss.xml', homepage: 'https://www.wiz.io/blog', defaultCategory: 'Cloud Security' },
  { id: 'sysdig', name: 'Sysdig', kind: 'news', group: 'research', url: 'https://sysdig.com/feed/', homepage: 'https://sysdig.com/blog', defaultCategory: 'Container and Kubernetes Security' },
  { id: 'aqua', name: 'Aqua Security', kind: 'news', group: 'research', url: 'https://www.aquasec.com/feed/', homepage: 'https://www.aquasec.com/blog', defaultCategory: 'Container and Kubernetes Security' },
];

export const CVE_SOURCES: SourceDef[] = [
  { id: 'nvd', name: 'NIST NVD', kind: 'cve', url: 'https://services.nvd.nist.gov/rest/json/cves/2.0', homepage: 'https://nvd.nist.gov' },
  { id: 'cisa-kev', name: 'CISA KEV Catalog', kind: 'cve', url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', homepage: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' },
  { id: 'ghsa', name: 'GitHub Security Advisories', kind: 'cve', url: 'https://api.github.com/advisories', homepage: 'https://github.com/advisories' },
  { id: 'cve-org', name: 'CVE.org (CVE Services)', kind: 'cve', url: 'https://cveawg.mitre.org/api/cve', homepage: 'https://www.cve.org' },
  { id: 'osv', name: 'OSV.dev', kind: 'cve', url: 'https://api.osv.dev/v1/vulns', homepage: 'https://osv.dev' },
];

export const ALL_SOURCES = [...NEWS_SOURCES, ...CVE_SOURCES];
