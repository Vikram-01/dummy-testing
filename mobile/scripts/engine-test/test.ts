import { vault } from '@/local/db';
import { localHandler } from '@/local/handler';
const { files } = require('./stubs.js');
const ok = (c: any, m: string) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  process.env.EXPO_PUBLIC_DEMO_MODE = '1';
  await vault.create('Vikram', '482913');
  const blob = [...files.values()][0] as string;
  ok(blob.startsWith('v1:') && !blob.includes('Vikram'), 'vault file is encrypted (name not visible)');
  vault.close();
  ok(!(await vault.checkPasscode('000000')), 'wrong passcode rejected');
  ok(await vault.checkPasscode('482913'), 'right passcode accepted');
  await vault.open();
  let d: any = await localHandler('GET', '/dashboard');
  ok(d.data.net_worth === 0 && d.is_demo === false, 'empty vault -> zero net worth, not demo');
  // manual entry
  const bank: any = await localHandler('POST', '/local/bank_accounts', { bank_name: 'SBI', account_type: 'Savings', last4: '1234', balance: '250000' });
  await localHandler('POST', '/local/transactions', { account_id: bank.id, date: '2026-10-03', direction: 'credit', amount: '100000', category: 'Salary', description: 'Salary' });
  await localHandler('POST', '/local/transactions', { account_id: bank.id, date: '2026-10-09', direction: 'debit', amount: '25000', category: 'Rent', description: 'Rent' });
  await localHandler('POST', '/local/mutual_funds', { scheme_name: 'UTI Nifty 50', amc: 'UTI Mutual Fund', category: 'Equity: Index', units: '1000', nav: '180', invested: '150000', first_date: '2024-11-01', sip_amount: '6250' });
  await localHandler('POST', '/local/cards', { card_name: 'Card', issuer: 'HDFC', last4: '9999', credit_limit: '100000', outstanding: '20000', due_date: '2025-01-15' });
  try { await localHandler('POST', '/local/cards', { card_name: 'x', issuer: 'y', last4: '1234567812345678', credit_limit: '1', outstanding: '1', due_date: '2026-01-01' }); ok(false, 'full card number rejected'); }
  catch (e: any) { ok(e.status === 422, 'full card number rejected (only last 4 allowed)'); }
  d = await localHandler('GET', '/dashboard');
  ok(Math.abs(d.data.net_worth - (250000 + 180000 - 20000)) < 0.01, `net worth = bank + MF - card (${d.data.net_worth})`);
  const mf: any = await localHandler('GET', '/investments/mutual-funds');
  ok(mf.data.totals.xirr_pct > 0 && mf.data.totals.xirr_pct < 40, `MF XIRR estimated (${mf.data.totals.xirr_pct}%)`);
  const l: any = await localHandler('GET', '/liabilities');
  ok(l.data.cards[0].due_date >= new Date().toISOString().slice(0, 10), `card due date rolled forward (${l.data.cards[0].due_date})`);
  ok(l.data.totals.utilisation_pct === 20, 'utilisation 20%');
  const m: any = await localHandler('GET', '/reports/monthly?month=2026-10');
  ok(m.data.income_total === 100000 && m.data.expense_total === 25000 && m.data.savings_rate_pct === 75, 'monthly report');
  ok((await localHandler('PUT', '/me/pan', { pan: 'abcde1234f' }) as any).pan_masked === 'XXXXX1234F', 'PAN masked, prefix discarded');
  ok(!JSON.stringify(vault.get()).includes('ABCDE'), 'PAN prefix not stored anywhere');
  // sample data
  await localHandler('POST', '/local/sample');
  d = await localHandler('GET', '/dashboard');
  ok(d.is_demo === true && d.data.net_worth_history.length >= 12, `sample loads, flagged DEMO, ${d.data.net_worth_history.length} months history`);
  for (const p of ['/banks/accounts', '/banks/transactions?page=1&page_size=30', '/banks/categories?month=2026-10', '/investments/demat', '/investments/sips', '/investments/performance?range=1Y', '/savings', '/insurance', '/reports/annual?year=2026', '/reports/allocation', '/reports/net-worth-history?range=2Y', '/institutions', '/aa/consents', '/settings/notifications', '/auth/sessions'])
    await localHandler('GET', p);
  ok(true, 'every GET endpoint answers');
  const s: any = await localHandler('GET', '/savings');
  ok(s.data.retirement.ppf && s.data.retirement.epf && s.data.retirement.nps, 'PPF/EPF/NPS present');
  await localHandler('DELETE', '/local/sample');
  d = await localHandler('GET', '/dashboard');
  ok(d.is_demo === false && Math.abs(d.data.net_worth - 410000) < 0.01, 'removing sample keeps only user rows');
  // persistence across reopen
  await vault.save(); vault.close(); await vault.open();
  ok(vault.get().collections.bank_accounts.length === 1, 'data survives lock/unlock');
  for (let i = 0; i < 5; i++) await vault.checkPasscode('111111');
  const lo = await vault.lockoutState();
  ok(lo.waitSec > 0, `lockout after 5 wrong passcodes (${lo.waitSec}s)`);
  await vault.erase();
  ok(!(await vault.exists()), 'erase removes vault');
})();
