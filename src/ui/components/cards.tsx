import { router } from 'expo-router';
import { Bookmark, BookmarkCheck, Bug, CircleCheck, Clock, Skull, ShieldAlert, TriangleAlert, Wrench } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ArticleRow, CveRow, KevRow, Severity } from '../../lib/repo/types';
import { fmtUtcDate, sevLabel, timeAgo } from '../format';
import { radius, space, useTheme } from '../theme';
import { T } from './primitives';

export function SeverityBadge({ severity, score, compact }: { severity: Severity | null; score?: number | null; compact?: boolean }) {
  const c = useTheme();
  const s = severity ?? 'UNKNOWN';
  return (
    <View style={[styles.badge, { backgroundColor: c.sevSoft[s], borderColor: c.sev[s] + '66' }]} accessibilityLabel={`Severity ${sevLabel(s)}${score != null ? `, CVSS ${score}` : ''}`}>
      <View style={[styles.dot, { backgroundColor: c.sev[s] }]} />
      <T variant="tiny" color={c.sev[s]} style={{ fontWeight: '800' }}>
        {compact ? (score != null ? score.toFixed(1) : sevLabel(s)) : `${sevLabel(s).toUpperCase()}${score != null ? ` ${score.toFixed(1)}` : ''}`}
      </T>
    </View>
  );
}

export function Tag({ label, color, icon: Icon }: { label: string; color?: string; icon?: typeof Bug }) {
  const c = useTheme();
  const col = color ?? c.textMuted;
  return (
    <View style={[styles.tag, { borderColor: col + '55', backgroundColor: col + '14' }]}>
      {Icon ? <Icon size={11} color={col} /> : null}
      <T variant="tiny" color={col} style={{ fontWeight: '700' }}>{label}</T>
    </View>
  );
}

export const ArticleCard = memo(function ArticleCard({ a, onToggleBookmark }: { a: ArticleRow; onToggleBookmark?: (a: ArticleRow) => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/article/${a.id}`)}
      accessibilityRole="button"
      accessibilityLabel={a.title}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.surfaceAlt : c.surface, borderColor: c.border }]}
    >
      <View style={styles.row}>
        <T variant="tiny" color={c.accent} style={{ fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{a.source_name}</T>
        <T variant="tiny">  ·  {timeAgo(a.published_at)}</T>
        <View style={{ flex: 1 }} />
        {onToggleBookmark ? (
          <Pressable hitSlop={12} onPress={() => onToggleBookmark(a)} accessibilityLabel={a.bookmarked ? 'Remove bookmark' : 'Bookmark'}>
            {a.bookmarked ? <BookmarkCheck size={17} color={c.accent} /> : <Bookmark size={17} color={c.textFaint} />}
          </Pressable>
        ) : null}
      </View>
      <T variant="h3" numberOfLines={3} style={{ marginTop: 4, opacity: a.read_at ? 0.62 : 1 }}>{a.title}</T>
      {a.summary ? <T variant="small" numberOfLines={2} style={{ marginTop: 4 }}>{a.summary}</T> : null}
      <View style={[styles.row, { marginTop: space.sm, flexWrap: 'wrap', gap: 6 }]}>
        <Tag label={a.category} />
        {a.cve_ids ? a.cve_ids.split(',').slice(0, 2).map((id) => <Tag key={id} label={id} color={c.warn} icon={Bug} />) : null}
      </View>
    </Pressable>
  );
});

export const CveCard = memo(function CveCard({ v, onToggleBookmark }: { v: CveRow; onToggleBookmark?: (v: CveRow) => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/cve/${v.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${v.id} ${v.title ?? ''}`}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.surfaceAlt : c.surface, borderColor: c.border, borderLeftColor: c.sev[v.severity], borderLeftWidth: 3 }]}
    >
      <View style={styles.row}>
        <T variant="mono" style={{ fontWeight: '700' }}>{v.id}</T>
        <View style={{ width: 8 }} />
        <SeverityBadge severity={v.severity} score={v.cvss_score} />
        <View style={{ flex: 1 }} />
        {onToggleBookmark ? (
          <Pressable hitSlop={12} onPress={() => onToggleBookmark(v)} accessibilityLabel={v.bookmarked ? 'Remove bookmark' : 'Bookmark'}>
            {v.bookmarked ? <BookmarkCheck size={17} color={c.accent} /> : <Bookmark size={17} color={c.textFaint} />}
          </Pressable>
        ) : null}
      </View>
      {v.title ? <T variant="h3" numberOfLines={2} style={{ marginTop: 6 }}>{v.title}</T> : null}
      <T variant="small" numberOfLines={v.title ? 2 : 3} style={{ marginTop: 4 }}>{v.description ?? 'Description not yet published by NVD.'}</T>
      <View style={[styles.row, { marginTop: space.sm, flexWrap: 'wrap', gap: 6 }]}>
        {v.kev ? <Tag label="Exploited (CISA KEV)" color={c.danger} icon={ShieldAlert} /> : null}
        {v.kev_ransomware === 'Known' ? <Tag label="Ransomware" color={c.danger} icon={Skull} /> : null}
        {!v.kev && v.exploit_refs ? <Tag label="Exploit ref (unverified)" color={c.warn} icon={TriangleAlert} /> : null}
        {v.patch_available ? <Tag label="Fix referenced" color={c.ok} icon={Wrench} /> : null}
        {v.vendors ? <Tag label={v.vendors.split(',').slice(0, 2).join(', ')} /> : null}
        <View style={{ flex: 1 }} />
        <View style={[styles.row, { gap: 3 }]}>
          <Clock size={10} color={c.textFaint} />
          <T variant="tiny">{timeAgo(v.published_at)}</T>
        </View>
      </View>
    </Pressable>
  );
});

export const KevCard = memo(function KevCard({ k }: { k: KevRow }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/cve/${k.cve_id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.surfaceAlt : c.surface, borderColor: c.border, borderLeftColor: c.danger, borderLeftWidth: 3 }]}
    >
      <View style={styles.row}>
        <T variant="mono" style={{ fontWeight: '700' }}>{k.cve_id}</T>
        <View style={{ width: 8 }} />
        {k.severity ? <SeverityBadge severity={k.severity} score={k.cvss_score} /> : null}
        <View style={{ flex: 1 }} />
        <T variant="tiny">Added {fmtUtcDate(k.date_added)}</T>
      </View>
      <T variant="h3" numberOfLines={2} style={{ marginTop: 6 }}>{k.name ?? `${k.vendor} ${k.product}`}</T>
      <T variant="small" numberOfLines={1} style={{ marginTop: 2 }}>{[k.vendor, k.product].filter(Boolean).join(' · ')}</T>
      <View style={[styles.row, { marginTop: space.sm, gap: 6, flexWrap: 'wrap' }]}>
        <Tag label="Verified exploited" color={c.danger} icon={ShieldAlert} />
        {k.ransomware === 'Known' ? <Tag label="Known ransomware use" color={c.danger} icon={Skull} /> : null}
        {k.due_date ? <Tag label={`Federal due ${fmtUtcDate(k.due_date)}`} icon={CircleCheck} /> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1, maxWidth: 220 },
});
