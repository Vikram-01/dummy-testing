import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { decryptJson, encryptJson, hashPasscode, newKeyHex, randomBytes, verifyPasscode } from './crypto';
import type { CollectionKey } from './schema';

/**
 * On-device vault. All financial data is one JSON document encrypted with AES-256-GCM.
 * The 256-bit data key lives in expo-secure-store (encrypted by an Android Keystore key,
 * never leaves the device, excluded from backups). The vault file sits in app-private storage.
 */
export type Row = Record<string, any> & { id: string; demo?: boolean };
export type Snapshot = { month: string; net_worth: number; assets: number; liabilities: number; invested: number; inv_value: number };

export type LocalDB = {
  version: 1;
  profile: { full_name: string; email?: string; phone?: string; pan_last5?: string; created_at: string };
  collections: Record<CollectionKey, Row[]>;
  snapshots: Snapshot[];
  settings: { notif: Record<string, boolean>; privacy: Record<string, boolean> };
  last_saved_at: string | null;
};

const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const KEY_NAME = 'pf360.vault_key';
const PASS_NAME = 'pf360.passcode';
const FAIL_NAME = 'pf360.passcode_fails';
const vaultFile = () => new File(Paths.document, 'pf360.vault');

export const emptyCollections = (): Record<CollectionKey, Row[]> => ({
  bank_accounts: [], transactions: [], stocks: [], mutual_funds: [], sips: [], deposits: [], retirement: [], insurance: [], loans: [], cards: [],
});

let db: LocalDB | null = null;
let keyHex: string | null = null;
let saveChain: Promise<void> = Promise.resolve();

export const vault = {
  async exists(): Promise<boolean> {
    return vaultFile().exists && !!(await SecureStore.getItemAsync(PASS_NAME, OPTS).catch(() => null));
  },

  async create(fullName: string, passcode: string) {
    keyHex = newKeyHex();
    await SecureStore.setItemAsync(KEY_NAME, keyHex, OPTS);
    await SecureStore.setItemAsync(PASS_NAME, await hashPasscode(passcode), OPTS);
    db = {
      version: 1,
      profile: { full_name: fullName.trim(), created_at: new Date().toISOString() },
      collections: emptyCollections(),
      snapshots: [],
      settings: {
        notif: { policy_renewals: true, emi_due: true, card_due: true, sync_failures: false, maturity_alerts: true, weekly_summary: false },
        privacy: { hide_balances_on_launch: false, analytics_opt_in: false, crash_reports_opt_in: false },
      },
      last_saved_at: null,
    };
    await vault.save();
  },

  /** Attempts left before a cooldown, and seconds to wait if locked out. */
  async lockoutState(): Promise<{ fails: number; waitSec: number }> {
    const raw = await SecureStore.getItemAsync(FAIL_NAME, OPTS).catch(() => null);
    const { fails, at } = raw ? JSON.parse(raw) : { fails: 0, at: 0 };
    const wait = fails >= 5 ? Math.min(3600, 30 * 2 ** (fails - 5)) : 0;
    return { fails, waitSec: Math.max(0, Math.ceil((at + wait * 1000 - Date.now()) / 1000)) };
  },

  async checkPasscode(passcode: string): Promise<boolean> {
    const stored = await SecureStore.getItemAsync(PASS_NAME, OPTS);
    if (!stored) return false;
    const { fails, waitSec } = await vault.lockoutState();
    if (waitSec > 0) return false;
    const ok = await verifyPasscode(passcode, stored);
    await SecureStore.setItemAsync(FAIL_NAME, JSON.stringify({ fails: ok ? 0 : fails + 1, at: Date.now() }), OPTS);
    return ok;
  },

  async changePasscode(next: string) {
    await SecureStore.setItemAsync(PASS_NAME, await hashPasscode(next), OPTS);
  },

  /** Decrypts the vault into memory. Called after passcode or biometric success. */
  async open() {
    keyHex = await SecureStore.getItemAsync(KEY_NAME, OPTS);
    if (!keyHex) throw new Error('Encryption key missing. The vault cannot be opened on this device.');
    const blob = await vaultFile().text();
    db = decryptJson<LocalDB>(keyHex, blob);
    db.collections = { ...emptyCollections(), ...db.collections };
  },

  close() {
    db = null;
    keyHex = null;
  },

  isOpen: () => db != null,

  get(): LocalDB {
    if (!db) throw new Error('Vault is locked');
    return db;
  },

  save(): Promise<void> {
    saveChain = saveChain.then(async () => {
      if (!db || !keyHex) return;
      db.last_saved_at = new Date().toISOString();
      const f = vaultFile();
      if (!f.exists) f.create();
      f.write(encryptJson(keyHex, db));
    });
    return saveChain;
  },

  newId(prefix: string) {
    return prefix + '_' + Array.from(randomBytes(6), (b) => b.toString(16).padStart(2, '0')).join('');
  },

  /** Removes the vault, key and passcode. Irreversible. */
  async erase() {
    vault.close();
    const f = vaultFile();
    if (f.exists) f.delete();
    await Promise.all([KEY_NAME, PASS_NAME, FAIL_NAME].map((k) => SecureStore.deleteItemAsync(k, OPTS).catch(() => undefined)));
  },
};
