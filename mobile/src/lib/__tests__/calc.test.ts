import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xirr, absoluteReturnPct, pnl, creditUtilisationPct, allocationPct } from '../calc.ts';
import { inr, inrCompact, maskPan, shiftMonth } from '../format.ts';

const near = (a: number | null, b: number, eps = 1e-6) => assert.ok(a !== null && Math.abs(a - b) < eps, `${a} != ${b}`);

test('xirr: 10% over exactly one year', () => {
  near(xirr([{ date: '2025-01-01', amount: -10000 }, { date: '2026-01-01', amount: 11000 }]), 0.1);
});

test('xirr: loss', () => {
  near(xirr([{ date: '2025-01-01', amount: -10000 }, { date: '2026-01-01', amount: 9000 }]), -0.1);
});

test('xirr: monthly SIP matches backend fixture method', () => {
  const flows = Array.from({ length: 12 }, (_, i) => ({ date: new Date(Date.UTC(2025, i, 5)), amount: -1000 }));
  flows.push({ date: new Date(Date.UTC(2026, 0, 5)), amount: 12780 });
  const r = xirr(flows)!;
  assert.ok(r > 0.11 && r < 0.13, String(r));
});

test('xirr: undefined without both signs', () => {
  assert.equal(xirr([{ date: '2025-01-01', amount: -1 }, { date: '2025-02-01', amount: -1 }]), null);
});

test('pnl and absolute return', () => {
  const r = pnl(10, 100, 125);
  assert.equal(r.pnl, 250);
  assert.equal(r.pnlPct, 25);
  assert.equal(absoluteReturnPct(0, 10), 0);
});

test('credit utilisation', () => {
  near(creditUtilisationPct([{ outstanding: 30000, credit_limit: 100000 }, { outstanding: 0, credit_limit: 100000 }]), 15);
});

test('allocation always sums to 100', () => {
  const p = allocationPct([1, 1, 1]);
  assert.equal(Math.round(p.reduce((a, b) => a + b, 0) * 10) / 10, 100);
});

test('indian formatting', () => {
  assert.equal(inr(1214622.66), '₹12,14,623');
  assert.equal(inr(-500), '−₹500');
  assert.equal(inrCompact(12146226), '₹1.21 Cr');
  assert.equal(inrCompact(284650), '₹2.85 L');
});

test('PAN masking never leaks first five chars', () => {
  assert.equal(maskPan('ABCDE1234F'), 'XXXXX1234F');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
