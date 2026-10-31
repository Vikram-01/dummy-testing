import { Check, CircleAlert, Inbox, RefreshCw, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { familyFor, fonts, radius, space, type, useTheme } from '../theme';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodyLarge' | 'small' | 'tiny' | 'mono' | 'label' | 'overline';

/**
 * Text in the Material 3 type scale (Outfit). Android cannot synthesize
 * weights for embedded fonts, so any fontWeight is converted to the matching
 * Outfit family file.
 */
export function T({ variant = 'body', color, style, ...p }: TextProps & { variant?: Variant; color?: string }) {
  const c = useTheme();
  const base: Record<Variant, TextStyle> = {
    display: { ...type.headlineMedium, color: c.onSurface },
    h1: { ...type.headlineSmall, color: c.onSurface },
    h2: { ...type.titleLarge, color: c.onSurface },
    h3: { ...type.titleMedium, color: c.onSurface },
    title: { ...type.titleSmall, color: c.onSurface },
    body: { ...type.bodyMedium, color: c.onSurface },
    bodyLarge: { ...type.bodyLarge, color: c.onSurface },
    small: { ...type.bodyMedium, fontSize: 13, lineHeight: 18, color: c.onSurfaceVariant },
    tiny: { ...type.bodySmall, color: c.onSurfaceVariant },
    mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, color: c.onSurface },
    label: { ...type.titleSmall, color: c.primary },
    overline: { ...type.labelMedium, color: c.onSurfaceVariant },
  };
  const flat: TextStyle = { ...(StyleSheet.flatten([base[variant], color ? { color } : null, style]) as TextStyle) };
  if (flat.fontWeight != null && variant !== 'mono') {
    const { fontWeight, ...rest } = flat;
    return <Text {...p} style={{ ...rest, fontFamily: familyFor(fontWeight) }} />;
  }
  return <Text {...p} style={flat} />;
}

/** M3 card: filled ("filled") on surfaceContainerHighest, default tonal on surfaceContainerLow, or outlined. */
export function Card({
  children, style, onPress, accessibilityLabel, kind = 'tonal',
}: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; kind?: 'tonal' | 'filled' | 'outlined' }) {
  const c = useTheme();
  const bg = kind === 'filled' ? c.surfaceContainerHighest : kind === 'outlined' ? c.surface : c.surfaceContainerLow;
  const s = [styles.card, { backgroundColor: bg, borderColor: kind === 'outlined' ? c.outlineVariant : 'transparent' }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: c.onSurface + '1F', borderless: false, foreground: true }}
      style={({ pressed }) => [s, { overflow: 'hidden' }, pressed && { backgroundColor: c.surfaceContainer }]}
    >
      {children}
    </Pressable>
  );
}

/** M3 filter chip: 32dp, 8dp corners; selected = secondaryContainer with a check mark. */
export function Chip({ label, active, onPress, color, icon: Icon }: { label: string; active?: boolean; onPress?: () => void; color?: string; icon?: LucideIcon }) {
  const c = useTheme();
  const selBg = color ? color + '33' : c.secondaryContainer;
  const selFg = color ?? c.onSecondaryContainer;
  const LeadIcon = active && !Icon ? Check : Icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      android_ripple={{ color: c.onSurface + '1F' }}
      style={[styles.chip, { borderColor: active ? 'transparent' : c.outlineVariant, backgroundColor: active ? selBg : 'transparent' }]}
    >
      {LeadIcon ? <LeadIcon size={16} color={active ? selFg : color ?? c.onSurfaceVariant} /> : null}
      <Text style={[type.labelLarge, { color: active ? selFg : c.onSurfaceVariant }]}>{label}</Text>
    </Pressable>
  );
}

/** M3 buttons: primary = filled, secondary = filled tonal, outline = outlined, danger = error tonal. */
export function Button({
  label, onPress, icon: Icon, kind = 'primary', disabled, loading,
}: { label: string; onPress: () => void; icon?: LucideIcon; kind?: 'primary' | 'secondary' | 'outline' | 'danger'; disabled?: boolean; loading?: boolean }) {
  const c = useTheme();
  const bg = { primary: c.primary, secondary: c.secondaryContainer, outline: 'transparent', danger: c.errorContainer }[kind];
  const fg = { primary: c.onPrimary, secondary: c.onSecondaryContainer, outline: c.primary, danger: c.onErrorContainer }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      android_ripple={{ color: fg + '29' }}
      style={[styles.btn, { backgroundColor: disabled ? c.onSurface + '1F' : bg, borderColor: kind === 'outline' ? c.outline : 'transparent' }]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : Icon ? <Icon size={18} color={disabled ? c.onSurface + '61' : fg} /> : null}
      <Text style={[type.labelLarge, { color: disabled ? c.onSurface + '61' : fg }]}>{label}</Text>
    </Pressable>
  );
}

/** M3 extended floating action button (primary container, 16dp corners). */
export function Fab({ label, icon: Icon, onPress, loading }: { label: string; icon: LucideIcon; onPress: () => void; loading?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: c.onPrimaryContainer + '29' }}
      style={[styles.fab, { backgroundColor: c.primaryContainer, shadowColor: '#000' }]}
    >
      {loading ? <ActivityIndicator size="small" color={c.onPrimaryContainer} /> : <Icon size={22} color={c.onPrimaryContainer} />}
      <Text style={[type.labelLarge, { color: c.onPrimaryContainer, fontSize: 15 }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon: Icon, onPress, label, color, size = 22, tonal }: { icon: LucideIcon; onPress: () => void; label: string; color?: string; size?: number; tonal?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      android_ripple={{ color: c.onSurface + '1F', borderless: true, radius: 22 }}
      style={[styles.iconBtn, tonal && { backgroundColor: c.secondaryContainer }]}
    >
      <Icon size={size} color={color ?? (tonal ? c.onSecondaryContainer : c.onSurfaceVariant)} />
    </Pressable>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  const c = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.primary} size="large" />
      <T variant="small" style={{ marginTop: space.md }}>{label}</T>
    </View>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, body, action }: { icon?: LucideIcon; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  const c = useTheme();
  return (
    <View style={[styles.center, { paddingVertical: 56 }]}>
      <View style={[styles.emptyIcon, { backgroundColor: c.primaryContainer }]}>
        <Icon size={30} color={c.onPrimaryContainer} />
      </View>
      <T variant="h2" style={{ marginTop: space.lg, textAlign: 'center' }}>{title}</T>
      {body ? <T variant="small" style={{ textAlign: 'center', marginTop: space.sm, maxWidth: 300 }}>{body}</T> : null}
      {action ? <View style={{ marginTop: space.xl }}><Button label={action.label} onPress={action.onPress} icon={RefreshCw} /></View> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: c.errorContainer }]} accessibilityRole="alert">
      <CircleAlert size={20} color={c.onErrorContainer} />
      <T variant="small" color={c.onErrorContainer} style={{ flex: 1 }}>{message}</T>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={[type.labelLarge, { color: c.onErrorContainer }]}>Retry</Text>
        </Pressable>
      ) : null}
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

/** M3 text button used for "View all" style actions. */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={styles.textLink}>
      <Text style={[type.labelLarge, { color: c.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.outlineVariant, marginVertical: space.md }} />;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, height: 32 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.full, paddingHorizontal: 24, height: 44, borderWidth: 1, overflow: 'hidden' },
  fab: {
    position: 'absolute', right: 16, bottom: 20, height: 56, borderRadius: radius.lg, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 3, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, overflow: 'hidden',
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, padding: space.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm, minHeight: 28 },
  textLink: { paddingHorizontal: 8, paddingVertical: 4 },
});
