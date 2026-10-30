import * as SecureStore from 'expo-secure-store';

/**
 * API credentials live only in the Android Keystore-backed SecureStore.
 * They are never bundled into the app, written to SQLite, or logged.
 */
export type SecretKey = 'nvdApiKey' | 'githubToken';

const KEY_PREFIX = 'vigil.secret.';
const VALID: Record<SecretKey, RegExp> = {
  nvdApiKey: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  githubToken: /^(gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255})$/,
};

export function validateSecret(key: SecretKey, value: string): boolean {
  return VALID[key].test(value.trim());
}

export async function getSecret(key: SecretKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_PREFIX + key);
  } catch {
    return null;
  }
}

export async function setSecret(key: SecretKey, value: string | null): Promise<void> {
  if (!value) {
    await SecureStore.deleteItemAsync(KEY_PREFIX + key);
    return;
  }
  const v = value.trim();
  if (!validateSecret(key, v)) throw new Error(key === 'nvdApiKey' ? 'That does not look like an NVD API key (UUID format).' : 'That does not look like a GitHub token.');
  await SecureStore.setItemAsync(KEY_PREFIX + key, v, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export function mask(v: string | null): string {
  if (!v) return 'Not set';
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}
