import { createContext, useContext, useMemo } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';
import type { Severity } from '../lib/repo/types';

/**
 * Material Design 3 theme for SecOpsDaily.
 *
 * Color roles are generated with Google's material-color-utilities
 * (SchemeVibrant, seed #3D5AFE — the logo blue); see brand/m3-scheme.ts.
 * Typography is the M3 type scale set in Outfit; shapes follow the M3 shape
 * scale. Legacy aliases (bg, surface, text, accent, ...) map onto M3 roles so
 * every screen picks up the new system.
 */
interface M3Roles {
  primary: string; onPrimary: string; primaryContainer: string; onPrimaryContainer: string;
  secondary: string; onSecondary: string; secondaryContainer: string; onSecondaryContainer: string;
  tertiary: string; onTertiary: string; tertiaryContainer: string; onTertiaryContainer: string;
  error: string; onError: string; errorContainer: string; onErrorContainer: string;
  surface: string; onSurface: string; onSurfaceVariant: string;
  surfaceContainerLowest: string; surfaceContainerLow: string; surfaceContainer: string; surfaceContainerHigh: string; surfaceContainerHighest: string;
  outline: string; outlineVariant: string; inverseSurface: string; inverseOnSurface: string; inversePrimary: string; scrim: string;
}

const M3_DARK: M3Roles = {
  primary: '#BBC3FF', onPrimary: '#001D93', primaryContainer: '#002CCD', onPrimaryContainer: '#DEE0FF',
  secondary: '#CAC1EA', onSecondary: '#322C4C', secondaryContainer: '#484264', onSecondaryContainer: '#E6DEFF',
  tertiary: '#D7BBF3', onTertiary: '#3C2653', tertiaryContainer: '#533D6B', onTertiaryContainer: '#EFDBFF',
  error: '#FFB4AB', onError: '#690005', errorContainer: '#93000A', onErrorContainer: '#FFDAD6',
  surface: '#11131C', onSurface: '#E2E1EF', onSurfaceVariant: '#C5C5D6',
  surfaceContainerLowest: '#0C0E17', surfaceContainerLow: '#1A1B25', surfaceContainer: '#1E1F29', surfaceContainerHigh: '#282934', surfaceContainerHighest: '#33343F',
  outline: '#8F8F9F', outlineVariant: '#444654', inverseSurface: '#E2E1EF', inverseOnSurface: '#2F303A', inversePrimary: '#1842FF', scrim: '#000000',
};

const M3_LIGHT: M3Roles = {
  primary: '#1842FF', onPrimary: '#FFFFFF', primaryContainer: '#DEE0FF', onPrimaryContainer: '#002CCD',
  secondary: '#605A7D', onSecondary: '#FFFFFF', secondaryContainer: '#E6DEFF', onSecondaryContainer: '#484264',
  tertiary: '#6C5485', onTertiary: '#FFFFFF', tertiaryContainer: '#EFDBFF', onTertiaryContainer: '#533D6B',
  error: '#BA1A1A', onError: '#FFFFFF', errorContainer: '#FFDAD6', onErrorContainer: '#93000A',
  surface: '#FBF8FF', onSurface: '#1A1B25', onSurfaceVariant: '#444654',
  surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#F4F2FF', surfaceContainer: '#EEECFB', surfaceContainerHigh: '#E8E7F5', surfaceContainerHighest: '#E2E1EF',
  outline: '#757685', outlineVariant: '#C5C5D6', inverseSurface: '#2F303A', inverseOnSurface: '#F1EFFE', inversePrimary: '#BBC3FF', scrim: '#000000',
};

/** Severity uses M3 tonal pairs: accent (tone 80 dark / 40 light), container (30 / 90) and on-container (90 / 10). */
const SEV_DARK = {
  sev: { CRITICAL: '#FFB4AB', HIGH: '#FFB68E', MEDIUM: '#F2C14E', LOW: '#9ECAFF', NONE: '#C5C5D6', UNKNOWN: '#8F8F9F' },
  sevSoft: { CRITICAL: '#93000A', HIGH: '#7A3100', MEDIUM: '#5B4300', LOW: '#00497D', NONE: '#33343F', UNKNOWN: '#282934' },
  sevOn: { CRITICAL: '#FFDAD6', HIGH: '#FFDBCB', MEDIUM: '#FFDF99', LOW: '#D1E4FF', NONE: '#E2E1EF', UNKNOWN: '#C5C5D6' },
};
const SEV_LIGHT = {
  sev: { CRITICAL: '#BA1A1A', HIGH: '#A04100', MEDIUM: '#795900', LOW: '#00639F', NONE: '#5E5F6E', UNKNOWN: '#757685' },
  sevSoft: { CRITICAL: '#FFDAD6', HIGH: '#FFDBCB', MEDIUM: '#FFDF99', LOW: '#D1E4FF', NONE: '#E2E1EF', UNKNOWN: '#E8E7F5' },
  sevOn: { CRITICAL: '#410002', HIGH: '#341000', MEDIUM: '#261A00', LOW: '#001D35', NONE: '#1A1B25', UNKNOWN: '#444654' },
};

export interface Palette extends M3Roles {
  mode: 'dark' | 'light';
  // Legacy aliases used across screens
  bg: string;
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
  card: string;
  sev: Record<Severity, string>;
  sevSoft: Record<Severity, string>;
  sevOn: Record<Severity, string>;
}

function build(mode: 'dark' | 'light'): Palette {
  const m = mode === 'dark' ? M3_DARK : M3_LIGHT;
  const s = mode === 'dark' ? SEV_DARK : SEV_LIGHT;
  return {
    ...m,
    mode,
    bg: m.surface,
    card: m.surfaceContainerLow,
    surfaceAlt: m.surfaceContainerHigh,
    border: m.outlineVariant,
    text: m.onSurface,
    textMuted: m.onSurfaceVariant,
    textFaint: m.outline,
    accent: m.primary,
    accentSoft: m.secondaryContainer,
    onAccent: m.onPrimary,
    danger: m.error,
    warn: mode === 'dark' ? '#F2C14E' : '#795900',
    ok: mode === 'dark' ? '#7BDA9C' : '#006D3B',
    // Spread the M3 surface role last so `surface` stays the page color, while
    // components needing a raised surface use `card` / surfaceContainer*.
    surface: m.surface,
    ...s,
  } as Palette;
}

export const DARK = build('dark');
export const LIGHT = build('light');

/** M3 spacing grid (4dp) and shape scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 28, full: 999 };

/** Outfit font families embedded by the expo-font config plugin (file names). */
export const fonts = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  mono: 'monospace',
};

export function familyFor(weight: TextStyle['fontWeight']): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : weight);
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

/** Material 3 type scale, set in Outfit. */
export const type = {
  displaySmall: { fontFamily: fonts.regular, fontSize: 36, lineHeight: 44 },
  headlineMedium: { fontFamily: fonts.regular, fontSize: 28, lineHeight: 36 },
  headlineSmall: { fontFamily: fonts.medium, fontSize: 24, lineHeight: 32 },
  titleLarge: { fontFamily: fonts.medium, fontSize: 22, lineHeight: 28 },
  titleMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, letterSpacing: 0.15 },
  titleSmall: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, letterSpacing: 0.25 },
  bodyMedium: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, letterSpacing: 0.25 },
  bodySmall: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  labelLarge: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  labelMedium: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  labelSmall: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, letterSpacing: 0.5 },
} satisfies Record<string, TextStyle>;

/** Legacy size tokens (kept for inputs). */
export const font = { mono: fonts.mono, h1: 24, h2: 22, h3: 16, body: 14, small: 12, tiny: 11 };

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
