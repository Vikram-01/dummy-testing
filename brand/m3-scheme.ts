// Run: npx tsx brand/m3-scheme.ts
// Generates Material 3 color roles from the brand seed (run at design time).
import { argbFromHex, hexFromArgb, SchemeTonalSpot, SchemeFidelity, SchemeVibrant, Hct, MaterialDynamicColors } from '@material/material-color-utilities';
const seed = Hct.fromInt(argbFromHex('#3D5AFE'));
const roles = ['primary','onPrimary','primaryContainer','onPrimaryContainer','secondary','onSecondary','secondaryContainer','onSecondaryContainer',
 'tertiary','onTertiary','tertiaryContainer','onTertiaryContainer','error','onError','errorContainer','onErrorContainer',
 'surface','onSurface','onSurfaceVariant','surfaceContainerLowest','surfaceContainerLow','surfaceContainer','surfaceContainerHigh','surfaceContainerHighest',
 'outline','outlineVariant','inverseSurface','inverseOnSurface','inversePrimary','scrim'];
const out = {};
for (const dark of [true, false]) {
  const s = new SchemeVibrant(seed, dark, 0.0);
  out[dark ? 'dark' : 'light'] = Object.fromEntries(roles.map(r => [r, hexFromArgb(MaterialDynamicColors[r].getArgb(s)).toUpperCase()]));
}
console.log(JSON.stringify(out, null, 1));
