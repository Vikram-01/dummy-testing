/**
 * Field definitions for everything a user can enter by hand in on-device mode.
 * Drives both the generic add/edit form and validation. Identifiers are limited to the
 * last 4 digits — full account, card, policy, UAN or PRAN numbers are never collected.
 */
import type { IconName } from '@/ui/components';

export type FieldType = 'text' | 'money' | 'number' | 'percent' | 'date' | 'select' | 'last4' | 'account';
export type FieldDef = {
  key: string; label: string; type: FieldType; required?: boolean; options?: string[]; hint?: string; placeholder?: string;
};
export type CollectionKey =
  | 'bank_accounts' | 'transactions' | 'stocks' | 'mutual_funds' | 'sips' | 'deposits'
  | 'retirement' | 'insurance' | 'loans' | 'cards';

export type CollectionDef = { key: CollectionKey; title: string; singular: string; icon: IconName; fields: FieldDef[]; titleField: string; subtitle: (r: Record<string, any>) => string };

const CATEGORIES = ['Salary', 'Freelance', 'Interest', 'Dividend', 'Refund', 'Other income', 'Groceries', 'Dining', 'Fuel', 'Utilities', 'Rent', 'Shopping', 'Travel', 'Health', 'Entertainment', 'Education', 'EMI', 'Insurance', 'Investments', 'Other'];

export const COLLECTIONS: Record<CollectionKey, CollectionDef> = {
  bank_accounts: {
    key: 'bank_accounts', title: 'Bank accounts', singular: 'bank account', icon: 'business-outline', titleField: 'bank_name',
    subtitle: (r) => `${r.account_type} · XXXX${r.last4 ?? ''}`,
    fields: [
      { key: 'bank_name', label: 'Bank name', type: 'text', required: true, placeholder: 'e.g. State Bank of India' },
      { key: 'account_type', label: 'Account type', type: 'select', options: ['Savings', 'Current', 'Salary', 'NRE/NRO'], required: true },
      { key: 'last4', label: 'Last 4 digits of account number', type: 'last4', hint: 'Only the last 4 digits are stored' },
      { key: 'balance', label: 'Current balance', type: 'money', required: true },
    ],
  },
  transactions: {
    key: 'transactions', title: 'Transactions', singular: 'transaction', icon: 'swap-vertical-outline', titleField: 'description',
    subtitle: (r) => `${r.date} · ${r.category}`,
    fields: [
      { key: 'account_id', label: 'Bank account', type: 'account', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'direction', label: 'Type', type: 'select', options: ['debit', 'credit'], required: true, hint: 'debit = money out, credit = money in' },
      { key: 'amount', label: 'Amount', type: 'money', required: true },
      { key: 'category', label: 'Category', type: 'select', options: CATEGORIES, required: true },
      { key: 'description', label: 'Description', type: 'text', required: true },
    ],
  },
  stocks: {
    key: 'stocks', title: 'Stocks', singular: 'stock holding', icon: 'stats-chart-outline', titleField: 'symbol',
    subtitle: (r) => `${r.quantity} shares · ${r.exchange}`,
    fields: [
      { key: 'symbol', label: 'Symbol', type: 'text', required: true, placeholder: 'e.g. INFY' },
      { key: 'name', label: 'Company name', type: 'text' },
      { key: 'exchange', label: 'Exchange', type: 'select', options: ['NSE', 'BSE'], required: true },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true },
      { key: 'avg_price', label: 'Average buy price', type: 'money', required: true },
      { key: 'ltp', label: 'Current price', type: 'money', required: true, hint: 'Update this to refresh market value' },
    ],
  },
  mutual_funds: {
    key: 'mutual_funds', title: 'Mutual funds', singular: 'mutual fund', icon: 'pie-chart-outline', titleField: 'scheme_name',
    subtitle: (r) => `${r.amc} · ${r.units} units`,
    fields: [
      { key: 'scheme_name', label: 'Scheme name', type: 'text', required: true, placeholder: 'e.g. UTI Nifty 50 Index Fund - Direct Growth' },
      { key: 'amc', label: 'Fund house', type: 'select', required: true, options: ['UTI Mutual Fund', 'SBI Mutual Fund', 'HDFC Mutual Fund', 'ICICI Prudential Mutual Fund', 'Nippon India Mutual Fund', 'Axis Mutual Fund', 'Kotak Mutual Fund', 'Parag Parikh Mutual Fund', 'Mirae Asset Mutual Fund', 'Other'] },
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['Equity: Index', 'Equity: Large Cap', 'Equity: Flexi Cap', 'Equity: Mid Cap', 'Equity: Small Cap', 'Equity: ELSS', 'Hybrid', 'Debt: Liquid', 'Debt: Short Duration', 'Debt: Gilt', 'Other'] },
      { key: 'folio_last4', label: 'Folio (last 4)', type: 'last4' },
      { key: 'units', label: 'Units held', type: 'number', required: true },
      { key: 'nav', label: 'Current NAV', type: 'money', required: true },
      { key: 'invested', label: 'Total amount invested', type: 'money', required: true },
      { key: 'first_date', label: 'First investment date', type: 'date', required: true, hint: 'Used to estimate XIRR' },
      { key: 'sip_amount', label: 'Monthly SIP (if invested via SIP)', type: 'money', hint: 'Leave empty for a lump sum' },
    ],
  },
  sips: {
    key: 'sips', title: 'SIPs', singular: 'SIP', icon: 'repeat-outline', titleField: 'scheme_name',
    subtitle: (r) => `Day ${r.sip_day} · ${r.status}`,
    fields: [
      { key: 'scheme_name', label: 'Scheme name', type: 'text', required: true },
      { key: 'amc', label: 'Fund house', type: 'text', required: true },
      { key: 'amount', label: 'Instalment', type: 'money', required: true },
      { key: 'sip_day', label: 'Day of month (1–28)', type: 'number', required: true },
      { key: 'start_date', label: 'Start date', type: 'date', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Paused', 'Stopped'], required: true },
    ],
  },
  deposits: {
    key: 'deposits', title: 'FDs & RDs', singular: 'deposit', icon: 'lock-closed-outline', titleField: 'bank',
    subtitle: (r) => `${r.type} · matures ${r.maturity_date}`,
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['FD', 'RD'], required: true },
      { key: 'bank', label: 'Bank / NBFC', type: 'text', required: true },
      { key: 'last4', label: 'Deposit number (last 4)', type: 'last4' },
      { key: 'principal', label: 'Principal (FD) or deposited so far (RD)', type: 'money', required: true },
      { key: 'monthly_installment', label: 'Monthly instalment (RD only)', type: 'money' },
      { key: 'rate_pct', label: 'Interest rate % p.a.', type: 'percent', required: true },
      { key: 'start_date', label: 'Start date', type: 'date', required: true },
      { key: 'maturity_date', label: 'Maturity date', type: 'date', required: true },
      { key: 'maturity_amount', label: 'Maturity amount', type: 'money', hint: 'Leave empty to estimate (quarterly compounding)' },
    ],
  },
  retirement: {
    key: 'retirement', title: 'PPF, EPF & NPS', singular: 'retirement account', icon: 'umbrella-outline', titleField: 'kind',
    subtitle: (r) => (r.kind === 'NPS' ? `Tier I + II` : r.maturity_date ? `Matures ${r.maturity_date}` : 'Balance'),
    fields: [
      { key: 'kind', label: 'Scheme', type: 'select', options: ['PPF', 'EPF', 'NPS'], required: true },
      { key: 'balance', label: 'Current balance (NPS: Tier I)', type: 'money', required: true },
      { key: 'rate_pct', label: 'Interest rate % (PPF/EPF)', type: 'percent' },
      { key: 'last4', label: 'Account / UAN / PRAN (last 4)', type: 'last4' },
      { key: 'maturity_date', label: 'Maturity date (PPF)', type: 'date' },
      { key: 'fy_contribution', label: 'Contributed this financial year (PPF)', type: 'money' },
      { key: 'employee_share', label: 'Employee share (EPF)', type: 'money' },
      { key: 'employer_share', label: 'Employer share (EPF)', type: 'money' },
      { key: 'tier2', label: 'Tier II balance (NPS)', type: 'money' },
      { key: 'equity_pct', label: 'Equity allocation % (NPS)', type: 'percent' },
    ],
  },
  insurance: {
    key: 'insurance', title: 'Insurance policies', singular: 'policy', icon: 'shield-checkmark-outline', titleField: 'insurer',
    subtitle: (r) => `${r.type} · renews ${r.renewal_date}`,
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['life', 'health', 'motor'], required: true },
      { key: 'insurer', label: 'Insurer', type: 'text', required: true },
      { key: 'plan', label: 'Plan name', type: 'text', required: true },
      { key: 'last4', label: 'Policy number (last 4)', type: 'last4' },
      { key: 'sum_assured', label: 'Cover / sum assured / IDV', type: 'money', required: true },
      { key: 'premium', label: 'Premium', type: 'money', required: true },
      { key: 'frequency', label: 'Premium frequency', type: 'select', options: ['Yearly', 'Half-yearly', 'Quarterly', 'Monthly'], required: true },
      { key: 'renewal_date', label: 'Next renewal / due date', type: 'date', required: true },
      { key: 'insured', label: 'Insured (who / which vehicle)', type: 'text' },
    ],
  },
  loans: {
    key: 'loans', title: 'Loans', singular: 'loan', icon: 'home-outline', titleField: 'type',
    subtitle: (r) => `${r.lender} · EMI day ${String(r.next_emi_date ?? '').slice(8)}`,
    fields: [
      { key: 'type', label: 'Loan type', type: 'select', options: ['Home loan', 'Car loan', 'Personal loan', 'Education loan', 'Gold loan', 'Loan against property', 'Other'], required: true },
      { key: 'lender', label: 'Lender', type: 'text', required: true },
      { key: 'last4', label: 'Loan account (last 4)', type: 'last4' },
      { key: 'principal', label: 'Original loan amount', type: 'money', required: true },
      { key: 'outstanding', label: 'Outstanding now', type: 'money', required: true },
      { key: 'emi', label: 'EMI', type: 'money', required: true },
      { key: 'interest_rate_pct', label: 'Interest rate % p.a.', type: 'percent', required: true },
      { key: 'next_emi_date', label: 'Next EMI date', type: 'date', required: true, hint: 'Rolls forward monthly automatically' },
      { key: 'tenure_left_months', label: 'Months remaining', type: 'number' },
    ],
  },
  cards: {
    key: 'cards', title: 'Credit cards', singular: 'credit card', icon: 'card-outline', titleField: 'card_name',
    subtitle: (r) => `${r.issuer} ···· ${r.last4 ?? ''}`,
    fields: [
      { key: 'card_name', label: 'Card name', type: 'text', required: true },
      { key: 'issuer', label: 'Issuer', type: 'text', required: true },
      { key: 'last4', label: 'Last 4 digits', type: 'last4', hint: 'Never enter the full card number or CVV' },
      { key: 'credit_limit', label: 'Credit limit', type: 'money', required: true },
      { key: 'outstanding', label: 'Current outstanding', type: 'money', required: true },
      { key: 'min_due', label: 'Minimum due', type: 'money' },
      { key: 'due_date', label: 'Payment due date', type: 'date', required: true, hint: 'Rolls forward monthly automatically' },
      { key: 'statement_date', label: 'Statement date', type: 'date' },
    ],
  },
};

export const COLLECTION_ORDER: CollectionKey[] = ['bank_accounts', 'transactions', 'stocks', 'mutual_funds', 'sips', 'deposits', 'retirement', 'insurance', 'loans', 'cards'];

/** Validates and normalises one record. Returns errors keyed by field. */
export function validateRecord(def: CollectionDef, input: Record<string, string>): { value: Record<string, any>; errors: Record<string, string> } {
  const value: Record<string, any> = {};
  const errors: Record<string, string> = {};
  for (const f of def.fields) {
    const raw = (input[f.key] ?? '').trim();
    if (!raw) {
      if (f.required) errors[f.key] = 'Required';
      continue;
    }
    switch (f.type) {
      case 'money':
      case 'number':
      case 'percent': {
        const n = Number(raw.replace(/[,₹\s%]/g, ''));
        if (!Number.isFinite(n) || n < 0) errors[f.key] = 'Enter a positive number';
        else if (f.type === 'percent' && n > 100) errors[f.key] = 'Must be 100 or less';
        else value[f.key] = n;
        break;
      }
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) errors[f.key] = 'Use YYYY-MM-DD';
        else value[f.key] = raw;
        break;
      case 'last4':
        if (!/^\d{4}$/.test(raw)) errors[f.key] = 'Exactly 4 digits';
        else value[f.key] = raw;
        break;
      case 'select':
        if (f.options && !f.options.includes(raw)) errors[f.key] = 'Choose an option';
        else value[f.key] = raw;
        break;
      default:
        if (raw.length > 120) errors[f.key] = 'Too long';
        else value[f.key] = raw;
    }
  }
  if (def.key === 'sips' && value.sip_day && (value.sip_day < 1 || value.sip_day > 28)) errors.sip_day = '1 to 28';
  if (def.key === 'deposits' && value.start_date && value.maturity_date && value.maturity_date <= value.start_date) errors.maturity_date = 'Must be after start date';
  return { value, errors };
}
