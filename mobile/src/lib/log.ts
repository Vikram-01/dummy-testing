/**
 * The only logger the app uses. In release builds it is a no-op. In debug builds it
 * redacts anything that looks like a token, PAN, account number, phone, email or amount
 * before printing. There is no analytics or crash-reporting SDK in this app; if one is
 * added later it must go through `redact` too.
 */
const PATTERNS: [RegExp, string][] = [
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]'],
  [/("?(access|refresh|mfa)_token"?\s*[:=]\s*"?)[^",\s}]+/gi, '$1[redacted]'],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[pan]'],
  [/\b\d{9,18}\b/g, '[number]'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]'],
  [/₹\s?[\d,]+(\.\d+)?/g, '₹[amount]'],
  [/\+?91[\s-]?\d{10}\b/g, '[phone]'],
];

export function redact(input: unknown): string {
  let s = typeof input === 'string' ? input : safeStringify(input);
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s;
}

function safeStringify(v: unknown): string {
  try {
    return v instanceof Error ? `${v.name}: ${v.message}` : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const log = {
  debug: (...args: unknown[]) => {
    if (__DEV__) console.log('[pf360]', ...args.map(redact));
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) console.warn('[pf360]', ...args.map(redact));
  },
};
