/** Indian number formatting without relying on Intl (consistent across Android/Hermes versions). */

function groupIndian(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export function inr(value: number | null | undefined, opts: { decimals?: number; sign?: boolean } = {}): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const decimals = opts.decimals ?? 0;
  const neg = value < 0;
  const [i, f] = Math.abs(value).toFixed(decimals).split('.');
  const body = `₹${groupIndian(i)}${f ? '.' + f : ''}`;
  if (neg) return `−${body}`;
  return opts.sign && value > 0 ? `+${body}` : body;
}

/** ₹12.4 L, ₹1.25 Cr, ₹45.2 K */
export function inrCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const a = Math.abs(value);
  const s = value < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)} K`;
  return `${s}₹${a.toFixed(0)}`;
}

export function pct(value: number | null | undefined, opts: { sign?: boolean; decimals?: number } = {}): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const d = opts.decimals ?? 2;
  const s = opts.sign && value > 0 ? '+' : value < 0 ? '−' : '';
  return `${s}${Math.abs(value).toFixed(d)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthLabel(ym: string, short = false): string {
  const [y, m] = ym.split('-').map(Number);
  return short ? `${MONTHS[m - 1]} ’${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`;
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const diff = Math.max(0, now - Date.parse(iso));
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(ymStr: string, delta: number): string {
  const [y, m] = ymStr.split('-').map(Number);
  return ym(new Date(y, m - 1 + delta, 1));
}

/** PAN is never shown in full anywhere in the app. */
export function maskPan(pan: string): string {
  const p = pan.toUpperCase();
  return p.length === 10 ? `XXXXX${p.slice(5)}` : 'XXXXXXXXXX';
}

export const HIDDEN = '₹ • • • • •';
