import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { SEVERITIES, Severity } from '../../lib/repo/types';
import { sevLabel } from '../format';
import { space, useTheme } from '../theme';
import { T } from './primitives';

/** Interactive donut: tap a segment or legend row to highlight / drill down. */
export function SeverityDonut({ data, onSelect }: { data: { severity: Severity; n: number }[]; onSelect?: (s: Severity) => void }) {
  const c = useTheme();
  const [active, setActive] = useState<Severity | null>(null);
  const rows = SEVERITIES.map((s) => ({ s, n: data.find((d) => d.severity === s)?.n ?? 0 }));
  const total = rows.reduce((a, r) => a + r.n, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const focus = active ? rows.find((r) => r.s === active)! : null;
  return (
    <View style={styles.donutWrap}>
      <View accessible accessibilityLabel={`Severity distribution of ${total} CVEs`}>
        <Svg width={132} height={132} viewBox="0 0 132 132">
          <G rotation={-90} origin="66, 66">
            <Circle cx={66} cy={66} r={R} stroke={c.surfaceAlt} strokeWidth={16} fill="none" />
            {total > 0 &&
              rows.map((r) => {
                if (!r.n) return null;
                const len = (r.n / total) * C;
                const el = (
                  <Circle
                    key={r.s}
                    cx={66}
                    cy={66}
                    r={R}
                    stroke={c.sev[r.s]}
                    strokeWidth={active === r.s ? 20 : 16}
                    strokeOpacity={active && active !== r.s ? 0.35 : 1}
                    fill="none"
                    strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${C}`}
                    strokeDashoffset={-acc}
                    onPress={() => setActive(active === r.s ? null : r.s)}
                  />
                );
                acc += len;
                return el;
              })}
          </G>
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <T variant="h2" color={focus ? c.sev[focus.s] : c.text}>{focus ? focus.n : total}</T>
          <T variant="tiny">{focus ? sevLabel(focus.s) : 'CVEs'}</T>
        </View>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {rows.map((r) => (
          <Pressable
            key={r.s}
            onPress={() => (active === r.s && onSelect ? onSelect(r.s) : setActive(active === r.s ? null : r.s))}
            style={[styles.legendRow, active === r.s && { backgroundColor: c.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel={`${sevLabel(r.s)} ${r.n}`}
          >
            <View style={[styles.swatch, { backgroundColor: c.sev[r.s] }]} />
            <T variant="small" style={{ flex: 1 }}>{sevLabel(r.s)}</T>
            <T variant="small" color={c.text} style={{ fontWeight: '700' }}>{r.n}</T>
          </Pressable>
        ))}
        {onSelect ? <T variant="tiny">Tap twice to open the list</T> : null}
      </View>
    </View>
  );
}

/** Horizontal bar list (source distribution). Tap a row to drill down. */
export function BarList({ rows, onPress, max = 10 }: { rows: { key: string; label: string; n: number }[]; onPress?: (key: string) => void; max?: number }) {
  const c = useTheme();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, max);
  const top = Math.max(1, ...rows.map((r) => r.n));
  return (
    <View style={{ gap: 7 }}>
      {shown.map((r) => (
        <Pressable key={r.key} onPress={() => onPress?.(r.key)} accessibilityRole="button" accessibilityLabel={`${r.label}: ${r.n} articles`}>
          <View style={styles.barHead}>
            <T variant="small" numberOfLines={1} style={{ flex: 1 }}>{r.label}</T>
            <T variant="small" color={c.text} style={{ fontWeight: '700' }}>{r.n}</T>
          </View>
          <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
            <View style={[styles.fill, { width: `${(r.n / top) * 100}%`, backgroundColor: c.accent }]} />
          </View>
        </Pressable>
      ))}
      {rows.length > max ? (
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={8}>
          <T variant="small" color={c.accent} style={{ fontWeight: '700', marginTop: 2 }}>{expanded ? 'Show fewer' : `Show all ${rows.length} sources`}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  donutWrap: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  donutCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, paddingHorizontal: 4, borderRadius: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  barHead: { flexDirection: 'row', marginBottom: 3 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
