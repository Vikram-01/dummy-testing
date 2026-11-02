/** Response shapes for API v1. See docs/API.md. */

export type Envelope<T> = { is_demo: boolean; as_of: string; data: T };
export type Paged<T> = Envelope<T[]> & { page: number; next_page: number | null; total: number };

export type TokenPair = {
  token_type: 'Bearer';
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  session_id: string;
};

export type LoginResult = { mfa_required: true; mfa_token: string; methods: string[] };
export type RegisterResult = { user_id: string; mfa_setup: { type: 'totp'; secret: string; otpauth_uri: string }; message: string };

export type Me = { id: string; full_name: string; email: string; phone_masked: string; pan_masked: string | null; is_demo: boolean };

export type SyncItem = { institution: string; status: 'ok' | 'stale' | 'failed'; message: string | null };
export type SyncState = {
  status: 'ok' | 'partial' | 'failed' | 'running' | 'never';
  last_synced_at: string | null;
  institutions_ok: number;
  institutions_failed: number;
  items: SyncItem[];
};

export type NetWorthPoint = { month: string; net_worth: number; assets: number; liabilities: number };

export type Dashboard = {
  as_of: string;
  net_worth: number;
  total_assets: number;
  totals: { bank: number; demat: number; mutual_funds: number; fixed_deposits: number; retirement: number; liabilities: number };
  net_worth_change_1m: number;
  net_worth_history: NetWorthPoint[];
  sync: SyncState;
};

export type BankAccount = {
  id: string; bank_name: string; account_type: string; account_masked: string;
  available_balance: number; current_balance: number; last_synced_at: string; sync_status: string;
};

export type Transaction = {
  id: string; account_id: string; date: string; description: string; amount: number;
  direction: 'credit' | 'debit'; category: string;
};

export type CategoryAmount = { category: string; amount: number };
export type MonthSummary = {
  month: string; income_total: number; expense_total: number; net_savings: number; savings_rate_pct: number;
  income: CategoryAmount[]; expense: CategoryAmount[]; net_worth_end?: number | null; net_worth_change?: number | null;
};

export type AnnualReport = {
  year: number; months: { month: string; income_total: number; expense_total: number; net_savings: number }[];
  income_total: number; expense_total: number; net_savings: number; savings_rate_pct: number;
  expense_by_category: CategoryAmount[];
};

export type Holding = {
  symbol: string; name: string; exchange: string; quantity: number; avg_price: number; ltp: number;
  invested: number; market_value: number; pnl: number; pnl_pct: number; day_change_pct: number;
};
export type Demat = {
  accounts: { id: string; depository: string; dp_name: string; bo_masked: string }[];
  holdings: Holding[];
  totals: { invested: number; market_value: number; pnl: number; pnl_pct: number };
};

export type MfHolding = {
  scheme_code: string; scheme_name: string; amc: string; category: string; folio_masked: string; units: number;
  nav: number; nav_date: string; invested: number; current_value: number; absolute_return_pct: number; xirr_pct: number;
};
export type MutualFunds = {
  holdings: MfHolding[];
  totals: { invested: number; current_value: number; absolute_return_pct: number; xirr_pct: number };
};
export type Sip = {
  id: string; scheme_name: string; amc: string; amount: number; frequency: string; sip_day: number;
  next_date: string; installments_done: number; start_date: string; status: string;
};
export type PerfPoint = { date: string; invested: number; value: number };

export type Deposit = {
  id: string; type: 'FD' | 'RD'; bank: string; account_masked: string; principal: number; rate_pct: number;
  start_date: string; maturity_date: string; maturity_amount: number; payout: string;
  monthly_installment?: number; days_to_maturity: number;
};
export type Savings = {
  deposits: Deposit[];
  retirement: {
    ppf: null | { balance: number; account_masked: string; opened_on: string; maturity_date: string; fy_contribution: number; fy_limit: number; rate_pct: number };
    epf: null | { balance: number; uan_masked: string; employee_share: number; employer_share: number; rate_pct: number; last_contribution: string };
    nps: null | { balance: number; pran_masked: string; tier1: number; tier2: number; scheme_mix: { asset: string; pct: number }[] };
  };
  totals: { deposits: number; retirement: number };
};

export type Policy = {
  id: string; type: 'life' | 'health' | 'motor'; insurer: string; plan: string; policy_masked: string;
  sum_assured: number; premium: number; frequency: string; renewal_date: string; status: string; insured: string;
  days_to_renewal: number;
};

export type Loan = {
  id: string; lender: string; type: string; account_masked: string; principal: number; outstanding: number;
  emi: number; interest_rate_pct: number; next_emi_date: string; tenure_left_months: number;
};
export type Card = {
  id: string; issuer: string; card_name: string; last4: string; credit_limit: number; outstanding: number;
  min_due: number; due_date: string; statement_date: string;
};
export type Liabilities = {
  loans: Loan[]; cards: Card[];
  totals: { loan_outstanding: number; card_outstanding: number; total: number; monthly_emi: number; credit_limit: number; utilisation_pct: number };
};

export type Allocation = { assets: { class: string; value: number }[]; liabilities: { type: string; value: number }[] };

export type Institution = { id: string; name: string; type: string; linked_via: string; status: string; last_synced_at: string | null };
export type Consent = {
  id: string; aa_handle: string; aa_name: string; fip_names: string[]; fi_types: string[]; purpose: string;
  status: 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'PENDING'; created_at: string; valid_till: string | null;
  fetch_frequency: string; data_range_months: number;
};

export type SessionInfo = { id: string; device_name: string; current: boolean; created_at: string; last_used_at: string };
export type NotificationPrefs = Record<'policy_renewals' | 'emi_due' | 'card_due' | 'sync_failures' | 'maturity_alerts' | 'weekly_summary', boolean>;
export type PrivacyPrefs = Record<'hide_balances_on_launch' | 'analytics_opt_in' | 'crash_reports_opt_in', boolean>;
