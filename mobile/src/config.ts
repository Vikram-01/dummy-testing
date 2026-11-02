import Constants from 'expo-constants';

type Extra = { variant: 'debug' | 'release'; apiBaseUrl: string; demoModeAvailable: boolean };
const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const config = {
  variant: extra.variant ?? 'release',
  /** Baked in at build time from EXPO_PUBLIC_API_BASE_URL. Must be https. */
  apiBaseUrl: (extra.apiBaseUrl ?? '').replace(/\/+$/, ''),
  /** Offline demo mode exists only in the debug APK. The release APK cannot enter it. */
  demoModeAvailable: extra.demoModeAvailable === true,
  requestTimeoutMs: 15_000,
  /** Lock the app after this long in the background. */
  autoLockMs: 2 * 60_000,
  /** Cached dashboard is shown offline for at most this long. */
  offlineCacheMaxAgeMs: 7 * 24 * 60 * 60_000,
  apiPrefix: '/api/v1',
};

export const isDebugVariant = config.variant === 'debug';
