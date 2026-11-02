import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { config } from '@/config';

onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(!!s.isConnected)));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: config.offlineCacheMaxAgeMs,
      networkMode: 'offlineFirst',
      retry: (count, err) => !(err instanceof ApiError && (err.isAuth || err.status === 404 || err.status === 422)) && count < 2,
    },
    mutations: { retry: 0 },
  },
});

/**
 * Offline cache. Only queries flagged meta.persist (dashboard summary, account list) are written to
 * disk, so the dashboard can be viewed read-only offline. No credentials, tokens, PAN or transaction
 * descriptions are persisted. The cache is wiped on sign-out.
 */
export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'pf360.cache.v1', throttleTime: 2000 });

export const persistOptions = {
  persister,
  maxAge: config.offlineCacheMaxAgeMs,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { meta?: Record<string, unknown>; state: { status: string } }) => q.meta?.persist === true && q.state.status === 'success',
  },
};

export async function wipeLocalCache() {
  queryClient.clear();
  await persister.removeClient();
}

export const keys = {
  dashboard: ['dashboard'] as const,
  me: ['me'] as const,
  bankAccounts: ['banks', 'accounts'] as const,
  transactions: (p: object) => ['banks', 'transactions', p] as const,
  categories: (m: string) => ['banks', 'categories', m] as const,
  demat: ['inv', 'demat'] as const,
  mf: ['inv', 'mf'] as const,
  sips: ['inv', 'sips'] as const,
  perf: (r: string) => ['inv', 'perf', r] as const,
  savings: ['savings'] as const,
  insurance: ['insurance'] as const,
  liabilities: ['liabilities'] as const,
  monthly: (m: string) => ['reports', 'monthly', m] as const,
  annual: (y: number) => ['reports', 'annual', y] as const,
  allocation: ['reports', 'allocation'] as const,
  nwHistory: (r: string) => ['reports', 'nw', r] as const,
  institutions: ['institutions'] as const,
  consents: ['consents'] as const,
  sync: ['sync'] as const,
  sessions: ['sessions'] as const,
  notif: ['settings', 'notif'] as const,
  privacy: ['settings', 'privacy'] as const,
};
