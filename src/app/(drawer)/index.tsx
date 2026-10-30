import { router, useFocusEffect } from 'expo-router';
import { ArrowRight, Bug, CalendarClock, CircleAlert, CircleCheck, Clock, Flame, Newspaper, ShieldAlert, Skull, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { dashboardStats, type DashboardStats } from '../../lib/repo/stats';
import { nextScheduledSync } from '../../lib/sync/engine';
import { useApp, useDb } from '../../ui/AppState';
import { CveCard, SeverityBadge } from '../../ui/components/cards';
import { BarList, SeverityDonut } from '../../ui/components/charts';
import { Card, EmptyState, ErrorBanner, Loading, SectionHeader, T } from '../../ui/components/primitives';
import { fmtDate, fmtUtcDate, timeAgo } from '../../ui/format';
import { radius, space, useTheme } from '../../ui/theme';

function Stat({ icon: Icon, label, value, tone, onPress }: { icon: LucideIcon; label: string; value: number | string; tone?: string; onPress?: () => void }) {
  const c = useTheme();
  return (
    <Card onPress={onPress} style={styles.stat} accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.statIcon, { backgroundColor: (tone ?? c.accent) + '1F' }]}>
        <Icon size={16} color={tone ?? c.accent} />
      </View>
      <T variant="h1" style={{ marginTop: space.sm }}>{value}</T>
      <T variant="small" numberOfLines={1}>{label}</T>
    </Card>
  );
}

export default function Overview() {
  const db = useDb();
  const c = useTheme();
  const { settings, syncing, syncNow, dataVersion, progress } = useApp();
  const { width } = useWindowDimensions();
  const [s, setS] = useState<DashboardStats | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [stats, nxt] = await Promise.all([dashboardStats(db, settings.retentionDays), nextScheduledSync(db)]);
      setS(stats);
      setNext(nxt);
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

  if (!s) return error ? <View style={{ padding: space.md }}><ErrorBanner message={error} onRetry={load} /></View> : <Loading label="Loading dashboard" />;

  const cols = width >= 700 ? 4 : 2;
  const statW = `${100 / cols - 2}%` as const;
  const empty = s.totalArticles === 0 && s.totalCves === 0;
  const runTone = s.lastRun?.status === 'success' ? c.ok : s.lastRun?.status === 'partial' ? c.warn : s.lastRun ? c.danger : c.textFaint;
  const RunIcon = s.lastRun?.status === 'success' ? CircleCheck : s.lastRun?.status === 'partial' ? TriangleAlert : CircleAlert;

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.md, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} tintColor={c.accent} colors={[c.accent]} progressBackgroundColor={c.surface} />}
    >
      {/* Sync status strip */}
      <Card onPress={() => router.push('/sync')} style={{ marginBottom: space.md }} accessibilityLabel="Synchronization status">
        <View style={styles.row}>
          <RunIcon size={18} color={syncing ? c.accent : runTone} />
          <View style={{ flex: 1, marginLeft: space.sm }}>
            <T variant="h3">{syncing ? 'Synchronizing…' : s.lastRun ? `Last sync ${s.lastRun.status}` : 'Not synced yet'}</T>
            <T variant="small" numberOfLines={1}>
              {syncing ? progress ?? 'Contacting sources' : `Last successful: ${s.lastSuccessAt ? `${fmtDate(s.lastSuccessAt, true)} (${timeAgo(s.lastSuccessAt)})` : 'never'}`}
            </T>
          </View>
          <ArrowRight size={16} color={c.textFaint} />
        </View>
        <View style={[styles.row, { marginTop: space.sm, gap: space.lg, flexWrap: 'wrap' }]}>
          <View style={[styles.row, { gap: 5 }]}>
            <CalendarClock size={13} color={c.textFaint} />
            <T variant="tiny">Next scheduled: {next ? `${fmtDate(next, true)} (${timeAgo(next)})` : 'on first sync'}</T>
          </View>
          <View style={[styles.row, { gap: 5 }]}>
            <Clock size={13} color={c.textFaint} />
            <T variant="tiny">Every {settings.syncIntervalMinutes} min · keeps {settings.retentionDays} days</T>
          </View>
          {s.sourcesFailing ? <T variant="tiny" color={c.warn}>{s.sourcesFailing} of {s.sourcesTotal} sources unavailable</T> : null}
        </View>
      </Card>

      {empty && !syncing ? (
        <EmptyState icon={ShieldAlert} title="Welcome to Vigil" body="Run the first sync to pull the last few days of security news, CVEs and CISA KEV data into local storage." action={{ label: 'Sync now', onPress: () => syncNow() }} />
      ) : null}

      <View style={styles.grid}>
        <View style={{ width: statW }}><Stat icon={Newspaper} label="Articles stored" value={s.totalArticles} onPress={() => router.push('/news')} /></View>
        <View style={{ width: statW }}><Stat icon={Clock} label="Published today" value={s.articlesToday} onPress={() => router.push('/news')} /></View>
        <View style={{ width: statW }}><Stat icon={Flame} label="Critical CVEs" value={s.criticalCves} tone={c.sev.CRITICAL} onPress={() => router.push('/critical')} /></View>
        <View style={{ width: statW }}><Stat icon={Bug} label="High CVEs" value={s.highCves} tone={c.sev.HIGH} onPress={() => router.push('/cves')} /></View>
        <View style={{ width: statW }}><Stat icon={ShieldAlert} label={`New KEV (${settings.retentionDays}d)`} value={s.kevInWindow} tone={c.danger} onPress={() => router.push('/kev')} /></View>
        <View style={{ width: statW }}><Stat icon={TriangleAlert} label="CVSS 9.0+" value={s.cvss9Plus} tone={c.sev.CRITICAL} onPress={() => router.push('/critical')} /></View>
        <View style={{ width: statW }}><Stat icon={Bug} label="CVEs stored" value={s.totalCves} onPress={() => router.push('/cves')} /></View>
        <View style={{ width: statW }}><Stat icon={ShieldAlert} label="KEV catalog" value={s.kevTotal} onPress={() => router.push('/kev')} /></View>
      </View>

      <SectionHeader title="Exploited vulnerability alerts" right={<Pressable onPress={() => router.push('/kev')} hitSlop={8}><T variant="small" color={c.accent} style={{ fontWeight: '700' }}>CISA KEV</T></Pressable>} />
      {s.exploitedAlerts.length === 0 ? (
        <Card><T variant="small">No new CISA KEV additions in the last {settings.retentionDays} days.</T></Card>
      ) : (
        s.exploitedAlerts.map((k) => (
          <Card key={k.cve_id} onPress={() => router.push(`/cve/${k.cve_id}`)} style={[styles.alert, { borderLeftColor: c.danger }]}>
            <View style={styles.row}>
              <T variant="mono" style={{ fontWeight: '700' }}>{k.cve_id}</T>
              <View style={{ width: 8 }} />
              {k.severity ? <SeverityBadge severity={k.severity} score={k.cvss_score} compact /> : null}
              {k.ransomware === 'Known' ? <Skull size={14} color={c.danger} style={{ marginLeft: 8 }} /> : null}
              <View style={{ flex: 1 }} />
              <T variant="tiny">{fmtUtcDate(k.date_added)}</T>
            </View>
            <T variant="small" color={c.text} numberOfLines={2} style={{ marginTop: 4 }}>{k.name ?? `${k.vendor} ${k.product}`}</T>
          </Card>
        ))
      )}

      <SectionHeader title="Severity distribution" />
      <Card>
        <SeverityDonut data={s.severity} onSelect={(sev) => router.push(sev === 'CRITICAL' ? '/critical' : '/cves')} />
      </Card>

      <SectionHeader title="Latest CVEs" right={<Pressable onPress={() => router.push('/cves')} hitSlop={8}><T variant="small" color={c.accent} style={{ fontWeight: '700' }}>View all</T></Pressable>} />
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
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  stat: { padding: space.md },
  statIcon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  alert: { borderLeftWidth: 3, marginBottom: space.sm },
});
