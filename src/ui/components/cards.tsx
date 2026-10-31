import { router } from 'expo-router';
import { Bookmark, BookmarkCheck, Bug, Clock, Skull, ShieldAlert, TriangleAlert, Wrench, CalendarClock } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ArticleRow, CveRow, KevRow, Severity } from '../../lib/repo/types';
import { fmtUtcDate, sevLabel, timeAgo } from '../format';
import { radius, space, type, useTheme } from '../theme';
import { T } from './primitives';

/** Severity as an M3 tonal badge (container + on-container colors). */
export function SeverityBadge({ severity, score, compact }: { severity: Severity | null; score?: number | null; compact?: boolean }) {
  const c = useTheme();
  const s = severity ?? 'UNKNOWN';
  return (
    <View style={[styles.badge, { backgroundColor: c.sevSoft[s] }]} accessibilityLabel={`Severity ${sevLabel(s)}${score != null ? `, CVSS ${score}` : ''}`}>
      <View style={[styles.dot, { backgroundColor: c.sev[s] }]} />
      <Text style={[type.labelMedium, { color: c.sevOn[s] }]}>
        {compact ? (score != null ? score.toFixed(1) : sevLabel(s)) : `${sevLabel(s)}${score != null ? ` ${score.toFixed(1)}` : ''}`}
      </Text>
    </View>
  );
}

/** Large circular score "avatar" leading a CVE list item. */
function ScoreAvatar({ severity, score }: { severity: Severity; score: number | null }) {
  const c = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: c.sevSoft[severity] }]}>
      <Text style={[type.titleMedium, { color: c.sevOn[severity], fontSize: score != null ? 16 : 12 }]}>{score != null ? score.toFixed(1) : '—'}</Text>
    </View>
  );
}

/** M3 assist chip, non-interactive. */
export function Tag({ label, color, icon: Icon }: { label: string; color?: string; icon?: typeof Bug }) {
  const c = useTheme();
  const fg = color ?? c.onSurfaceVariant;
  return (
    <View style={[styles.tag, { borderColor: color ? color + '66' : c.outlineVariant, backgroundColor: color ? color + '1A' : 'transparent' }]}>
      {Icon ? <Icon size={13} color={fg} /> : null}
      <Text numberOfLines={1} style={[type.labelMedium, { color: fg }]}>{label}</Text>
    </View>
  );
}

function BookmarkToggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable hitSlop={12} onPress={onPress} accessibilityLabel={on ? 'Remove bookmark' : 'Bookmark'} android_ripple={{ color: c.onSurface + '1F', borderless: true, radius: 20 }} style={styles.bookmark}>
      {on ? <BookmarkCheck size={20} color={c.primary} /> : <Bookmark size={20} color={c.onSurfaceVariant} />}
    </Pressable>
  );
}

export const ArticleCard = memo(function ArticleCard({ a, onToggleBookmark }: { a: ArticleRow; onToggleBookmark?: (a: ArticleRow) => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/article/${a.id}`)}
      accessibilityRole="button"
      accessibilityLabel={a.title}
      android_ripple={{ color: c.onSurface + '1F', foreground: true }}
      style={[styles.card, { backgroundColor: c.surfaceContainerLow }]}
    >
      <View style={styles.row}>
        <View style={[styles.sourceDot, { backgroundColor: c.primaryContainer }]}>
          <Text style={[type.labelMedium, { color: c.onPrimaryContainer }]}>{a.source_name.replace(/^The /, '').charAt(0)}</Text>
        </View>
        <Text style={[type.labelLarge, { color: c.onSurface, flexShrink: 1 }]} numberOfLines={1}>{a.source_name}</Text>
        <Text style={[type.bodySmall, { color: c.onSurfaceVariant }]}>  ·  {timeAgo(a.published_at)}</Text>
        <View style={{ flex: 1 }} />
        {onToggleBookmark ? <BookmarkToggle on={!!a.bookmarked} onPress={() => onToggleBookmark(a)} /> : null}
      </View>
      <T variant="h3" numberOfLines={3} style={{ marginTop: space.sm, opacity: a.read_at ? 0.65 : 1, fontSize: 17, lineHeight: 24 }}>{a.title}</T>
      {a.summary ? <T variant="small" numberOfLines={2} style={{ marginTop: 6 }}>{a.summary}</T> : null}
      <View style={[styles.row, { marginTop: space.md, flexWrap: 'wrap', gap: 8 }]}>
        <Tag label={a.category} />
        {a.cve_ids ? a.cve_ids.split(',').slice(0, 2).map((id) => <Tag key={id} label={id} color={c.tertiary} icon={Bug} />) : null}
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
      android_ripple={{ color: c.onSurface + '1F', foreground: true }}
      style={[styles.card, { backgroundColor: c.surfaceContainerLow }]}
    >
      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        <ScoreAvatar severity={v.severity} score={v.cvss_score} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <View style={styles.row}>
            <Text style={[type.titleSmall, { color: c.onSurface, fontFamily: 'monospace', fontWeight: '700' }]}>{v.id}</Text>
            <View style={{ flex: 1 }} />
            {onToggleBookmark ? <BookmarkToggle on={!!v.bookmarked} onPress={() => onToggleBookmark(v)} /> : null}
          </View>
          <Text style={[type.labelMedium, { color: c.sev[v.severity] }]}>{sevLabel(v.severity)}{v.cvss_version ? `  ·  CVSS ${v.cvss_version}` : ''}</Text>
        </View>
      </View>
      {v.title ? <T variant="h3" numberOfLines={2} style={{ marginTop: space.md }}>{v.title}</T> : null}
      <T variant="small" numberOfLines={v.title ? 2 : 3} style={{ marginTop: 4 }}>{v.description ?? 'Description not yet published by NVD.'}</T>
      <View style={[styles.row, { marginTop: space.md, flexWrap: 'wrap', gap: 8 }]}>
        {v.kev ? <Tag label="Exploited · CISA KEV" color={c.error} icon={ShieldAlert} /> : null}
        {v.kev_ransomware === 'Known' ? <Tag label="Ransomware" color={c.error} icon={Skull} /> : null}
        {!v.kev && v.exploit_refs ? <Tag label="Exploit ref (unverified)" color={c.warn} icon={TriangleAlert} /> : null}
        {v.patch_available ? <Tag label="Fix referenced" color={c.ok} icon={Wrench} /> : null}
        {v.vendors ? <Tag label={v.vendors.split(',').slice(0, 2).join(', ')} /> : null}
      </View>
      <View style={[styles.row, { gap: 4, marginTop: space.sm }]}>
        <Clock size={12} color={c.onSurfaceVariant} />
        <Text style={[type.bodySmall, { color: c.onSurfaceVariant }]}>Published {timeAgo(v.published_at)}</Text>
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
      android_ripple={{ color: c.onSurface + '1F', foreground: true }}
      style={[styles.card, { backgroundColor: c.surfaceContainerLow }]}
    >
      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        <View style={[styles.avatar, { backgroundColor: c.errorContainer }]}>
          <ShieldAlert size={22} color={c.onErrorContainer} />
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <View style={styles.row}>
            <Text style={[type.titleSmall, { color: c.onSurface, fontFamily: 'monospace', fontWeight: '700' }]}>{k.cve_id}</Text>
            <View style={{ flex: 1 }} />
            {k.severity ? <SeverityBadge severity={k.severity} score={k.cvss_score} compact /> : null}
          </View>
          <Text style={[type.bodySmall, { color: c.onSurfaceVariant }]} numberOfLines={1}>{[k.vendor, k.product].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      <T variant="h3" numberOfLines={2} style={{ marginTop: space.md }}>{k.name ?? `${k.vendor} ${k.product}`}</T>
      <View style={[styles.row, { marginTop: space.md, gap: 8, flexWrap: 'wrap' }]}>
        <Tag label={`Added ${fmtUtcDate(k.date_added)}`} color={c.error} icon={CalendarClock} />
        {k.ransomware === 'Known' ? <Tag label="Known ransomware use" color={c.error} icon={Skull} /> : null}
        {k.due_date ? <Tag label={`Due ${fmtUtcDate(k.due_date)}`} /> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: radius.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: radius.sm, borderWidth: 1, maxWidth: 240 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sourceDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bookmark: { padding: 4 },
});
