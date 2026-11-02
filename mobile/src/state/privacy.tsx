import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'pf360.hide_on_launch';
type Ctx = { hidden: boolean; toggle: () => void; hideOnLaunch: boolean; setHideOnLaunch: (v: boolean) => void };
const PrivacyCtx = createContext<Ctx>({ hidden: false, toggle: () => undefined, hideOnLaunch: false, setHideOnLaunch: () => undefined });

/** Lets the user mask every amount in the UI (e.g. in public). */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [hideOnLaunch, setHol] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === '1') {
        setHol(true);
        setHidden(true);
      }
    }).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({
    hidden,
    toggle: () => setHidden((h) => !h),
    hideOnLaunch,
    setHideOnLaunch: (v: boolean) => {
      setHol(v);
      AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => undefined);
    },
  }), [hidden, hideOnLaunch]);
  return <PrivacyCtx.Provider value={value}>{children}</PrivacyCtx.Provider>;
}

export const usePrivacy = () => useContext(PrivacyCtx);
