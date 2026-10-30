import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { Severity } from '../lib/repo/types';

export interface Palette {
  mode: 'dark' | 'light';
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  warn: string;
  ok: string;
  sev: Record<Severity, string>;
  sevSoft: Record<Severity, string>;
}

const sevDark: Record<Severity, string> = { CRITICAL: '#FF5C6C', HIGH: '#FF8A3D', MEDIUM: '#F2C94C', LOW: '#4EA8FF', NONE: '#8C97A8', UNKNOWN: '#6C7686' };
const sevLight: Record<Severity, string> = { CRITICAL: '#D1293D', HIGH: '#D9620F', MEDIUM: '#A77B00', LOW: '#1F6FD1', NONE: '#5E6878', UNKNOWN: '#6C7686' };
const soft = (m: Record<Severity, string>, a: string) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v + a])) as Record<Severity, string>;

export const DARK: Palette = {
  mode: 'dark',
  bg: '#0A0E14',
  surface: '#111720',
  surfaceAlt: '#18202B',
  border: '#232D3A',
  text: '#E6EBF2',
  textMuted: '#9AA6B6',
  textFaint: '#667386',
  accent: '#2DD4BF',
  accentSoft: '#2DD4BF22',
  onAccent: '#04201C',
  danger: '#FF5C6C',
  warn: '#F2C94C',
  ok: '#3DD68C',
  sev: sevDark,
  sevSoft: soft(sevDark, '22'),
};

export const LIGHT: Palette = {
  mode: 'light',
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F5',
  border: '#DDE3EA',
  text: '#121821',
  textMuted: '#4F5B6B',
  textFaint: '#7D8898',
  accent: '#0F8F80',
  accentSoft: '#0F8F8018',
  onAccent: '#FFFFFF',
  danger: '#D1293D',
  warn: '#A77B00',
  ok: '#1E8E57',
  sev: sevLight,
  sevSoft: soft(sevLight, '1A'),
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 6, md: 10, lg: 14 };
export const font = {
  mono: 'monospace',
  h1: 22,
  h2: 18,
  h3: 15,
  body: 14,
  small: 12,
  tiny: 11,
};

const ThemeCtx = createContext<Palette>(DARK);

export function ThemeProvider({ preference, children }: { preference: 'dark' | 'light' | 'system'; children: React.ReactNode }) {
  const system = useColorScheme();
  const palette = useMemo(() => {
    const mode = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
    return mode === 'light' ? LIGHT : DARK;
  }, [preference, system]);
  return <ThemeCtx.Provider value={palette}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
