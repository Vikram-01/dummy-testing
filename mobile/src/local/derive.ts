/**
 * Turns the raw rows in the local vault into exactly the response shapes the server API returns
 * (see docs/API.md), so every screen works the same in on-device and server mode.
 */
import { absoluteReturnPct, creditUtilisationPct, xirr, type CashFlow } from '@/lib/calc';
import type { LocalDB, Row, Snapshot } from './db';

const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ym = (d: Date) => iso(d).slice(0, 7);
const sum = (rows: Row[], k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
const mask = (last4?: string) => (last4 ? `XXXX${last4}` : 'XXXX');

function addMonths(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, Math.min(d, 28));
  return iso(dt);
}

/** Recurring due dates (EMI, card) roll forward month by month so they never show as past. */
export function rollForward(isoDate: string, today = new Date()): string {
  let d = isoDate;
  const t = iso(today);
  for (let i = 0; i < 600 && d < t; i++) d = addMonths(d, 1);
  return d;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Quarterly-compounded FD maturity; RD uses monthly instalments compounded quarterly. */
export function estimateMaturity(r: Row): number {
  const rate = (Number(r.rate_pct) || 0) / 100;
  const years = daysBetween(r.start_date, r.maturity_date) / 365;
  if (r.type === 'RD' && r.monthly_installment) {
    const months = Math.round(years * 12);
    let total = 0;
    for (let i = 0; i < months; i++) total += r.monthly_installment * Math.pow(1 + rate / 4, ((months - i) / 12) * 4);
    return r2(total);
  }
  return r2(r.principal * Math.pow(1 + rate / 4, 4 * years));
}

/** XIRR estimate for a fund: monthly SIP flows (if given) or a lump sum on the first date. */
export function fundXirr(r: Row, today = new Date()): number | null {
  if (typeof r.xirr_override === 'number') return r.xirr_override / 100;
  const value = r.units * r.nav;
  const flows: CashFlow[] = [];
  if (r.sip_amount && r.sip_amount > 0) {
    const n = Math.max(1, Math.round(r.invested / r.sip_amount));
    for (let i = 0; i < n; i++) flows.push({ date: addMonths(r.first_date, i), amount: -r.invested / n });
  } else flows.push({ date: r.first_date, amount: -r.invested });
  flows.push({ date: iso(today), amount: value });
  if (daysBetween(r.first_date, iso(today)) < 30) return null;
  return xirr(flows);
}

export function derive(db: LocalDB, today = new Date()) {
  const c = db.collections;
  const asOf = iso(today);
  const isDemo = Object.values(c).some((rows) => rows.some((r) => r.demo));

  // --- banking
  const bank_accounts = c.bank_accounts.map((a) => ({
    id: a.id, bank_name: a.bank_name, account_type: a.account_type, account_masked: mask(a.last4),
    available_balance: a.balance, current_balance: a.balance, last_synced_at: a.updated_at ?? db.last_saved_at ?? asOf, sync_status: 'manual',
  }));
  const transactions = [...c.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).map((t) => ({
    id: t.id, account_id: t.account_id, date: t.date, description: t.description, amount: t.amount, direction: t.direction, category: t.category,
  }));

  // --- stocks
  const holdings = c.stocks.map((s) => {
    const invested = s.quantity * s.avg_price;
    const mv = s.quantity * s.ltp;
    return { symbol: String(s.symbol).toUpperCase(), name: s.name ?? s.symbol, exchange: s.exchange, quantity: s.quantity, avg_price: s.avg_price, ltp: s.ltp,
      invested: r2(invested), market_value: r2(mv), pnl: r2(mv - invested), pnl_pct: r2(absoluteReturnPct(invested, mv)), day_change_pct: s.day_change_pct ?? 0, id: s.id };
  });
  const sInv = sum(holdings as any, 'invested');
  const sVal = sum(holdings as any, 'market_value');
  const demat = { accounts: [], holdings, totals: { invested: r2(sInv), market_value: r2(sVal), pnl: r2(sVal - sInv), pnl_pct: r2(absoluteReturnPct(sInv, sVal)) } };

  // --- mutual funds
  const mfRows = c.mutual_funds.map((f) => {
    const value = f.units * f.nav;
    const x = fundXirr(f, today);
    return { scheme_code: f.id, scheme_name: f.scheme_name, amc: f.amc, category: f.category, folio_masked: mask(f.folio_last4), units: f.units,
      nav: f.nav, nav_date: (f.updated_at ?? asOf).slice(0, 10), invested: r2(f.invested), current_value: r2(value),
      absolute_return_pct: r2(absoluteReturnPct(f.invested, value)), xirr_pct: x == null ? 0 : r2(x * 100) };
  });
  const mInv = sum(mfRows as any, 'invested');
  const mVal = sum(mfRows as any, 'current_value');
  let portfolioX: number | null = null;
  if (c.mutual_funds.some((f) => typeof f.xirr_override === 'number') && c.mutual_funds.length) {
    portfolioX = typeof (db as any).mf_portfolio_xirr === 'number' ? (db as any).mf_portfolio_xirr / 100 : null;
  }
  if (portfolioX == null && c.mutual_funds.length) {
    const flows: CashFlow[] = [];
    for (const f of c.mutual_funds) {
      if (f.sip_amount && f.sip_amount > 0) {
        const n = Math.max(1, Math.round(f.invested / f.sip_amount));
        for (let i = 0; i < n; i++) flows.push({ date: addMonths(f.first_date, i), amount: -f.invested / n });
      } else flows.push({ date: f.first_date, amount: -f.invested });
    }
    flows.push({ date: asOf, amount: mVal });
    portfolioX = xirr(flows);
  }
  const mutual_funds = { holdings: mfRows, totals: { invested: r2(mInv), current_value: r2(mVal), absolute_return_pct: r2(absoluteReturnPct(mInv, mVal)), xirr_pct: portfolioX == null ? 0 : r2(portfolioX * 100) } };

  const sips = c.sips.map((s) => {
    const months = Math.max(0, (today.getFullYear() - +s.start_date.slice(0, 4)) * 12 + today.getMonth() + 1 - +s.start_date.slice(5, 7));
    const next = new Date(today.getFullYear(), today.getMonth() + (today.getDate() >= s.sip_day ? 1 : 0), s.sip_day);
    return { id: s.id, scheme_name: s.scheme_name, amc: s.amc, amount: s.amount, frequency: 'Monthly', sip_day: s.sip_day,
      next_date: s.status === 'Active' ? iso(next) : '—', installments_done: s.installments_done ?? months, start_date: s.start_date, status: s.status };
  });

  // --- savings & retirement
  const deposits = c.deposits.map((d) => ({
    id: d.id, type: d.type, bank: d.bank, account_masked: mask(d.last4), principal: d.principal, rate_pct: d.rate_pct, start_date: d.start_date,
    maturity_date: d.maturity_date, maturity_amount: d.maturity_amount ?? estimateMaturity(d), payout: d.payout ?? (d.type === 'RD' ? 'On maturity' : 'Cumulative'),
    monthly_installment: d.monthly_installment, days_to_maturity: daysBetween(asOf, d.maturity_date),
  }));
  const pick = (k: string) => c.retirement.filter((r) => r.kind === k);
  const ppfR = pick('PPF');
  const epfR = pick('EPF');
  const npsR = pick('NPS');
  const ppf = ppfR.length ? { balance: sum(ppfR, 'balance'), account_masked: mask(ppfR[0].last4), opened_on: '', maturity_date: ppfR[0].maturity_date ?? '', fy_contribution: sum(ppfR, 'fy_contribution'), fy_limit: 150000, rate_pct: ppfR[0].rate_pct ?? 7.1 } : null;
  const epf = epfR.length ? { balance: sum(epfR, 'balance'), uan_masked: mask(epfR[0].last4), employee_share: sum(epfR, 'employee_share'), employer_share: sum(epfR, 'employer_share'), rate_pct: epfR[0].rate_pct ?? 8.25, last_contribution: (epfR[0].updated_at ?? asOf).slice(0, 10) } : null;
  const nps = npsR.length ? { balance: sum(npsR, 'balance') + sum(npsR, 'tier2'), pran_masked: mask(npsR[0].last4), tier1: sum(npsR, 'balance'), tier2: sum(npsR, 'tier2'),
    scheme_mix: npsR[0].equity_pct != null ? [{ asset: 'Equity (E)', pct: npsR[0].equity_pct }, { asset: 'Debt (C + G)', pct: 100 - npsR[0].equity_pct }] : [] } : null;
  const depTotal = sum(deposits as any, 'principal');
  const retTotal = (ppf?.balance ?? 0) + (epf?.balance ?? 0) + (nps?.balance ?? 0);
  const savings = { deposits, retirement: { ppf, epf, nps }, totals: { deposits: r2(depTotal), retirement: r2(retTotal) } };

  // --- insurance
  const insurance = c.insurance.map((p) => {
    const step = { Yearly: 12, 'Half-yearly': 6, Quarterly: 3, Monthly: 1 }[p.frequency as string] ?? 12;
    let renewal = p.renewal_date;
    for (let i = 0; i < 200 && renewal < asOf && daysBetween(renewal, asOf) > 30; i++) renewal = addMonths(renewal, step);
    return { id: p.id, type: p.type, insurer: p.insurer, plan: p.plan, policy_masked: mask(p.last4), sum_assured: p.sum_assured, premium: p.premium,
      frequency: p.frequency, renewal_date: renewal, status: daysBetween(asOf, renewal) <= 30 ? 'Renewal due' : 'Active', insured: p.insured ?? '', days_to_renewal: daysBetween(asOf, renewal) };
  });

  // --- liabilities
  const loans = c.loans.map((l) => ({ id: l.id, lender: l.lender, type: l.type, account_masked: mask(l.last4), principal: l.principal, outstanding: l.outstanding,
    emi: l.emi, interest_rate_pct: l.interest_rate_pct, next_emi_date: rollForward(l.next_emi_date, today), tenure_left_months: l.tenure_left_months ?? 0 }));
  const cards = c.cards.map((k) => ({ id: k.id, issuer: k.issuer, card_name: k.card_name, last4: k.last4 ?? '••••', credit_limit: k.credit_limit, outstanding: k.outstanding,
    min_due: k.min_due ?? r2(k.outstanding * 0.05), due_date: rollForward(k.due_date, today), statement_date: k.statement_date ?? '' }));
  const loanOut = sum(loans as any, 'outstanding');
  const cardOut = sum(cards as any, 'outstanding');
  const liabilities = { loans, cards, totals: { loan_outstanding: r2(loanOut), card_outstanding: r2(cardOut), total: r2(loanOut + cardOut),
    monthly_emi: r2(sum(loans as any, 'emi')), credit_limit: r2(sum(cards as any, 'credit_limit')), utilisation_pct: r2(creditUtilisationPct(cards)) } };

  // --- totals, snapshot for this month, history
  const totals = { bank: r2(sum(c.bank_accounts, 'balance')), demat: demat.totals.market_value, mutual_funds: mutual_funds.totals.current_value,
    fixed_deposits: savings.totals.deposits, retirement: savings.totals.retirement, liabilities: liabilities.totals.total };
  const totalAssets = r2(totals.bank + totals.demat + totals.mutual_funds + totals.fixed_deposits + totals.retirement);
  const netWorth = r2(totalAssets - totals.liabilities);
  const current: Snapshot = { month: ym(today), net_worth: netWorth, assets: totalAssets, liabilities: totals.liabilities, invested: r2(sInv + mInv), inv_value: r2(sVal + mVal) };
  const hasData = totalAssets > 0 || totals.liabilities > 0;
  const snaps = [...db.snapshots.filter((s) => s.month !== current.month), ...(hasData ? [current] : [])].sort((a, b) => (a.month < b.month ? -1 : 1));
  const history = snaps.map(({ month, net_worth, assets, liabilities: l }) => ({ month, net_worth, assets, liabilities: l }));
  const prev = history.length > 1 ? history[history.length - 2].net_worth : netWorth;

  const institutions = Array.from(new Set([
    ...c.bank_accounts.map((a) => `Bank|${a.bank_name}`), ...c.mutual_funds.map((f) => `Mutual funds|${f.amc}`),
    ...(c.stocks.length ? ['Depository|Demat holdings'] : []), ...c.loans.map((l) => `Lender|${l.lender}`), ...c.cards.map((k) => `Credit card|${k.issuer}`),
    ...c.insurance.map((p) => `Insurer|${p.insurer}`),
  ])).map((k, i) => {
    const [type, name] = k.split('|');
    return { id: `fi_${i}`, name, type, linked_via: 'Manual entry', status: 'Connected', last_synced_at: db.last_saved_at };
  });

  const sync = { status: hasData ? 'ok' : 'never', last_synced_at: db.last_saved_at, institutions_ok: institutions.length, institutions_failed: 0,
    items: institutions.map((i) => ({ institution: i.name, status: 'ok', message: 'Entered manually' })) };

  const dashboard = { as_of: asOf, net_worth: netWorth, total_assets: totalAssets, totals, net_worth_change_1m: r2(netWorth - prev),
    net_worth_history: history.slice(-13), sync };

  const performance = snaps.filter((s) => s.invested > 0).map((s) => ({ date: `${s.month}-01`, invested: s.invested, value: s.inv_value }));

  return {
    is_demo: isDemo, as_of: asOf, current,
    profile: { id: 'local', full_name: db.profile.full_name, email: db.profile.email ?? 'Stored on this device only', phone_masked: db.profile.phone ?? '—',
      pan_masked: db.profile.pan_last5 ? `XXXXX${db.profile.pan_last5}` : null, is_demo: isDemo },
    dashboard, bank_accounts, transactions, demat, mutual_funds, sips, performance, savings, insurance, liabilities, institutions,
    consents: [] as any[], net_worth_history: history,
  };
}

export type Derived = ReturnType<typeof derive>;
