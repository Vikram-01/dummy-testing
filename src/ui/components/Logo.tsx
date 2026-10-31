import { Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Polyline, Rect, Stop } from 'react-native-svg';
import { fonts, useTheme } from '../theme';

/**
 * SecOpsDaily mark: a security shield carrying a live pulse, with an amber
 * "daily alert" badge. Same geometry as brand/logo.py (512-unit grid).
 */
const SH = 'M256 92 L392 140 V250 C392 342 334 404 256 436 C178 404 120 342 120 250 V140 Z';
const PULSE = '92,266 188,266 214,224 244,318 276,176 304,266 432,266';

export function LogoMark({ size = 40, tile = true }: { size?: number; tile?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="SecOpsDaily logo">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1A73E8" />
          <Stop offset="1" stopColor="#5B3DF5" />
        </LinearGradient>
        <LinearGradient id="ink" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#1A73E8" />
          <Stop offset="1" stopColor="#5B3DF5" />
        </LinearGradient>
        <LinearGradient id="face" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E8EEFF" />
        </LinearGradient>
        <ClipPath id="sh">
          <Path d={SH} />
        </ClipPath>
      </Defs>
      {tile ? <Rect width="512" height="512" rx="128" fill="url(#bg)" /> : null}
      <G transform={tile ? 'translate(46 40) scale(0.82)' : undefined}>
        <Path d={SH} fill="url(#face)" />
        <G clipPath="url(#sh)">
          <Polyline points={PULSE} fill="none" stroke="url(#ink)" strokeWidth={28} strokeLinejoin="round" strokeLinecap="round" />
        </G>
        <Circle cx="380" cy="138" r="46" fill="#FFFFFF" />
        <Circle cx="380" cy="138" r="30" fill="#FFB300" />
      </G>
    </Svg>
  );
}

/** "SecOps" in Outfit Bold + "Daily" in Outfit Regular, primary color. */
export function Wordmark({ size = 22, subtitle }: { size?: number; subtitle?: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <LogoMark size={size * 1.9} />
      <View>
        <Text style={{ fontSize: size, lineHeight: size * 1.25 }}>
          <Text style={{ fontFamily: fonts.bold, color: c.onSurface }}>SecOps</Text>
          <Text style={{ fontFamily: fonts.regular, color: c.primary }}>Daily</Text>
        </Text>
        {subtitle ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: c.onSurfaceVariant, letterSpacing: 0.4 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
