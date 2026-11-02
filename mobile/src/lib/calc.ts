/** Portfolio maths. Pure functions, unit-tested in __tests__/calc.test.ts. Mirrors backend/app/calc.py. */

export type CashFlow = { date: string | Date; amount: number };

const DAY = 86_400_000;

function toTime(d: string | Date): number {
  return typeof d === 'string' ? Date.parse(d.length === 10 ? d + 'T00:00:00Z' : d) : d.getTime();
}

function xnpv(rate: number, flows: { t: number; a: number }[]): number {
  return flows.reduce((s, f) => s + f.a / Math.pow(1 + rate, f.t), 0);
}

function dxnpv(rate: number, flows: { t: number; a: number }[]): number {
  return flows.reduce((s, f) => s - (f.t * f.a) / Math.pow(1 + rate, f.t + 1), 0);
}

/** Annualised XIRR as a fraction (0.1 = 10%). Outflows negative, inflows positive. Returns null if undefined. */
export function xirr(cashflows: CashFlow[], guess = 0.1): number | null {
  if (cashflows.length < 2) return null;
  const sorted = [...cashflows].sort((a, b) => toTime(a.date) - toTime(b.date));
  if (!sorted.some((f) => f.amount < 0) || !sorted.some((f) => f.amount > 0)) return null;
  const t0 = toTime(sorted[0].date);
  const flows = sorted.map((f) => ({ t: (toTime(f.date) - t0) / DAY / 365, a: f.amount }));
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const f = xnpv(rate, flows);
    const df = dxnpv(rate, flows);
    if (df === 0) break;
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }
  let lo = -0.9999;
  let hi = 10;
  if (xnpv(lo, flows) * xnpv(hi, flows) > 0) return null;
  for (let i = 0; i < 300 && hi - lo > 1e-10; i++) {
    const mid = (lo + hi) / 2;
    if (xnpv(lo, flows) * xnpv(mid, flows) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function absoluteReturnPct(invested: number, current: number): number {
  return invested === 0 ? 0 : ((current - invested) / invested) * 100;
}

export function pnl(quantity: number, avgPrice: number, ltp: number) {
  const invested = quantity * avgPrice;
  const value = quantity * ltp;
  return { invested, value, pnl: value - invested, pnlPct: absoluteReturnPct(invested, value) };
}

export function creditUtilisationPct(cards: { outstanding: number; credit_limit: number }[]): number {
  const limit = cards.reduce((s, c) => s + c.credit_limit, 0);
  const used = cards.reduce((s, c) => s + c.outstanding, 0);
  return limit === 0 ? 0 : (used / limit) * 100;
}

/** Shares that always sum to 100 (largest-remainder rounding to 1 decimal). */
export function allocationPct(values: number[]): number[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total === 0) return values.map(() => 0);
  const raw = values.map((v) => (Math.max(0, v) / total) * 1000);
  const floors = raw.map(Math.floor);
  let rest = 1000 - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (const o of order) {
    if (rest <= 0) break;
    floors[o.i] += 1;
    rest -= 1;
  }
  return floors.map((v) => v / 10);
}

export function daysUntil(isoDate: string, from: Date = new Date()): number {
  const d = toTime(isoDate);
  const f = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((d - f) / DAY);
}
