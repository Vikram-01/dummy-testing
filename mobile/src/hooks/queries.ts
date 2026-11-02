import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { financeApi } from '@/api/endpoints';
import { keys } from '@/state/queryClient';

/** Persisted for the offline read-only dashboard. */
export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: financeApi.dashboard, meta: { persist: true } });
export const useBankAccounts = () => useQuery({ queryKey: keys.bankAccounts, queryFn: financeApi.bankAccounts, meta: { persist: true } });

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: financeApi.me });
export const useCategories = (month: string) => useQuery({ queryKey: keys.categories(month), queryFn: () => financeApi.categories(month) });
export const useDemat = () => useQuery({ queryKey: keys.demat, queryFn: financeApi.demat });
export const useMutualFunds = () => useQuery({ queryKey: keys.mf, queryFn: financeApi.mutualFunds });
export const useSips = () => useQuery({ queryKey: keys.sips, queryFn: financeApi.sips });
export const usePerformance = (r: '6M' | '1Y' | '2Y') => useQuery({ queryKey: keys.perf(r), queryFn: () => financeApi.performance(r) });
export const useSavings = () => useQuery({ queryKey: keys.savings, queryFn: financeApi.savings });
export const useInsurance = () => useQuery({ queryKey: keys.insurance, queryFn: financeApi.insurance });
export const useLiabilities = () => useQuery({ queryKey: keys.liabilities, queryFn: financeApi.liabilities });
export const useMonthly = (m: string) => useQuery({ queryKey: keys.monthly(m), queryFn: () => financeApi.monthly(m) });
export const useAnnual = (y: number) => useQuery({ queryKey: keys.annual(y), queryFn: () => financeApi.annual(y) });
export const useAllocation = () => useQuery({ queryKey: keys.allocation, queryFn: financeApi.allocation });
export const useNwHistory = (r: '1Y' | '2Y') => useQuery({ queryKey: keys.nwHistory(r), queryFn: () => financeApi.netWorthHistory(r) });
export const useInstitutions = () => useQuery({ queryKey: keys.institutions, queryFn: financeApi.institutions });
export const useConsents = () => useQuery({ queryKey: keys.consents, queryFn: financeApi.consents });
export const useSessions = () => useQuery({ queryKey: keys.sessions, queryFn: authSessions });
export const useNotificationPrefs = () => useQuery({ queryKey: keys.notif, queryFn: financeApi.notificationPrefs });
export const usePrivacyPrefs = () => useQuery({ queryKey: keys.privacy, queryFn: financeApi.privacyPrefs });

import { authApi } from '@/api/endpoints';
function authSessions() {
  return authApi.sessions();
}

export const useTransactions = (p: { account_id?: string; category?: string; month?: string }) =>
  useInfiniteQuery({
    queryKey: keys.transactions(p),
    queryFn: ({ pageParam }) => financeApi.transactions({ ...p, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.next_page ?? undefined,
  });
