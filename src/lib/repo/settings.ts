import type { Db } from '../db/types';

export interface AppSettings {
  syncIntervalMinutes: number; // background interval (Android minimum 15)
  retentionDays: number; // data older than this is purged after each sync
  theme: 'dark' | 'light' | 'system';
  kevNotifications: boolean;
  wifiOnly: boolean;
  enabledSources: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  syncIntervalMinutes: 60,
  retentionDays: 5,
  theme: 'dark',
  kevNotifications: true,
  wifiOnly: false,
  enabledSources: {},
};

export const LIMITS = {
  syncIntervalMinutes: { min: 15, max: 24 * 60 },
  retentionDays: { min: 1, max: 90 },
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

export function normalizeSettings(raw: Partial<AppSettings>): AppSettings {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  return {
    ...s,
    syncIntervalMinutes: clamp(Number(s.syncIntervalMinutes) || 60, LIMITS.syncIntervalMinutes.min, LIMITS.syncIntervalMinutes.max),
    retentionDays: clamp(Number(s.retentionDays) || 5, LIMITS.retentionDays.min, LIMITS.retentionDays.max),
    theme: ['dark', 'light', 'system'].includes(s.theme) ? s.theme : 'dark',
    enabledSources: typeof s.enabledSources === 'object' && s.enabledSources ? s.enabledSources : {},
  };
}

export async function getSettings(db: Db): Promise<AppSettings> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings WHERE key LIKE ?', ['app.%']);
  const raw: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      raw[r.key.slice(4)] = JSON.parse(r.value);
    } catch {
      /* ignore corrupt value; default applies */
    }
  }
  return normalizeSettings(raw as Partial<AppSettings>);
}

export async function saveSettings(db: Db, patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = normalizeSettings({ ...(await getSettings(db)), ...patch });
  await db.transaction(async () => {
    for (const [k, v] of Object.entries(next)) {
      await db.run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [`app.${k}`, JSON.stringify(v)]);
    }
  });
  return next;
}

export async function getMeta(db: Db, key: string): Promise<string | null> {
  const r = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [`meta.${key}`]);
  return r?.value ?? null;
}

export async function setMeta(db: Db, key: string, value: string | null): Promise<void> {
  if (value === null) await db.run('DELETE FROM settings WHERE key = ?', [`meta.${key}`]);
  else await db.run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [`meta.${key}`, value]);
}
