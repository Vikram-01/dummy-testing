
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { T } from './primitives';

/** Vigil mark: a shield with a radar sweep — watchfulness over the threat landscape. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Vigil logo">
      <Defs>
        <LinearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2DD4BF" />
          <Stop offset="1" stopColor="#0E7490" />
        </LinearGradient>
      </Defs>
      <Path d="M32 4 L54 12 V30 C54 44 44.5 54.5 32 60 C19.5 54.5 10 44 10 30 V12 Z" fill="url(#vg)" />
      <Circle cx="32" cy="31" r="14" fill="none" stroke="#04201C" strokeWidth="2.5" strokeOpacity={0.55} />
      <Circle cx="32" cy="31" r="7" fill="none" stroke="#04201C" strokeWidth="2.5" strokeOpacity={0.55} />
      <Path d="M32 31 L43.5 22.5 A14 14 0 0 1 46 31 Z" fill="#04201C" fillOpacity={0.75} />
      <Circle cx="32" cy="31" r="2.6" fill="#04201C" />
    </Svg>
  );
}

export function Wordmark() {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark size={34} />
      <View>
        <T variant="h2" style={{ letterSpacing: 1.5 }}>VIGIL</T>
        <T variant="tiny" color={c.textMuted}>Security intelligence</T>
      </View>
    </View>
  );
}
