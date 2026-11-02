import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F5',
  border: '#E2E6EC',
  text: '#0E1726',
  textMuted: '#5B6678',
  textFaint: '#8A94A6',
  primary: '#2558D9',
  primaryText: '#FFFFFF',
  primarySoft: '#E7EEFD',
  positive: '#0B7A55',
  negative: '#C2312B',
  warning: '#A35F00',
  warningSoft: '#FFF4E0',
  demo: '#7A3FF2',
  demoSoft: '#F1EAFE',
  chart: ['#2558D9', '#0E9F77', '#E08A00', '#8C54E8', '#D9467A', '#2F9FB8', '#7A8599'],
};

const dark: typeof light = {
  bg: '#0B1220',
  surface: '#121B2D',
  surfaceAlt: '#18233A',
  border: '#24304A',
  text: '#E8ECF3',
  textMuted: '#A4AEC2',
  textFaint: '#76819A',
  primary: '#6E97FF',
  primaryText: '#0B1220',
  primarySoft: '#1A2747',
  positive: '#3CCB98',
  negative: '#FF7A72',
  warning: '#F5B04C',
  warningSoft: '#2D2410',
  demo: '#B593FF',
  demoSoft: '#241B3D',
  chart: ['#6E97FF', '#3CCB98', '#F5B04C', '#B593FF', '#FF7EA8', '#5CC8E0', '#9AA4B8'],
};

export type Colors = typeof light;
export type ThemePref = 'system' | 'light' | 'dark';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const type = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  num: { fontVariant: ['tabular-nums' as const] },
};

type Ctx = { colors: Colors; isDark: boolean; pref: ThemePref; setPref: (p: ThemePref) => void };
const ThemeCtx = createContext<Ctx | null>(null);
const KEY = 'pf360.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setPrefState(v as ThemePref)).catch(() => undefined);
  }, []);
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const value = useMemo<Ctx>(() => ({
    colors: isDark ? dark : light,
    isDark,
    pref,
    setPref: (p) => {
      setPrefState(p);
      AsyncStorage.setItem(KEY, p).catch(() => undefined);
    },
  }), [isDark, pref]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error('ThemeProvider missing');
  return c;
}
