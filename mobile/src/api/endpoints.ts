import { api } from './client';
import type {
  Allocation, AnnualReport, BankAccount, Consent, Dashboard, Demat, Envelope, Institution, Liabilities, LoginResult,
  Me, MonthSummary, MutualFunds, NetWorthPoint, NotificationPrefs, Paged, PerfPoint, Policy, PrivacyPrefs,
  RegisterResult, SessionInfo, Savings, Sip, SyncState, TokenPair, Transaction,
} from './types';

const q = (p: Record<string, string | number | undefined | null>) => {
  const s = Object.entries(p)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return s ? `?${s}` : '';
};

export const authApi = {
  login: (email: string, password: string, device_name: string) =>
    api<LoginResult>('POST', '/auth/login', { auth: false, body: { email, password, device_name } }),
  verifyMfa: (mfa_token: string, code: string, device_name: string) =>
    api<TokenPair>('POST', '/auth/mfa/verify', { auth: false, body: { mfa_token, code, device_name } }),
  register: (body: { full_name: string; email: string; phone: string; password: string }) =>
    api<RegisterResult>('POST', '/auth/register', { auth: false, body }),
  forgot: (email: string) => api<{ message: string; dev_reset_code?: string }>('POST', '/auth/password/forgot', { auth: false, body: { email } }),
  reset: (email: string, code: string, new_password: string) =>
    api<{ message: string }>('POST', '/auth/password/reset', { auth: false, body: { email, code, new_password } }),
  logout: (refresh_token: string) => api<null>('POST', '/auth/logout', { auth: false, body: { refresh_token } }),
  sessions: () => api<{ data: SessionInfo[] }>('GET', '/auth/sessions'),
  revokeSession: (id: string) => api<null>('DELETE', `/auth/sessions/${encodeURIComponent(id)}`),
};

export const financeApi = {
  me: () => api<Me>('GET', '/me'),
  setPan: (pan: string) => api<{ pan_masked: string }>('PUT', '/me/pan', { body: { pan } }),
  dashboard: () => api<Envelope<Dashboard>>('GET', '/dashboard'),
  bankAccounts: () => api<Envelope<BankAccount[]>>('GET', '/banks/accounts'),
  transactions: (p: { account_id?: string; category?: string; month?: string; page?: number }) =>
    api<Paged<Transaction>>('GET', '/banks/transactions' + q({ ...p, page_size: 30 })),
  categories: (month: string) => api<Envelope<MonthSummary>>('GET', '/banks/categories' + q({ month })),
  demat: () => api<Envelope<Demat>>('GET', '/investments/demat'),
  mutualFunds: () => api<Envelope<MutualFunds>>('GET', '/investments/mutual-funds'),
  sips: () => api<Envelope<Sip[]>>('GET', '/investments/sips'),
  performance: (range: '6M' | '1Y' | '2Y') => api<Envelope<PerfPoint[]>>('GET', '/investments/performance' + q({ range })),
  savings: () => api<Envelope<Savings>>('GET', '/savings'),
  insurance: () => api<Envelope<Policy[]>>('GET', '/insurance'),
  liabilities: () => api<Envelope<Liabilities>>('GET', '/liabilities'),
  monthly: (month: string) => api<Envelope<MonthSummary>>('GET', '/reports/monthly' + q({ month })),
  annual: (year: number) => api<Envelope<AnnualReport>>('GET', '/reports/annual' + q({ year })),
  allocation: () => api<Envelope<Allocation>>('GET', '/reports/allocation'),
  netWorthHistory: (range: '1Y' | '2Y') => api<Envelope<NetWorthPoint[]>>('GET', '/reports/net-worth-history' + q({ range })),
  institutions: () => api<Envelope<Institution[]>>('GET', '/institutions'),
  consents: () => api<Envelope<Consent[]>>('GET', '/aa/consents'),
  requestConsent: (aa_handle: string, fi_types: string[]) =>
    api<{ consent: Consent; redirect_url: string | null; message: string }>('POST', '/aa/consents', { body: { aa_handle, fi_types } }),
  consentAction: (id: string, action: 'pause' | 'resume' | 'revoke') =>
    api<Consent>('POST', `/aa/consents/${encodeURIComponent(id)}/${action}`),
  startSync: () => api<{ status: string }>('POST', '/sync'),
  syncStatus: () => api<Envelope<SyncState>>('GET', '/sync/status'),
  notificationPrefs: () => api<NotificationPrefs>('GET', '/settings/notifications'),
  setNotificationPrefs: (p: Partial<NotificationPrefs>) => api<NotificationPrefs>('PUT', '/settings/notifications', { body: p }),
  privacyPrefs: () => api<PrivacyPrefs>('GET', '/settings/privacy'),
  setPrivacyPrefs: (p: Partial<PrivacyPrefs>) => api<PrivacyPrefs>('PUT', '/settings/privacy', { body: p }),
  registerPushToken: (token: string) => api<null>('POST', '/devices/push-token', { body: { token, platform: 'android' } }),
  requestExport: () => api<{ job_id: string; message: string }>('POST', '/me/export'),
  deleteAccount: (password: string) => api<{ message: string }>('POST', '/me/delete', { body: { confirm: 'DELETE', password } }),
};
