import { router, useFocusEffect } from 'expo-router';
import { Bug, CalendarClock, ChevronRight, CircleAlert, CircleCheck, Flame, Newspaper, RefreshCw, ShieldAlert, Skull, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { dashboardStats, type DashboardStats } from '../../lib/repo/stats';
import { nextScheduledSync } from '../../lib/sync/engine';
import { useApp, useDb } from '../../ui/AppState';
import { CveCard, SeverityBadge } from '../../ui/components/cards';
import { BarList, SeverityDonut } from '../../ui/components/charts';
import { Card, EmptyState, ErrorBanner, Fab, Loading, SectionHeader, T, TextLink } from '../../ui/components/primitives';
import { fmtDate, fmtUtcDate, timeAgo } from '../../ui/format';
import { radius, space, type, useTheme } from '../../ui/theme';

/** Tonal stat tile: value in headline type on an M3 container color. */
function Stat({ icon: Icon, label, value, bg, fg, onPress }: { icon: LucideIcon; label: string; value: number | string; bg: string; fg: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} android_ripple={{ color: fg + '1F', foreground: true }} style={[styles.stat, { backgroundColor: bg }]}>
      <Icon size={20} color={fg} />
      <Text style={[type.headlineMedium, { color: fg, marginTop: space.md }]}>{value}</Text>
      <Text style={[type.labelLarge, { color: fg, opacity: 0.85 }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Overview() {
  const db = useDb();
  const c = useTheme();
  const { settings, syncing, syncNow, dataVersion, progress } = useApp();
  const { width } = useWindowDimensions();
  const [s, setS] = useState<DashboardStats | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [stats, nxt] = await Promise.all([dashboardStats(db, settings.retentionDays), nextScheduledSync(db)]);
      setS(stats);
      setNext(nxt);
      setNow(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [db, settings.retentionDays]);
  useEffect(() => {
    // Data loads asynchronously; state is only set after the query resolves.
    (async () => {
      await load();
    })();
  }, [load, dataVersion]);
  useFocusEffect(useCallback(() => void load(), [load]));

  if (!s || now == null) return error ? <View style={{ padding: space.lg }}><ErrorBanner message={error} onRetry={load} /></View> : <Loading label="Loading your briefing" />;

  const cols = width >= 700 ? 4 : 2;
  const statW = `${(100 - (cols - 1) * 3) / cols}%` as const;
  const empty = s.totalArticles === 0 && s.totalCves === 0;
  const status = s.lastRun?.status;
  const statusColor = status === 'success' ? c.ok : status === 'partial' ? c.warn : status ? c.error : c.onSurfaceVariant;
  const StatusIcon = status === 'success' ? CircleCheck : status === 'partial' ? TriangleAlert : CircleAlert;
  const dateLine = new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 112 }}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.surfaceContainerHigh} />}
      >
        {/* Daily briefing hero */}
        <View style={[styles.hero, { backgroundColor: c.primaryContainer }]}>
          <Text style={[type.labelLarge, { color: c.onPrimaryContainer, opacity: 0.8 }]}>{dateLine}</Text>
          <Text style={[type.headlineMedium, { color: c.onPrimaryContainer, marginTop: 4 }]}>{greeting(now)}</Text>
          <Text style={[type.bodyLarge, { color: c.onPrimaryContainer, marginTop: space.sm }]}>
            {s.kevInWindow > 0
              ? `${s.kevInWindow} newly exploited ${s.kevInWindow === 1 ? 'vulnerability' : 'vulnerabilities'} and ${s.criticalCves} critical CVEs in the last ${settings.retentionDays} days.`
              : `${s.criticalCves} critical CVEs and ${s.articlesToday} new stories today.`}
          </Text>
          <View style={[styles.row, { marginTop: space.lg, gap: space.sm, flexWrap: 'wrap' }]}>
            <Pressable onPress={() => router.push('/kev')} android_ripple={{ color: c.onPrimary + '29' }} style={[styles.heroBtn, { backgroundColor: c.onPrimaryContainer }]}>
              <ShieldAlert size={18} color={c.primaryContainer} />
              <Text style={[type.labelLarge, { color: c.primaryContainer }]}>Exploited now</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/news')} android_ripple={{ color: c.onPrimaryContainer + '29' }} style={[styles.heroBtn, { borderWidth: 1, borderColor: c.onPrimaryContainer + '66' }]}>
              <Newspaper size={18} color={c.onPrimaryContainer} />
              <Text style={[type.labelLarge, { color: c.onPrimaryContainer }]}>Top stories</Text>
            </Pressable>
          </View>
        </View>

        {/* Sync status */}
        <Card onPress={() => router.push('/sync')} style={{ marginTop: space.md }} accessibilityLabel="Synchronization status">
          <View style={styles.row}>
            <View style={[styles.statusIcon, { backgroundColor: statusColor + '26' }]}>
              <StatusIcon size={20} color={syncing ? c.primary : statusColor} />
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <T variant="h3">{syncing ? 'Synchronizing…' : status ? `Last sync ${status}` : 'Not synced yet'}</T>
              <T variant="small" numberOfLines={1}>
                {syncing ? progress ?? 'Contacting sources' : s.lastSuccessAt ? `Updated ${timeAgo(s.lastSuccessAt, now)} · next ${next ? timeAgo(next, now) : 'soon'}` : 'Tap Sync to fetch your first briefing'}
              </T>
            </View>
            <ChevronRight size={20} color={c.onSurfaceVariant} />
          </View>
          {s.sourcesFailing ? (
            <View style={[styles.row, { gap: 6, marginTop: space.md }]}>
              <TriangleAlert size={14} color={c.warn} />
              <T variant="tiny" color={c.warn}>{s.sourcesFailing} of {s.sourcesTotal} sources unavailable · every {settings.syncIntervalMinutes} min · keeps {settings.retentionDays} days</T>
            </View>
          ) : (
            <View style={[styles.row, { gap: 6, marginTop: space.md }]}>
              <CalendarClock size={14} color={c.onSurfaceVariant} />
              <T variant="tiny">Every {settings.syncIntervalMinutes} min · keeps {settings.retentionDays} days{next ? ` · ${fmtDate(next, true)}` : ''}</T>
            </View>
          )}
        </Card>

        {empty && !syncing ? (
          <EmptyState icon={ShieldAlert} title="Welcome to SecOpsDaily" body="Run the first sync to pull the last few days of security news, CVEs and CISA KEV data onto your phone." action={{ label: 'Sync now', onPress: () => void syncNow() }} />
        ) : null}

        <SectionHeader title="At a glance" />
        <View style={styles.grid}>
          <View style={{ width: statW }}><Stat icon={ShieldAlert} label={`New KEV · ${settings.retentionDays}d`} value={s.kevInWindow} bg={c.tertiaryContainer} fg={c.onTertiaryContainer} onPress={() => router.push('/kev')} /></View>
          <View style={{ width: statW }}><Stat icon={Flame} label="Critical CVEs" value={s.criticalCves} bg={c.sevSoft.CRITICAL} fg={c.sevOn.CRITICAL} onPress={() => router.push('/critical')} /></View>
          <View style={{ width: statW }}><Stat icon={Newspaper} label="Stories today" value={s.articlesToday} bg={c.secondaryContainer} fg={c.onSecondaryContainer} onPress={() => router.push('/news')} /></View>
          <View style={{ width: statW }}><Stat icon={Bug} label="High CVEs" value={s.highCves} bg={c.surfaceContainerHigh} fg={c.onSurface} onPress={() => router.push('/cves')} /></View>
        </View>
        <View style={[styles.row, { marginTop: space.md, gap: space.lg, flexWrap: 'wrap' }]}>
          <T variant="tiny">{s.totalArticles} articles stored</T>
          <T variant="tiny">{s.totalCves} CVEs stored</T>
          <T variant="tiny">{s.cvss9Plus} at CVSS 9.0+</T>
          <T variant="tiny">{s.kevTotal} in KEV catalog</T>
        </View>

        <SectionHeader title="Exploited vulnerability alerts" right={<TextLink label="CISA KEV" onPress={() => router.push('/kev')} />} />
        {s.exploitedAlerts.length === 0 ? (
          <Card><T variant="small">No new CISA KEV additions in the last {settings.retentionDays} days.</T></Card>
        ) : (
          <Card style={{ paddingVertical: space.sm, paddingHorizontal: 0 }}>
            {s.exploitedAlerts.map((k, i) => (
              <Pressable key={k.cve_id} onPress={() => router.push(`/cve/${k.cve_id}`)} android_ripple={{ color: c.onSurface + '1F' }} style={[styles.alertRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.outlineVariant }]}>
                <View style={[styles.statusIcon, { backgroundColor: c.errorContainer }]}>
                  {k.ransomware === 'Known' ? <Skull size={18} color={c.onErrorContainer} /> : <ShieldAlert size={18} color={c.onErrorContainer} />}
                </View>
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <View style={styles.row}>
                    <Text style={[type.titleSmall, { color: c.onSurface, fontFamily: 'monospace', fontWeight: '700' }]}>{k.cve_id}</Text>
                    <View style={{ flex: 1 }} />
                    {k.severity ? <SeverityBadge severity={k.severity} score={k.cvss_score} compact /> : null}
                  </View>
                  <T variant="small" numberOfLines={2} style={{ marginTop: 2 }}>{k.name ?? `${k.vendor} ${k.product}`}</T>
                  <T variant="tiny" style={{ marginTop: 2 }}>Added {fmtUtcDate(k.date_added)}</T>
                </View>
              </Pressable>
            ))}
          </Card>
        )}

        <SectionHeader title="Severity distribution" />
        <Card>
          <SeverityDonut data={s.severity} onSelect={(sev) => router.push(sev === 'CRITICAL' ? '/critical' : '/cves')} />
        </Card>

        <SectionHeader title="Latest CVEs" right={<TextLink label="View all" onPress={() => router.push('/cves')} />} />
        {s.latestCves.length ? s.latestCves.map((v) => <CveCard key={v.id} v={v} />) : <Card><T variant="small">No CVEs stored yet.</T></Card>}

        <SectionHeader title="Articles by source" />
        <Card>
          {s.bySource.length ? (
            <BarList rows={s.bySource.map((r) => ({ key: r.source_id, label: r.name, n: r.n }))} onPress={() => router.push('/news')} />
          ) : (
            <T variant="small">No articles stored yet.</T>
          )}
        </Card>
      </ScrollView>
      <Fab label={syncing ? 'Syncing' : 'Sync'} icon={RefreshCw} loading={syncing} onPress={() => void syncNow()} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  stat: { borderRadius: radius.lg, padding: space.lg, minHeight: 128, overflow: 'hidden' },
  hero: { borderRadius: radius.xl, padding: space.xl },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: radius.full, overflow: 'hidden' },
  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space.lg, paddingVertical: space.md },
});
