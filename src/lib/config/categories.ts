export const CATEGORIES = [
  'Application Security',
  'Cloud Security',
  'Container and Kubernetes Security',
  'Network Security',
  'Malware and Ransomware',
  'Threat Intelligence',
  'Vulnerability Research',
  'Zero-Day Vulnerabilities',
  'Data Breaches',
  'Supply Chain Security',
  'SBOM and Software Composition Analysis',
  'Firmware and Binary Security',
  'DevSecOps',
  'Penetration Testing',
  'AI Security',
  'Identity and Access Management',
  'Security Compliance',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Rule-based classifier. Each rule has weighted patterns matched against the
 * lowercased title (x3 weight) and summary (x1). Highest score wins; ties go to
 * the earlier (more specific) rule. Patterns are word-boundary regexes so
 * "ai" does not match "said".
 */
interface Rule {
  category: Category;
  patterns: RegExp[];
}

const w = (s: string) => new RegExp(`\\b(?:${s})\\b`, 'i');

export const RULES: Rule[] = [
  { category: 'Zero-Day Vulnerabilities', patterns: [w('zero[- ]day|0[- ]day|0day'), w('exploited in the wild|actively exploited|in-the-wild exploitation')] },
  { category: 'Malware and Ransomware', patterns: [w('ransomware|ransom'), w('malware|trojan|infostealer|stealer|botnet|backdoor|rootkit|loader|wiper|spyware|rat'), w('lockbit|akira|blackcat|alphv|clop|black ?basta|qilin|play ransomware|scattered spider')] },
  { category: 'Data Breaches', patterns: [w('data breach|breach|breached|leak(?:ed)?|exposed (?:data|records|database)|stolen data|records exposed|data theft|extortion')] },
  { category: 'Supply Chain Security', patterns: [w('supply[- ]chain'), w('npm|pypi|rubygems|crates\\.io|maven central|nuget|typosquat\\w*|malicious package\\w*|dependency confusion|open[- ]source package\\w*'), w('github actions?|ci/cd pipeline')] },
  { category: 'SBOM and Software Composition Analysis', patterns: [w('sbom|software bill of materials|software composition analysis|sca|vex|cyclonedx|spdx|dependency scanning')] },
  { category: 'AI Security', patterns: [w('ai|artificial intelligence|llms?|large language models?|genai|generative ai|chatgpt|openai|prompt injection|jailbreak|model context protocol|mcp server|ai agents?|agentic|copilot|deepfakes?|machine learning')] },
  { category: 'Container and Kubernetes Security', patterns: [w('kubernetes|k8s|containers?|docker|helm|kubelet|eks|aks|gke|container escape|falco|runc|containerd|pod')] },
  { category: 'Cloud Security', patterns: [w('cloud|aws|amazon web services|azure|gcp|google cloud|s3 buckets?|iam roles?|saas|misconfigur\\w*|cspm|cnapp|serverless|lambda|entra')] },
  { category: 'Identity and Access Management', patterns: [w('identity|iam|mfa|multi-factor|2fa|passwords?|passkeys?|credentials?|sso|single sign-on|oauth|okta|active directory|kerberos|authentication bypass|session hijack\\w*|phishing')] },
  { category: 'Firmware and Binary Security', patterns: [w('firmware|uefi|bios|bootkit|secure boot|binary|reverse engineering|fuzzing|memory corruption|buffer overflow|use-after-free|heap overflow|iot|embedded|baseband')] },
  { category: 'Application Security', patterns: [w('xss|cross-site scripting|sql injection|sqli|csrf|ssrf|rce|remote code execution|deserialization|web application|web app|api security|owasp|wordpress plugin|authentication flaw|path traversal|request smuggling|browser|chrome|firefox|app ?sec')] },
  { category: 'Network Security', patterns: [w('network|firewall|vpn|router|ddos|dns|bgp|fortinet|fortigate|ivanti|palo alto|pan-os|cisco|juniper|sonicwall|citrix|netscaler|edge devices?|ssl vpn|ids|ips|wi-?fi')] },
  { category: 'DevSecOps', patterns: [w('devsecops|devops|ci/cd|pipeline security|shift[- ]left|infrastructure as code|iac|terraform|secrets scanning|git(?:hub|lab)? secrets?|sast|dast|code scanning')] },
  { category: 'Penetration Testing', patterns: [w('penetration test\\w*|pentest\\w*|red team\\w*|bug bounty|offensive security|nuclei|burp suite|ctf|exploit development|recon')] },
  { category: 'Security Compliance', patterns: [w('compliance|regulat\\w*|gdpr|hipaa|pci[- ]dss|nis2|dora|sec rules?|cisa directive|bod \\d+|fedramp|soc ?2|iso 27001|nist csf|policy|fines?|lawsuit|sanction\\w*|executive order|legislation')] },
  { category: 'Threat Intelligence', patterns: [w('apt\\d*|threat actors?|state-sponsored|nation-state|campaign|espionage|hacktivist\\w*|lazarus|volt typhoon|salt typhoon|fancy bear|cozy bear|sandworm|ttps|indicators of compromise|iocs?|threat intel\\w*|cybercrime|arrest\\w*|takedown')] },
  { category: 'Vulnerability Research', patterns: [w('vulnerabilit\\w*|cve-\\d{4}-\\d{4,}|flaw|bug|patch(?:es|ed)?|security update|advisory|exploit\\w*|proof[- ]of[- ]concept|poc|disclos\\w*')] },
];

export interface Classification {
  primary: Category;
  all: Category[];
}

export function classify(title: string, summary: string, fallback?: Category | null): Classification {
  const t = title.toLowerCase();
  const s = summary.toLowerCase();
  const scored: { category: Category; score: number; order: number }[] = [];
  RULES.forEach((rule, order) => {
    let score = 0;
    for (const p of rule.patterns) {
      if (p.test(t)) score += 3;
      if (p.test(s)) score += 1;
    }
    if (score > 0) scored.push({ category: rule.category, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  if (scored.length === 0) {
    const c = fallback ?? 'Threat Intelligence';
    return { primary: c, all: [c] };
  }
  const all = scored.map((x) => x.category);
  if (fallback && !all.includes(fallback)) all.push(fallback);
  return { primary: scored[0].category, all };
}

const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/gi;
export function extractCveIds(text: string): string[] {
  const m = text.match(CVE_RE) ?? [];
  return [...new Set(m.map((x) => x.toUpperCase()))];
}

/** Navigation sections that are views over categories / source groups. */
export const SECTION_FILTERS = {
  'threat-intel': { title: 'Threat Intelligence', categories: ['Threat Intelligence', 'Malware and Ransomware', 'Zero-Day Vulnerabilities', 'Data Breaches'] as Category[] },
  research: { title: 'Security Research', group: 'research' as const },
  appsec: { title: 'Application Security', categories: ['Application Security', 'DevSecOps', 'Penetration Testing'] as Category[] },
  cloud: { title: 'Cloud Security', categories: ['Cloud Security', 'Container and Kubernetes Security', 'Identity and Access Management'] as Category[] },
  'supply-chain': { title: 'Supply Chain Security', categories: ['Supply Chain Security', 'SBOM and Software Composition Analysis'] as Category[] },
};
