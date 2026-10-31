import { ChevronDown, ChevronRight, CircleAlert, CircleCheck, CircleDashed, CircleX, Info, RefreshCw, TriangleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { listRunLogs, listRuns, listSources } from '../../lib/repo/stats';
import type { SourceRow, SyncLogRow, SyncRunRow } from '../../lib/repo/types';
import { nextScheduledSync } from '../../lib/sync/engine';
import { useApp, useDb } from '../../ui/AppState';
import { Button, Card, Chip, SectionHeader, T } from '../../ui/components/primitives';
import { fmtDate, fmtDuration, timeAgo } from '../../ui/format';
import { space, useTheme } from '../../ui/theme';

function RunStatusIcon({ status }: { status: SyncRunRow['status'] }) {
  const c = useTheme();
  if (status === 'success') return <CircleCheck size={18} color={c.ok} />;
  if (status === 'partial') return <TriangleAlert size={18} color={c.warn} />;
  if (status === 'running') return <ActivityIndicator size="small" color={c.accent} />;
  if (status === 'interrupted') return <CircleDashed size={18} color={c.textFaint} />;
  return <CircleX size={18} color={c.danger} />;
}

function RunRow({ run }: { run: SyncRunRow }) {
  const db = useDb();
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<SyncLogRow[] | null>(null);
  const toggle = async () => {
    if (!open && !logs) setLogs(await listRunLogs(db, run.id));
    setOpen(!open);
  };
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <Card style={{ marginBottom: space.sm }} onPress={toggle} accessibilityLabel={`Sync run ${run.status}`}>
      <View style={styles.row}>
        <RunStatusIcon status={run.status} />
        <View style={{ flex: 1, marginLeft: space.sm }}>
          <T variant="h3">{fmtDate(run.started_at, true)}</T>
          <T variant="tiny">
            {run.trigger} · {run.status}
            {run.finished_at ? ` · ${fmtDuration(run.finished_at - run.started_at)}` : ''}
          </T>
        </View>
        <Chevron size={16} color={c.textFaint} />
      </View>
      {run.message ? <T variant="small" style={{ marginTop: 6 }}>{run.message}</T> : null}
      {open && logs ? (
        <View style={{ marginTop: space.sm, gap: 6 }}>
          {logs.map((l) => (
            <View key={l.id} style={styles.logRow}>
              {l.level === 'error' ? <CircleAlert size={13} color={c.danger} /> : l.level === 'warn' ? <TriangleAlert size={13} color={c.warn} /> : <Info size={13} color={c.textFaint} />}
              <T variant="tiny" color={c.textMuted} style={{ flex: 1 }}>
                <T variant="tiny" color={c.text} style={{ fontWeight: '700' }}>{l.source_id ?? 'sync'}</T> {l.message}
                {l.duration_ms != null ? ` (${fmtDuration(l.duration_ms)})` : ''}
              </T>
            </View>
          ))}
          {logs.length === 0 ? <T variant="tiny">No log entries.</T> : null}
        </View>
      ) : null}
    </Card>
  );
}

function SourceStatus({ s, onSync, busy }: { s: SourceRow; onSync: () => void; busy: boolean }) {
  const c = useTheme();
  const tone = s.last_status === 'ok' ? c.ok : s.last_status === 'error' ? c.danger : c.textFaint;
  return (
    <View style={[styles.sourceRow, { borderColor: c.outlineVariant }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <View style={{ flex: 1 }}>
        <T variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>{s.name}</T>
        <T variant="tiny" numberOfLines={2} color={s.last_status === 'error' ? c.danger : undefined}>
          {s.last_status === 'error' ? `${s.last_error ?? 'Error'} · ${s.consecutive_failures} failure(s) in a row` : s.last_success_at ? `OK ${timeAgo(s.last_success_at)} · ${s.last_item_count ?? 0} new last run` : 'Not synced yet'}
        </T>
      </View>
      {s.kind === 'news' || ['nvd', 'cisa-kev', 'ghsa'].includes(s.id) ? (
        <Pressable onPress={onSync} disabled={busy} hitSlop={8} accessibilityLabel={`Sync ${s.name}`} style={{ padding: 6, opacity: busy ? 0.4 : 1 }}>
          <RefreshCw size={15} color={c.accent} />
        </Pressable>
      ) : (
        <T variant="tiny">on demand</T>
      )}
    </View>
  );
}

export default function SyncHistory() {
  const db = useDb();
  const c = useTheme();
  const { syncNow, syncing, progress, dataVersion, settings, backgroundStatus } = useApp();
  const [runs, setRuns] = useState<SyncRunRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [kind, setKind] = useState<'news' | 'cve'>('cve');

  const load = useCallback(async () => {
    const [r, s, n] = await Promise.all([listRuns(db, 50), listSources(db), nextScheduledSync(db)]);
    setRuns(r);
    setSources(s);
    setNext(n);
  }, [db]);
  useEffect(() => {
    // Data loads asynchronously; state is only set after the query resolves.
    (async () => {
      await load();
    })();
  }, [load, dataVersion]);

  const failing = sources.filter((s) => s.last_status === 'error').length;

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={c.accent} colors={[c.accent]} />}>
      <Card style={{ gap: space.sm }}>
        <T variant="h3">Automatic synchronization</T>
        <T variant="small">
          Runs every {settings.syncIntervalMinutes} minutes in the background
          {backgroundStatus === 'restricted' ? ' — background work is restricted on this device, so syncs run when the app is opened.' : '.'} Next scheduled: {next ? `${fmtDate(next, true)} (${timeAgo(next)})` : 'after the first sync'}.
        </T>
        <T variant="small">Data older than {settings.retentionDays} days is removed after each sync (bookmarks are kept).</T>
        {syncing && progress ? <T variant="tiny" color={c.accent} numberOfLines={2}>{progress}</T> : null}
        <Button label={syncing ? 'Syncing…' : 'Sync all sources now'} icon={RefreshCw} loading={syncing} onPress={() => syncNow()} />
      </Card>

      <SectionHeader title={`Source status${failing ? ` · ${failing} unavailable` : ''}`} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.sm }}>
        <Chip label="CVE feeds" active={kind === 'cve'} onPress={() => setKind('cve')} />
        <Chip label="News feeds" active={kind === 'news'} onPress={() => setKind('news')} />
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {sources.filter((s) => s.kind === kind).map((s) => (
          <SourceStatus key={s.id} s={s} busy={syncing} onSync={() => syncNow([s.id])} />
        ))}
      </Card>

      <SectionHeader title="Recent runs" />
      {runs.length === 0 ? <Card><T variant="small">No sync runs yet.</T></Card> : runs.map((r) => <RunRow key={r.id} run={r} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  logRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
