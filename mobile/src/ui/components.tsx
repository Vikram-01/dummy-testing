import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage, ApiError } from '@/api/client';
import { usePrivacy } from '@/state/privacy';
import { HIDDEN, inr, inrCompact } from '@/lib/format';
import { radius, space, type, useTheme } from './theme';

export type IconName = keyof typeof Ionicons.glyphMap;

/* ------------------------------------------------------------------ text */
type TProps = { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; faint?: boolean; numberOfLines?: number; color?: string; selectable?: boolean };
function makeText(variant: keyof typeof type) {
  return function T({ children, style, muted, faint, numberOfLines, color, selectable }: TProps) {
    const { colors } = useTheme();
    return (
      <Text selectable={selectable} numberOfLines={numberOfLines} style={[type[variant] as TextStyle, { color: color ?? (faint ? colors.textFaint : muted ? colors.textMuted : colors.text) }, style]}>
        {children}
      </Text>
    );
  };
}
export const Display = makeText('display');
export const Title = makeText('title');
export const Heading = makeText('heading');
export const Body = makeText('body');
export const Label = makeText('label');
export const Caption = makeText('caption');

/** Amount that respects the "hide balances" privacy toggle. */
export function Money({ value, compact, sign, decimals, style, variant = 'body', colorize }: {
  value: number | null | undefined; compact?: boolean; sign?: boolean; decimals?: number;
  style?: StyleProp<TextStyle>; variant?: keyof typeof type; colorize?: boolean;
}) {
  const { colors } = useTheme();
  const { hidden } = usePrivacy();
  const text = hidden ? HIDDEN : compact ? inrCompact(value) : inr(value, { sign, decimals });
  const color = colorize && !hidden && value ? (value > 0 ? colors.positive : colors.negative) : colors.text;
  return <Text accessibilityLabel={hidden ? 'Amount hidden' : undefined} style={[type[variant] as TextStyle, type.num, { color }, style]}>{text}</Text>;
}

/* ------------------------------------------------------------------ layout */
export function Screen({ children, refreshing, onRefresh, scroll = true, padded = true, edges }: {
  children: ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean; padded?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const { colors } = useTheme();
  const pad = padded ? { padding: space.lg, gap: space.lg } : undefined;
  return (
    <SafeAreaView edges={edges ?? []} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, { paddingBottom: space.xxl * 2 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const base = [{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: space.lg, gap: space.md }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      android_ripple={{ color: colors.surfaceAlt }} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
      <Heading>{title}</Heading>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
          <Label color={colors.primary}>{action}</Label>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function ListRow({ title, subtitle, right, rightSub, icon, onPress, danger }: {
  title: string; subtitle?: string; right?: ReactNode; rightSub?: ReactNode; icon?: IconName; onPress?: () => void; danger?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <Row gap={space.md} style={{ paddingVertical: space.sm, minHeight: 48 }}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={danger ? colors.negative : colors.textMuted} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Body numberOfLines={1} color={danger ? colors.negative : undefined}>{title}</Body>
        {subtitle ? <Caption muted numberOfLines={1}>{subtitle}</Caption> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {typeof right === 'string' ? <Body>{right}</Body> : right}
        {typeof rightSub === 'string' ? <Caption muted>{rightSub}</Caption> : rightSub}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} /> : null}
    </Row>
  );
  if (!onPress) return content;
  return <Pressable onPress={onPress} accessibilityRole="button" android_ripple={{ color: colors.surfaceAlt }}>{content}</Pressable>;
}

/* ------------------------------------------------------------------ status */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'primary' | 'demo' }) {
  const { colors } = useTheme();
  const map = {
    neutral: [colors.surfaceAlt, colors.textMuted],
    positive: [colors.surfaceAlt, colors.positive],
    negative: [colors.surfaceAlt, colors.negative],
    warning: [colors.warningSoft, colors.warning],
    primary: [colors.primarySoft, colors.primary],
    demo: [colors.demoSoft, colors.demo],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Caption color={fg} style={{ fontWeight: '600' }}>{label}</Caption>
    </View>
  );
}

export function DemoBanner() {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: colors.demoSoft, borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
      <Ionicons name="flask-outline" size={18} color={colors.demo} />
      <Caption color={colors.demo} style={{ flex: 1, fontWeight: '600' }}>
        DEMO DATA — every account, holding and amount shown is fictional. Not your real finances.
      </Caption>
    </View>
  );
}

export function OfflineBanner({ updatedAt }: { updatedAt?: number }) {
  const { colors } = useTheme();
  const when = updatedAt ? new Date(updatedAt).toLocaleString() : 'earlier';
  return (
    <View style={{ backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Caption color={colors.warning} style={{ flex: 1 }}>Offline — showing read-only data saved {when}.</Caption>
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: space.xxl, alignItems: 'center', gap: space.md }}>
      <ActivityIndicator color={colors.primary} />
      <Caption muted>{label}</Caption>
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height, width, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm }, style]} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <Skeleton width="40%" height={14} />
      <Skeleton width="70%" height={28} />
      {Array.from({ length: lines - 2 }, (_, i) => <Skeleton key={i} />)}
    </Card>
  );
}

export function EmptyState({ icon = 'file-tray-outline', title, message, action, onAction }: {
  icon?: IconName; title: string; message?: string; action?: string; onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <Ionicons name={icon} size={36} color={colors.textFaint} />
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {message ? <Body muted style={{ textAlign: 'center' }}>{message}</Body> : null}
      {action && onAction ? <Button title={action} variant="secondary" onPress={onAction} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = error instanceof ApiError && error.isNetwork;
  return (
    <EmptyState
      icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
      title={offline ? 'You’re offline' : 'Couldn’t load this'}
      message={errorMessage(error)}
      action={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

/* ------------------------------------------------------------------ inputs */
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean;
  disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.primarySoft, ghost: 'transparent', danger: colors.negative }[variant];
  const fg = { primary: colors.primaryText, secondary: colors.primary, ghost: colors.primary, danger: '#FFFFFF' }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [{ backgroundColor: bg, borderRadius: radius.md, minHeight: 48, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm, opacity: off ? 0.55 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[type.heading, { color: fg, fontSize: 15 }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, error, hint, style, ...rest }: TextInputProps & { label: string; error?: string; hint?: string }) {
  {
    const { colors } = useTheme();
    return (
      <View style={{ gap: 6 }}>
        <Label muted>{label}</Label>
        <TextInput
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={label}
          style={[type.body, { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: error ? colors.negative : colors.border, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 }, style]}
          {...rest}
        />
        {error ? <Caption color={colors.negative}>{error}</Caption> : hint ? <Caption faint>{hint}</Caption> : null}
      </View>
    );
  }
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center', backgroundColor: active ? colors.surface : 'transparent' }}>
            <Label color={active ? colors.text : colors.textMuted} numberOfLines={1}>{o.label}</Label>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ title, subtitle, value, onChange, disabled }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Row gap={space.md} style={{ paddingVertical: space.sm, minHeight: 48 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Body>{title}</Body>
        {subtitle ? <Caption muted>{subtitle}</Caption> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={title}
        trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFFFFF" />
    </Row>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Caption muted>{label}</Caption>
      {value}
      {sub}
    </View>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  const { colors } = useTheme();
  const v = Math.max(0, Math.min(100, value));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v) }}
      style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' }}>
      <View style={{ width: `${v}%`, height: '100%', backgroundColor: color ?? colors.primary, borderRadius: radius.pill }} />
    </View>
  );
}
