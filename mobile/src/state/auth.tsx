import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ApiError, apiSession, baseUrl, refreshSession } from '@/api/client';
import { authApi } from '@/api/endpoints';
import type { TokenPair } from '@/api/types';
import { config } from '@/config';
import { promptBiometric } from '@/lib/deviceSecurity';
import { log } from '@/lib/log';
import { secureStorage } from '@/lib/secureStorage';
import { vault } from '@/local/db';
import { localHandler } from '@/local/handler';
import { cancelAllReminders } from '@/services/notifications';
import { wipeLocalCache } from './queryClient';

/**
 * Two ways to run:
 *  - 'local'  (default): no server. Data lives in an encrypted vault on the phone; a 6-digit
 *             passcode and optional biometrics unlock it.
 *  - 'server': signs in to a Personal Finance 360 backend (password + TOTP MFA, rotating tokens).
 */
export type AppMode = 'local' | 'server';
export type AuthStatus = 'booting' | 'signedOut' | 'locked' | 'signedIn';

type Ctx = {
  status: AuthStatus;
  mode: AppMode;
  isDemo: boolean;
  offline: boolean;
  expiredReason: string | null;
  biometricEnabled: boolean;
  serverAvailable: boolean;
  setMode: (m: AppMode) => Promise<void>;
  completeSignIn: (t: TokenPair) => Promise<void>;
  createLocal: (name: string, passcode: string) => Promise<void>;
  unlockWithPasscode: (passcode: string) => Promise<{ ok: boolean; waitSec: number }>;
  unlock: () => Promise<boolean>;
  signOut: (reason?: string) => Promise<void>;
  eraseDevice: () => Promise<void>;
  setBiometricEnabled: (v: boolean) => Promise<void>;
  setDemoFlag: (v: boolean) => void;
};

const AuthCtx = createContext<Ctx | null>(null);
const IDLE_SIGNOUT_MS = 30 * 60_000;

export function deviceName(): string {
  return `${Device.manufacturer ?? 'Android'} ${Device.modelName ?? ''} · ${Application.applicationId ?? ''}`.trim();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [mode, setModeState] = useState<AppMode>('local');
  const [isDemo, setIsDemo] = useState(false);
  const [offline, setOffline] = useState(false);
  const [expiredReason, setExpiredReason] = useState<string | null>(null);
  const [biometricEnabled, setBio] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(!!config.apiBaseUrl);
  const backgroundedAt = useRef<number | null>(null);

  const openLocal = useCallback(async () => {
    await vault.open();
    apiSession.setDemoHandler(localHandler);
    setStatus('signedIn');
  }, []);

  /** Server: ends the session. Local: locks the vault (data stays on the device). */
  const signOut = useCallback(async (reason?: string) => {
    if (mode === 'server') {
      const rt = await secureStorage.getRefreshToken();
      if (rt) authApi.logout(rt).catch(() => undefined);
      await secureStorage.clearSession();
      await cancelAllReminders();
    }
    apiSession.clear();
    apiSession.setDemoHandler(null);
    vault.close();
    await wipeLocalCache();
    setExpiredReason(reason ?? null);
    setStatus(mode === 'local' && (await vault.exists()) ? 'locked' : 'signedOut');
  }, [mode]);

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    apiSession.onExpired((reason) => {
      log.debug('session expired', reason);
      void signOut(reason === 'refresh_token_reused' ? 'Your session was ended for security. Please sign in again.' : 'Your session expired. Please sign in again.');
    });
    (async () => {
      setBio(await secureStorage.getBiometricEnabled());
      if (config.demoModeAvailable) apiSession.setBaseOverride(await secureStorage.getApiOverride());
      setServerAvailable(!!baseUrl());
      const hasVault = await vault.exists();
      const stored = await secureStorage.getMode();
      const m: AppMode = stored ?? (hasVault || !baseUrl() ? 'local' : 'local');
      setModeState(m);
      if (m === 'local') return setStatus(hasVault ? 'locked' : 'signedOut');

      const rt = await secureStorage.getRefreshToken();
      if (!rt) return setStatus('signedOut');
      if (await secureStorage.getBiometricEnabled()) return setStatus('locked');
      try {
        await refreshSession();
        setStatus('signedIn');
      } catch (e) {
        if (e instanceof ApiError && e.isNetwork) {
          setOffline(true);
          setStatus('signedIn');
        } else setStatus('signedOut');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- auto-lock
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundedAt.current = Date.now();
      if (s === 'active' && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (status !== 'signedIn') return;
        if (mode === 'local' && away > config.autoLockMs) {
          void signOut();
        } else if (mode === 'server' && biometricEnabled && away > config.autoLockMs) {
          apiSession.clear();
          setStatus('locked');
        } else if (mode === 'server' && !biometricEnabled && away > IDLE_SIGNOUT_MS) {
          void signOut('Signed out after 30 minutes of inactivity.');
        }
      }
    });
    return () => sub.remove();
  }, [status, mode, biometricEnabled, signOut]);

  const value = useMemo<Ctx>(() => ({
    status, mode, isDemo, offline, expiredReason, biometricEnabled, serverAvailable,
    async setMode(m) {
      await secureStorage.setMode(m);
      setModeState(m);
      setStatus(m === 'local' && (await vault.exists()) ? 'locked' : 'signedOut');
    },
    async completeSignIn(t) {
      await secureStorage.setMode('server');
      setModeState('server');
      await secureStorage.setRefreshToken(t.refresh_token);
      await secureStorage.setSessionId(t.session_id);
      apiSession.setTokens(t);
      setExpiredReason(null);
      setOffline(false);
      setStatus('signedIn');
    },
    async createLocal(name, passcode) {
      await vault.create(name, passcode);
      await secureStorage.setMode('local');
      setModeState('local');
      await openLocal();
    },
    async unlockWithPasscode(passcode) {
      const ok = await vault.checkPasscode(passcode);
      if (ok) await openLocal();
      return { ok, waitSec: ok ? 0 : (await vault.lockoutState()).waitSec };
    },
    async unlock() {
      const ok = await promptBiometric('Unlock Personal Finance 360');
      if (!ok) return false;
      if (mode === 'local') {
        await openLocal();
        return true;
      }
      try {
        await refreshSession();
        setOffline(false);
      } catch (e) {
        if (e instanceof ApiError && e.isNetwork) setOffline(true);
        else return false;
      }
      setStatus('signedIn');
      return true;
    },
    signOut,
    async eraseDevice() {
      apiSession.setDemoHandler(null);
      await vault.erase();
      await secureStorage.clearSession();
      await secureStorage.setBiometricEnabled(false);
      await secureStorage.setMode(null);
      await wipeLocalCache();
      await cancelAllReminders();
      setBio(false);
      setIsDemo(false);
      setStatus('signedOut');
    },
    async setBiometricEnabled(v) {
      if (v && !(await promptBiometric('Confirm to enable biometric unlock'))) return;
      await secureStorage.setBiometricEnabled(v);
      setBio(v);
    },
    setDemoFlag: setIsDemo,
  }), [status, mode, isDemo, offline, expiredReason, biometricEnabled, serverAvailable, signOut, openLocal]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
}
