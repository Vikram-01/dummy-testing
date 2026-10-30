import { CircleAlert, Inbox, RefreshCw, type LucideIcon } from 'lucide-react-native';

import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import { font, radius, space, useTheme } from '../theme';

export function T({ variant = 'body', color, style, ...p }: TextProps & { variant?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny' | 'mono' | 'label'; color?: string }) {
  const c = useTheme();
  const base: Record<string, object> = {
    h1: { fontSize: font.h1, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
    h2: { fontSize: font.h2, fontWeight: '700', color: c.text },
    h3: { fontSize: font.h3, fontWeight: '600', color: c.text, lineHeight: 21 },
    body: { fontSize: font.body, color: c.text, lineHeight: 20 },
    small: { fontSize: font.small, color: c.textMuted, lineHeight: 17 },
    tiny: { fontSize: font.tiny, color: c.textFaint },
    mono: { fontSize: font.small, color: c.text, fontFamily: font.mono },
    label: { fontSize: font.tiny, color: c.textFaint, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  };
  return <Text {...p} style={[base[variant], color ? { color } : null, style]} />;
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const c = useTheme();
  const s = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [s, pressed && { backgroundColor: c.surfaceAlt }]}>
      {children}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color, icon: Icon }: { label: string; active?: boolean; onPress?: () => void; color?: string; icon?: LucideIcon }) {
  const c = useTheme();
  const tint = color ?? c.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, { borderColor: active ? tint : c.border, backgroundColor: active ? tint + '22' : c.surface }]}
    >
      {Icon ? <Icon size={13} color={active ? tint : c.textMuted} /> : null}
      <Text style={{ color: active ? tint : c.textMuted, fontSize: font.small, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Button({ label, onPress, icon: Icon, kind = 'primary', disabled, loading }: { label: string; onPress: () => void; icon?: LucideIcon; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; loading?: boolean }) {
  const c = useTheme();
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? c.danger + '1F' : c.surfaceAlt;
  const fg = kind === 'primary' ? c.onAccent : kind === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderColor: kind === 'secondary' ? c.border : 'transparent' }]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : Icon ? <Icon size={16} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: font.body }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon: Icon, onPress, label, color, size = 20 }: { icon: LucideIcon; onPress: () => void; label: string; color?: string; size?: number }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10} style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: c.surfaceAlt }]}>
      <Icon size={size} color={color ?? c.textMuted} />
    </Pressable>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  const c = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.accent} />
      <T variant="small" style={{ marginTop: space.sm }}>{label}</T>
    </View>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, body, action }: { icon?: LucideIcon; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  const c = useTheme();
  return (
    <View style={[styles.center, { paddingVertical: 48 }]}>
      <View style={[styles.emptyIcon, { backgroundColor: c.surfaceAlt }]}>
        <Icon size={26} color={c.textFaint} />
      </View>
      <T variant="h3" style={{ marginTop: space.md, textAlign: 'center' }}>{title}</T>
      {body ? <T variant="small" style={{ textAlign: 'center', marginTop: space.xs, maxWidth: 300 }}>{body}</T> : null}
      {action ? <View style={{ marginTop: space.lg }}><Button label={action.label} onPress={action.onPress} icon={RefreshCw} /></View> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: c.danger + '18', borderColor: c.danger + '55' }]} accessibilityRole="alert">
      <CircleAlert size={16} color={c.danger} />
      <T variant="small" color={c.text} style={{ flex: 1 }}>{message}</T>
      {onRetry ? <Pressable onPress={onRetry} hitSlop={8}><T variant="small" color={c.danger} style={{ fontWeight: '700' }}>Retry</T></Pressable> : null}
    </View>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <T variant="label">{title}</T>
      {right}
    </View>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: space.md }} />;
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 11, borderWidth: 1 },
  iconBtn: { padding: 8, borderRadius: 999 },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm },
});
