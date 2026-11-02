/**
 * SAMPLE DATA (debug APK only). Copies the fictional fixture into the vault with every row
 * flagged demo: true so the DEMO banner shows until the user removes it. Never mixed silently
 * with real data: Profile → "Remove sample data" deletes exactly these rows.
 */
import type { LocalDB, Row } from './db';

export function loadSample(db: LocalDB) {
  const F = require('@/demo/fixture.json');
  const last4 = (s: string) => String(s).replace(/\D/g, '').slice(-4) || undefined;
  const tag = <T extends object>(r: T, id: string): Row => ({ ...r, id, demo: true });

  const sipStart: Record<string, any> = Object.fromEntries(F.sips.map((s: any) => [s.scheme_name, s]));
  const c = db.collections;
  c.bank_accounts.push(...F.bank_accounts.map((a: any) => tag({ bank_name: a.bank_name, account_type: a.account_type, last4: last4(a.account_masked), balance: a.available_balance }, `demo_${a.id}`)));
  c.transactions.push(...F.transactions.map((t: any) => tag({ ...t, account_id: `demo_${t.account_id}` }, `demo_${t.id}`)));
  c.stocks.push(...F.demat.holdings.map((h: any) => tag({ symbol: h.symbol, name: h.name, exchange: h.exchange, quantity: h.quantity, avg_price: h.avg_price, ltp: h.ltp, day_change_pct: h.day_change_pct }, `demo_${h.symbol}`)));
  c.mutual_funds.push(...F.mutual_funds.holdings.map((h: any) => tag({
    scheme_name: h.scheme_name, amc: h.amc, category: h.category, folio_last4: last4(h.folio_masked), units: h.units, nav: h.nav, invested: h.invested,
    first_date: sipStart[h.scheme_name]?.start_date ?? '2024-01-05', sip_amount: sipStart[h.scheme_name]?.amount, xirr_override: h.xirr_pct,
  }, `demo_${h.scheme_code}`)));
  c.sips.push(...F.sips.map((s: any) => tag({ scheme_name: s.scheme_name, amc: s.amc, amount: s.amount, sip_day: s.sip_day, start_date: s.start_date, status: s.status, installments_done: s.installments_done }, `demo_${s.id}`)));
  c.deposits.push(...F.savings.deposits.map((d: any) => tag({ type: d.type, bank: d.bank, last4: last4(d.account_masked), principal: d.principal, monthly_installment: d.monthly_installment,
    rate_pct: d.rate_pct, start_date: d.start_date, maturity_date: d.maturity_date, maturity_amount: d.maturity_amount, payout: d.payout }, `demo_${d.id}`)));
  const r = F.savings.retirement;
  c.retirement.push(
    tag({ kind: 'PPF', balance: r.ppf.balance, rate_pct: r.ppf.rate_pct, last4: last4(r.ppf.account_masked), maturity_date: r.ppf.maturity_date, fy_contribution: r.ppf.fy_contribution }, 'demo_ppf'),
    tag({ kind: 'EPF', balance: r.epf.balance, rate_pct: r.epf.rate_pct, last4: last4(r.epf.uan_masked), employee_share: r.epf.employee_share, employer_share: r.epf.employer_share }, 'demo_epf'),
    tag({ kind: 'NPS', balance: r.nps.tier1, tier2: r.nps.tier2, last4: last4(r.nps.pran_masked), equity_pct: 75 }, 'demo_nps'),
  );
  c.insurance.push(...F.insurance.map((p: any) => tag({ type: p.type, insurer: p.insurer, plan: p.plan, last4: last4(p.policy_masked), sum_assured: p.sum_assured, premium: p.premium,
    frequency: p.frequency, renewal_date: p.renewal_date, insured: p.insured }, `demo_${p.id}`)));
  c.loans.push(...F.liabilities.loans.map((l: any) => tag({ type: l.type, lender: l.lender, last4: last4(l.account_masked), principal: l.principal, outstanding: l.outstanding, emi: l.emi,
    interest_rate_pct: l.interest_rate_pct, next_emi_date: l.next_emi_date, tenure_left_months: l.tenure_left_months }, `demo_${l.id}`)));
  c.cards.push(...F.liabilities.cards.map((k: any) => tag({ card_name: k.card_name, issuer: k.issuer, last4: k.last4, credit_limit: k.credit_limit, outstanding: k.outstanding,
    min_due: k.min_due, due_date: k.due_date, statement_date: k.statement_date }, `demo_${k.id}`)));

  const perf: Record<string, any> = Object.fromEntries(F.performance.map((p: any) => [p.date.slice(0, 7), p]));
  const thisMonth = new Date().toISOString().slice(0, 7);
  const existing = new Set(db.snapshots.map((s) => s.month));
  for (const h of F.net_worth_history) {
    if (h.month >= thisMonth || existing.has(h.month)) continue;
    db.snapshots.push({ month: h.month, net_worth: h.net_worth, assets: h.assets, liabilities: h.liabilities,
      invested: perf[h.month]?.invested ?? 0, inv_value: perf[h.month]?.value ?? 0, demo: true } as any);
  }
  db.snapshots.sort((a, b) => (a.month < b.month ? -1 : 1));
  (db as any).mf_portfolio_xirr = F.mutual_funds.totals.xirr_pct;
}
