/** Lightweight SVG charts (react-native-svg). No animation, no third-party chart runtime. */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { allocationPct } from '@/lib/calc';
import { inrCompact } from '@/lib/format';
import { usePrivacy } from '@/state/privacy';
import { Body, Caption, Label, Row } from './components';
import { space, useTheme } from './theme';

function useWidth(initial = 320) {
  const [w, setW] = useState(initial);
  return { w, onLayout: (e: LayoutChangeEvent) => setW(Math.max(120, e.nativeEvent.layout.width)) };
}

function niceRange(min: number, max: number) {
  if (min === max) return { lo: min * 0.9, hi: max * 1.1 || 1 };
  const pad = (max - min) * 0.1;
  return { lo: Math.max(min - pad, min >= 0 ? 0 : -Infinity), hi: max + pad };
}

/* ---------------------------------------------------------------- line / area */
export function LineChart({ series, labels, height = 180, a11y }: {
  series: { values: number[]; color?: string; name: string; fill?: boolean }[];
  labels: string[]; height?: number; a11y: string;
}) {
  const { colors } = useTheme();
  const { hidden } = usePrivacy();
  const { w, onLayout } = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  if (!all.length) return null;
  const { lo, hi } = niceRange(Math.min(...all), Math.max(...all));
  const padL = hidden ? 8 : 52;
  const padB = 22;
  const iw = w - padL - 8;
  const ih = height - padB - 8;
  const n = Math.max(1, labels.length - 1);
  const x = (i: number) => padL + (i / n) * iw;
  const y = (v: number) => 8 + ih - ((v - lo) / (hi - lo)) * ih;
  const ticks = [0, 0.5, 1].map((t) => lo + (hi - lo) * t);
  const step = Math.ceil(labels.length / 5);

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={a11y}>
      <Svg width={w} height={height}
        onPress={(e) => {
          const px = e.nativeEvent.locationX;
          setSel(Math.max(0, Math.min(labels.length - 1, Math.round(((px - padL) / iw) * n))));
        }}>
        <Defs>
          {series.map((s, si) => (
            <LinearGradient key={si} id={`g${si}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={s.color ?? colors.chart[si]} stopOpacity={0.22} />
              <Stop offset="1" stopColor={s.color ?? colors.chart[si]} stopOpacity={0} />
            </LinearGradient>
          ))}
        </Defs>
        {ticks.map((t, i) => (
          <G key={i}>
            <Line x1={padL} x2={w - 8} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} strokeDasharray={i === 0 ? undefined : '3 4'} />
            {!hidden && <SvgText x={padL - 6} y={y(t) + 4} fontSize={10} fill={colors.textFaint} textAnchor="end">{inrCompact(t).replace('₹', '')}</SvgText>}
          </G>
        ))}
        {labels.map((l, i) => (i % step === 0 || i === labels.length - 1) && (
          <SvgText key={i} x={x(i)} y={height - 6} fontSize={10} fill={colors.textFaint} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>{l}</SvgText>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`);
          const line = `M${pts.join(' L')}`;
          const c = s.color ?? colors.chart[si];
          return (
            <G key={si}>
              {s.fill !== false && <Path d={`${line} L${x(s.values.length - 1)},${8 + ih} L${x(0)},${8 + ih} Z`} fill={`url(#g${si})`} />}
              <Path d={line} stroke={c} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            </G>
          );
        })}
        {sel != null && (
          <G>
            <Line x1={x(sel)} x2={x(sel)} y1={8} y2={8 + ih} stroke={colors.textFaint} strokeWidth={1} />
            {series.map((s, si) => <Circle key={si} cx={x(sel)} cy={y(s.values[sel])} r={4} fill={s.color ?? colors.chart[si]} stroke={colors.surface} strokeWidth={2} />)}
          </G>
        )}
      </Svg>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Row gap={space.md}>
          {series.map((s, si) => (
            <Row key={si} gap={6}>
              <View style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: s.color ?? colors.chart[si] }} />
              <Caption muted>{s.name}</Caption>
            </Row>
          ))}
        </Row>
        {sel != null && (
          <Caption muted>
            {labels[sel]}: {series.map((s) => (hidden ? '•••' : inrCompact(s.values[sel]))).join(' / ')}
          </Caption>
        )}
      </Row>
    </View>
  );
}

/* ---------------------------------------------------------------- donut + legend */
export function Donut({ data, size = 150, centerLabel, centerValue }: {
  data: { label: string; value: number }[]; size?: number; centerLabel?: string; centerValue?: string;
}) {
  const { colors } = useTheme();
  const { hidden } = usePrivacy();
  const pcts = allocationPct(data.map((d) => d.value));
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Row gap={space.lg} style={{ alignItems: 'center' }}>
      <View accessible accessibilityLabel={`Allocation: ${data.map((d, i) => `${d.label} ${pcts[i]}%`).join(', ')}`}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={18} fill="none" />
            {data.map((d, i) => {
              const len = (pcts[i] / 100) * c;
              const el = len > 0 ? (
                <Circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={colors.chart[i % colors.chart.length]} strokeWidth={18} fill="none"
                  strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-offset} />
              ) : null;
              offset += len;
              return el;
            })}
          </G>
          {centerValue && (
            <>
              <SvgText x={size / 2} y={size / 2 - 2} fontSize={15} fontWeight="700" fill={colors.text} textAnchor="middle">{hidden ? '•••' : centerValue}</SvgText>
              <SvgText x={size / 2} y={size / 2 + 15} fontSize={10} fill={colors.textMuted} textAnchor="middle">{centerLabel}</SvgText>
            </>
          )}
        </Svg>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        {data.map((d, i) => (
          <Row key={d.label} gap={8}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.chart[i % colors.chart.length] }} />
            <Caption style={{ flex: 1 }} numberOfLines={1}>{d.label}</Caption>
            <Label>{pcts[i].toFixed(1)}%</Label>
          </Row>
        ))}
      </View>
    </Row>
  );
}

/* ---------------------------------------------------------------- grouped bars (income vs expense) */
export function BarChart({ labels, groups, height = 170, a11y }: {
  labels: string[]; groups: { name: string; values: number[]; color?: string }[]; height?: number; a11y: string;
}) {
  const { colors } = useTheme();
  const { w, onLayout } = useWidth();
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  const padB = 20;
  const ih = height - padB - 6;
  const slot = w / labels.length;
  const bw = Math.min(10, (slot - 6) / groups.length);
  return (
    <View onLayout={onLayout} accessible accessibilityLabel={a11y}>
      <Svg width={w} height={height}>
        <Line x1={0} x2={w} y1={6 + ih} y2={6 + ih} stroke={colors.border} />
        {labels.map((l, i) => (
          <G key={i}>
            {groups.map((g, gi) => {
              const h = (g.values[i] / max) * ih;
              const x0 = i * slot + slot / 2 - (bw * groups.length) / 2 + gi * bw;
              return <Rect key={gi} x={x0} y={6 + ih - h} width={bw - 1.5} height={Math.max(0, h)} rx={2} fill={g.color ?? colors.chart[gi]} />;
            })}
            <SvgText x={i * slot + slot / 2} y={height - 5} fontSize={9.5} fill={colors.textFaint} textAnchor="middle">{l}</SvgText>
          </G>
        ))}
      </Svg>
      <Row gap={space.md}>
        {groups.map((g, gi) => (
          <Row key={g.name} gap={6}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: g.color ?? colors.chart[gi] }} />
            <Caption muted>{g.name}</Caption>
          </Row>
        ))}
      </Row>
    </View>
  );
}

/* ---------------------------------------------------------------- horizontal category bars */
export function CategoryBars({ items, max = 6 }: { items: { category: string; amount: number }[]; max?: number }) {
  const { colors } = useTheme();
  const { hidden } = usePrivacy();
  const top = items.slice(0, max);
  const peak = Math.max(1, ...top.map((t) => t.amount));
  return (
    <View style={{ gap: space.md }}>
      {top.map((t, i) => (
        <View key={t.category} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body>{t.category}</Body>
            <Label>{hidden ? '•••' : inrCompact(t.amount)}</Label>
          </Row>
          <View style={{ height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3 }}>
            <View style={{ width: `${(t.amount / peak) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.chart[i % colors.chart.length] }} />
          </View>
        </View>
      ))}
    </View>
  );
}
