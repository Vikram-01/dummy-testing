import * as SecureStore from 'expo-secure-store';

/**
 * Android Keystore-backed storage (expo-secure-store encrypts values with a Keystore key).
 * Only session material lives here. The app never stores PAN, bank/broker passwords, OTPs,
 * UPI/ATM/trading PINs or CVV anywhere on the device.
 *
 * The access token is kept in memory only; it is never written to disk.
 */
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const KEYS = {
  refreshToken: 'pf360.refresh_token',
  sessionId: 'pf360.session_id',
  biometricEnabled: 'pf360.biometric_enabled',
  demoMode: 'pf360.demo_mode',
  mode: 'pf360.mode',
  apiOverride: 'pf360.api_override',
} as const;

async function get(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, OPTS);
  } catch {
    // Keystore can be invalidated (e.g. screen lock removed). Treat as signed out.
    await SecureStore.deleteItemAsync(key, OPTS).catch(() => undefined);
    return null;
  }
}

async function set(key: string, value: string | null) {
  if (value == null) await SecureStore.deleteItemAsync(key, OPTS);
  else await SecureStore.setItemAsync(key, value, OPTS);
}

export const secureStorage = {
  getRefreshToken: () => get(KEYS.refreshToken),
  setRefreshToken: (v: string | null) => set(KEYS.refreshToken, v),
  getSessionId: () => get(KEYS.sessionId),
  setSessionId: (v: string | null) => set(KEYS.sessionId, v),
  getBiometricEnabled: async () => (await get(KEYS.biometricEnabled)) === '1',
  setBiometricEnabled: (v: boolean) => set(KEYS.biometricEnabled, v ? '1' : null),
  getDemoMode: async () => (await get(KEYS.demoMode)) === '1',
  setDemoMode: (v: boolean) => set(KEYS.demoMode, v ? '1' : null),
  getMode: async () => (await get(KEYS.mode)) as 'local' | 'server' | null,
  setMode: (v: 'local' | 'server' | null) => set(KEYS.mode, v),
  /** Debug builds only: lets a tester point the app at a staging/tunnel URL. */
  getApiOverride: () => get(KEYS.apiOverride),
  setApiOverride: (v: string | null) => set(KEYS.apiOverride, v),
  async clearSession() {
    await Promise.all([set(KEYS.refreshToken, null), set(KEYS.sessionId, null), set(KEYS.demoMode, null)]);
  },
};
