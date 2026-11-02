/**
 * On-device API. Answers the same /api/v1 paths as the server, from the encrypted local vault,
 * so the app runs with no backend. Also exposes /local/* endpoints for manual data entry.
 */
import { derive, type Derived } from './derive';
import { vault, type Row } from './db';
import { COLLECTIONS, validateRecord, type CollectionKey } from './schema';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export class LocalError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const wrap = (d: Derived, data: unknown) => ({ is_demo: d.is_demo, as_of: d.as_of, data });
const r2 = (n: number) => Math.round(n * 100) / 100;

function monthSummary(d: Derived, month: string) {
  const inc: Record<string, number> = {};
  const exp: Record<string, number> = {};
  for (const t of d.transactions) {
    if (!t.date.startsWith(month)) continue;
    const tgt = t.direction === 'credit' ? inc : exp;
    tgt[t.category] = r2((tgt[t.category] ?? 0) + t.amount);
  }
  const total = (o: Record<string, number>) => r2(Object.values(o).reduce((a, b) => a + b, 0));
  const list = (o: Record<string, number>) => Object.entries(o).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const ti = total(inc);
  const te = total(exp);
  return { month, income_total: ti, expense_total: te, net_savings: r2(ti - te), savings_rate_pct: ti ? Math.round(((ti - te) / ti) * 1000) / 10 : 0, income: list(inc), expense: list(exp) };
}

/** Keep this month's net-worth snapshot in the vault so history builds up over time. */
async function persistSnapshot() {
  const db = vault.get();
  const d = derive(db);
  if (d.current.assets > 0 || d.current.liabilities > 0) {
    db.snapshots = [...db.snapshots.filter((s) => s.month !== d.current.month), d.current];
  }
  await vault.save();
}

export async function localHandler(method: Method, fullPath: string, body?: any): Promise<unknown> {
  if (!vault.isOpen()) throw new LocalError(401, 'session_revoked', 'Locked');
  const [path, qs = ''] = fullPath.split('?');
  const p: Record<string, string> = Object.fromEntries(qs.split('&').filter(Boolean).map((kv) => kv.split('=').map(decodeURIComponent)));
  const db = vault.get();

  // ---------------- manual data entry
  const col = path.match(/^\/local\/([a-z_]+)(?:\/([\w-]+))?$/);
  if (col && col[1] in COLLECTIONS) {
    const key = col[1] as CollectionKey;
    const rows = db.collections[key];
    if (method === 'GET') return rows;
    if (method === 'DELETE' && col[2]) {
      db.collections[key] = rows.filter((r) => r.id !== col[2]);
      if (key === 'bank_accounts') db.collections.transactions = db.collections.transactions.filter((t) => t.account_id !== col[2]);
      await persistSnapshot();
      return null;
    }
    const { value, errors } = validateRecord(COLLECTIONS[key], body ?? {});
    if (Object.keys(errors).length) throw new LocalError(422, 'validation_error', Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(', '));
    if (key === 'transactions' && !db.collections.bank_accounts.some((a) => a.id === value.account_id)) throw new LocalError(422, 'validation_error', 'Choose a bank account');
    const now = new Date().toISOString();
    if (method === 'POST') {
      const row: Row = { ...value, id: vault.newId(key.slice(0, 3)), updated_at: now };
      rows.push(row);
      await persistSnapshot();
      return row;
    }
    if (method === 'PUT' && col[2]) {
      const i = rows.findIndex((r) => r.id === col[2]);
      if (i < 0) throw new LocalError(404, 'not_found', 'Not found');
      // a manual edit turns a sample row into the user's own row
      rows[i] = { ...value, id: rows[i].id, updated_at: now };
      await persistSnapshot();
      return rows[i];
    }
  }

  if (method === 'POST' && path === '/local/sample') {
    // Inlined at bundle time: the release APK does not contain the sample module or its data.
    if (process.env.EXPO_PUBLIC_DEMO_MODE === '1') {
      const { loadSample } = require('./sample') as typeof import('./sample');
      loadSample(db);
      await vault.save();
      return { message: 'Sample data added' };
    }
    throw new LocalError(403, 'not_available', 'Sample data is only available in the debug build');
  }
  if (method === 'DELETE' && path === '/local/sample') {
    for (const k of Object.keys(db.collections) as CollectionKey[]) db.collections[k] = db.collections[k].filter((r) => !r.demo);
    db.snapshots = db.snapshots.filter((s) => !(s as any).demo);
    delete (db as any).mf_portfolio_xirr;
    await persistSnapshot();
    return { message: 'Sample data removed' };
  }
  if (method === 'GET' && path === '/local/backup') return db;

  const d = derive(db);
  switch (`${method} ${path}`) {
    case 'GET /me':
      return d.profile;
    case 'PUT /me': {
      if (typeof body.full_name === 'string' && body.full_name.trim().length >= 2) db.profile.full_name = body.full_name.trim().slice(0, 80);
      await vault.save();
      return derive(db).profile;
    }
    case 'PUT /me/pan': {
      const pan = String(body.pan ?? '').toUpperCase();
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) throw new LocalError(422, 'validation_error', 'Invalid PAN');
      db.profile.pan_last5 = pan.slice(5); // only the visible part of the masked PAN is kept
      await vault.save();
      return { pan_masked: `XXXXX${db.profile.pan_last5}` };
    }
    case 'GET /dashboard':
      return wrap(d, d.dashboard);
    case 'GET /banks/accounts':
      return wrap(d, d.bank_accounts);
    case 'GET /banks/transactions': {
      let rows = d.transactions;
      if (p.account_id) rows = rows.filter((r) => r.account_id === p.account_id);
      if (p.category) rows = rows.filter((r) => r.category === p.category);
      if (p.month) rows = rows.filter((r) => r.date.startsWith(p.month));
      const page = Number(p.page ?? 1);
      const size = Number(p.page_size ?? 30);
      const start = (page - 1) * size;
      return { ...wrap(d, rows.slice(start, start + size)), page, next_page: start + size < rows.length ? page + 1 : null, total: rows.length };
    }
    case 'GET /banks/categories':
      return wrap(d, monthSummary(d, p.month));
    case 'GET /investments/demat':
      return wrap(d, d.demat);
    case 'GET /investments/mutual-funds':
      return wrap(d, d.mutual_funds);
    case 'GET /investments/sips':
      return wrap(d, d.sips);
    case 'GET /investments/performance':
      return wrap(d, d.performance.slice(-({ '6M': 7, '1Y': 13, '2Y': 25 } as Record<string, number>)[p.range ?? '1Y']));
    case 'GET /savings':
      return wrap(d, d.savings);
    case 'GET /insurance':
      return wrap(d, d.insurance);
    case 'GET /liabilities':
      return wrap(d, d.liabilities);
    case 'GET /reports/monthly': {
      const s: any = monthSummary(d, p.month);
      const h = Object.fromEntries(d.net_worth_history.map((x) => [x.month, x]));
      const [y, m] = p.month.split('-').map(Number);
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      s.net_worth_end = h[p.month]?.net_worth ?? null;
      s.net_worth_change = h[p.month] && h[prev] ? r2(h[p.month].net_worth - h[prev].net_worth) : null;
      return wrap(d, s);
    }
    case 'GET /reports/annual': {
      const year = Number(p.year);
      const months = Array.from({ length: 12 }, (_, i) => {
        const s = monthSummary(d, `${year}-${String(i + 1).padStart(2, '0')}`);
        return { month: s.month, income_total: s.income_total, expense_total: s.expense_total, net_savings: s.net_savings };
      });
      const ti = r2(months.reduce((a, m) => a + m.income_total, 0));
      const te = r2(months.reduce((a, m) => a + m.expense_total, 0));
      const cats: Record<string, number> = {};
      for (const t of d.transactions) if (t.date.startsWith(String(year)) && t.direction === 'debit') cats[t.category] = r2((cats[t.category] ?? 0) + t.amount);
      return wrap(d, { year, months, income_total: ti, expense_total: te, net_savings: r2(ti - te), savings_rate_pct: ti ? Math.round(((ti - te) / ti) * 1000) / 10 : 0,
        expense_by_category: Object.entries(cats).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount) });
    }
    case 'GET /reports/allocation': {
      const t = d.dashboard.totals;
      const assets = [{ class: 'Bank balances', value: t.bank }, { class: 'Stocks (demat)', value: t.demat }, { class: 'Mutual funds', value: t.mutual_funds },
        { class: 'FD / RD', value: t.fixed_deposits }, { class: 'PPF / EPF / NPS', value: t.retirement }].filter((a) => a.value > 0);
      const byType: Record<string, number> = {};
      for (const l of d.liabilities.loans) byType[l.type] = (byType[l.type] ?? 0) + l.outstanding;
      if (d.liabilities.totals.card_outstanding) byType['Credit cards'] = d.liabilities.totals.card_outstanding;
      return wrap(d, { assets, liabilities: Object.entries(byType).map(([type, value]) => ({ type, value })) });
    }
    case 'GET /reports/net-worth-history':
      return wrap(d, d.net_worth_history.slice(p.range === '2Y' ? -25 : -13));
    case 'GET /institutions':
      return wrap(d, d.institutions);
    case 'GET /aa/consents':
      return wrap(d, []);
    case 'POST /aa/consents':
      throw new LocalError(409, 'needs_server', 'Account Aggregator linking needs a Personal Finance 360 server with a licensed AA partner. On-device mode uses manual entry.');
    case 'POST /sync':
      await persistSnapshot();
      return { status: 'ok' };
    case 'GET /sync/status':
      return wrap(d, d.dashboard.sync);
    case 'GET /settings/notifications':
      return db.settings.notif;
    case 'PUT /settings/notifications':
      Object.assign(db.settings.notif, body);
      await vault.save();
      return db.settings.notif;
    case 'GET /settings/privacy':
      return db.settings.privacy;
    case 'PUT /settings/privacy':
      Object.assign(db.settings.privacy, body);
      await vault.save();
      return db.settings.privacy;
    case 'GET /auth/sessions':
      return { data: [{ id: 'local', device_name: 'This device (on-device mode)', current: true, created_at: db.profile.created_at, last_used_at: new Date().toISOString() }] };
    case 'POST /devices/push-token':
      return null;
    case 'POST /me/export':
      return { job_id: 'local', message: 'Use “Download a backup” to save your data from this device.' };
  }
  throw new LocalError(404, 'not_found', `Not available on device: ${method} ${path}`);
}
