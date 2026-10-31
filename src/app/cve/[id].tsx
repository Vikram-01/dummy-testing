import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Bookmark, BookmarkCheck, CircleCheck, CircleHelp, ExternalLink, FileWarning, Link2, Newspaper, Package, RefreshCw, Share2, ShieldAlert, ShieldCheck, Skull, TriangleAlert, Wrench } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { listArticles } from '../../lib/repo/articles';
import { CVE_ID_RE, getCve, getKev } from '../../lib/repo/cves';
import { toggleBookmark } from '../../lib/repo/library';
import type { AffectedRow, ArticleRow, KevRow } from '../../lib/repo/types';
import { getSecret } from '../../lib/secrets';
import { enrichCve } from '../../lib/sync/enrich';
import { applyKevFlags } from '../../lib/sync/kev';
import { fetchNvdCve } from '../../lib/sync/nvd';
import type { SyncContext } from '../../lib/sync/context';
import { useApp, useDb } from '../../ui/AppState';
import { ArticleCard, SeverityBadge, Tag } from '../../ui/components/cards';
import { Button, Card, EmptyState, ErrorBanner, IconButton, Loading, SectionHeader, T } from '../../ui/components/primitives';
import { fmtDate, fmtUtcDate, hostOf, timeAgo } from '../../ui/format';
import { space, useTheme } from '../../ui/theme';

type Detail = NonNullable<Awaited<ReturnType<typeof getCve>>>;

const SOURCE_LABEL: Record<string, string> = { nvd: 'NVD (CPE)', ghsa: 'GitHub Advisory', 'cve.org': 'CVE.org (CNA)', osv: 'OSV.dev' };

function makeCtx(db: SyncContext['db'], nvdApiKey: string | null): SyncContext {
  const noop = async () => {};
  return {
    db, fetch: (u, i) => fetch(u, i), now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: { info: noop, warn: noop, error: noop }, retentionDays: 5, nvdApiKey,
  };
}

function Fact({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <View style={styles.fact}>
      <T variant="label">{label}</T>
      {typeof value === 'string' ? <T variant={mono ? 'mono' : 'body'} style={{ marginTop: 2 }}>{value}</T> : value}
    </View>
  );
}

export default function CveDetail() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = String(raw ?? '').toUpperCase();
  const db = useDb();
  const c = useTheme();
  const { bump } = useApp();
  const [d, setD] = useState<Detail | null | undefined>(undefined);
  const [kevOnly, setKevOnly] = useState<KevRow | null>(null);
  const [news, setNews] = useState<ArticleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const det = await getCve(db, id);
    setD(det);
    if (!det && CVE_ID_RE.test(id)) setKevOnly(await getKev(db, id));
    if (CVE_ID_RE.test(id)) setNews(await listArticles(db, { cveId: id }, 10));
    return det;
  }, [db, id]);

  const refresh = useCallback(async (fromNvd: boolean) => {
    const key = await getSecret('nvdApiKey');
    setBusy(true);
    setErr(null);
    try {
      const ctx = makeCtx(db, key);
      if (fromNvd) {
        const ok = await fetchNvdCve(ctx, id);
        if (!ok) setErr('NVD has no record for this ID yet.');
      }
      const r = await enrichCve(ctx, id);
      await applyKevFlags(db);
      if (r.errors.length) setErr(r.errors.join(' · '));
      await load();
      bump();
    } catch (e) {
      setErr(`Could not reach the vulnerability databases: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [db, id, load, bump]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const det = await load();
      if (!alive || !CVE_ID_RE.test(id)) return;
      // Fetch on demand (e.g. a KEV entry not yet stored) or enrich if never done.
      if (!det) await refresh(true);
      else if (!det.cve.enriched_at) await refresh(false);
    })();
    return () => {
      alive = false;
    };
  }, [id, load, refresh]);

  if (d === undefined) return <Loading />;
  if (!d) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.md }}>
        <Stack.Screen options={{ title: id }} />
        {busy ? <Loading label="Fetching from NVD, CVE.org and OSV.dev" /> : null}
        {err ? <ErrorBanner message={err} onRetry={() => refresh(true)} /> : null}
        {kevOnly ? (
          <Card style={{ marginTop: space.md }}>
            <T variant="h3">{kevOnly.name}</T>
            <T variant="small" style={{ marginTop: 4 }}>{kevOnly.description}</T>
            <T variant="tiny" style={{ marginTop: 8 }}>Listed in CISA KEV on {fmtUtcDate(kevOnly.date_added)}</T>
          </Card>
        ) : !busy ? (
          <EmptyState title="Not stored locally" body="This vulnerability is outside the retention window or not yet published." />
        ) : null}
      </ScrollView>
    );
  }

  const v = d.cve;
  const kev = d.kev;
  const bySource = d.affected.reduce<Record<string, AffectedRow[]>>((acc, a) => ((acc[a.source] ??= []).push(a), acc), {});
  const patchRefs = d.references.filter((r) => /patch|vendor advisory|fix|release notes/i.test(r.tags));
  const exploitRefs = d.references.filter((r) => /exploit/i.test(r.tags));
  const open = (url: string) => router.push({ pathname: '/browser', params: { url } });

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 56 }}>
      <Stack.Screen
        options={{
          title: v.id,
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconButton icon={v.bookmarked ? BookmarkCheck : Bookmark} color={v.bookmarked ? c.accent : c.text} label="Bookmark" onPress={async () => { await toggleBookmark(db, 'cve', v.id); await load(); bump(); }} />
              <IconButton icon={Share2} color={c.text} label="Share" onPress={() => Share.share({ message: `${v.id}${v.title ? ` — ${v.title}` : ''}\nhttps://nvd.nist.gov/vuln/detail/${v.id}` })} />
            </View>
          ),
        }}
      />

      <View style={[styles.hero, { backgroundColor: c.sevSoft[v.severity] }]}>
        <View style={styles.row}>
          <T variant="mono" color={c.sevOn[v.severity]} style={{ fontSize: 16, fontWeight: '800' }}>{v.id}</T>
          <View style={{ flex: 1 }} />
          <SeverityBadge severity={v.severity} score={v.cvss_score} />
        </View>
        {v.title ? <T variant="h2" color={c.sevOn[v.severity]} style={{ marginTop: space.sm }}>{v.title}</T> : null}
        <View style={[styles.row, { flexWrap: 'wrap', gap: 6, marginTop: space.sm }]}>
          {v.kev ? <Tag label="Exploitation verified by CISA KEV" color={c.danger} icon={ShieldAlert} /> : <Tag label="Not in CISA KEV" icon={ShieldCheck} />}
          {v.kev_ransomware === 'Known' ? <Tag label="Known ransomware campaign use" color={c.danger} icon={Skull} /> : null}
          {v.patch_available ? <Tag label="Fix or advisory referenced" color={c.ok} icon={Wrench} /> : <Tag label="No fix referenced yet" icon={CircleHelp} />}
        </View>
      </View>

      {err ? <View style={{ marginTop: space.md }}><ErrorBanner message={err} onRetry={() => refresh(false)} /></View> : null}

      <SectionHeader title="Description" />
      <Card><T variant="body">{v.description ?? 'No description has been published yet.'}</T></Card>

      <SectionHeader title="Scoring" />
      <Card style={styles.facts}>
        <Fact label="CVSS score" value={v.cvss_score != null ? v.cvss_score.toFixed(1) : 'Not scored'} />
        <Fact label="CVSS version" value={v.cvss_version ?? '—'} />
        <Fact label="Severity" value={v.severity === 'UNKNOWN' ? 'Unknown' : v.severity} />
        <Fact label="NVD status" value={v.vuln_status ?? '—'} />
        <Fact label="Published" value={fmtDate(v.published_at, true)} />
        <Fact label="Last modified" value={`${fmtDate(v.last_modified_at, true)}`} />
        <Fact label="CWE" value={v.cwes ? v.cwes.split(',').join(', ') : '—'} mono />
        <Fact label="Data sources" value={v.data_sources.split(',').map((s) => SOURCE_LABEL[s] ?? s).join(', ')} />
        {v.cvss_vector ? <View style={{ width: '100%' }}><Fact label="Vector" value={v.cvss_vector} mono /></View> : null}
      </Card>

      <SectionHeader title="Exploitation" />
      <Card style={{ gap: space.sm }}>
        {kev ? (
          <>
            <View style={styles.row}><ShieldAlert size={16} color={c.danger} /><T variant="h3" style={{ marginLeft: 6 }}>Verified: actively exploited</T></View>
            <T variant="small">CISA added this CVE to the Known Exploited Vulnerabilities catalog on {fmtUtcDate(kev.date_added)}. Federal remediation due {fmtUtcDate(kev.due_date)}.</T>
            <T variant="small">Known ransomware campaign use: <T variant="small" color={kev.ransomware === 'Known' ? c.danger : c.text} style={{ fontWeight: '700' }}>{kev.ransomware ?? 'Not stated'}</T></T>
            {kev.notes ? <T variant="tiny">CISA notes: {kev.notes}</T> : null}
          </>
        ) : (
          <View style={styles.row}><CircleCheck size={16} color={c.textMuted} /><T variant="small" style={{ marginLeft: 6, flex: 1 }}>No confirmed exploitation: not listed in CISA KEV.</T></View>
        )}
        {exploitRefs.length ? (
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <TriangleAlert size={16} color={c.warn} />
            <T variant="small" style={{ marginLeft: 6, flex: 1 }}>
              Unverified: NVD tags {exploitRefs.length} reference{exploitRefs.length > 1 ? 's' : ''} as &ldquo;Exploit&rdquo; (public proof-of-concept or write-up). This is not confirmation of in-the-wild exploitation.
            </T>
          </View>
        ) : null}
      </Card>

      <SectionHeader title="Remediation" />
      <Card style={{ gap: space.sm }}>
        {kev?.required_action ? <T variant="body"><T variant="body" style={{ fontWeight: '700' }}>CISA required action: </T>{kev.required_action}</T> : null}
        {v.remediation ? <T variant="small">{v.remediation}</T> : null}
        {d.affected.filter((a) => a.fixed_version).slice(0, 6).map((a) => (
          <T key={a.id} variant="small">Fixed in <T variant="mono">{a.fixed_version}</T> for {a.product}{a.ecosystem ? ` (${a.ecosystem})` : ''} — per {SOURCE_LABEL[a.source] ?? a.source}</T>
        ))}
        {patchRefs.slice(0, 5).map((r) => (
          <Pressable key={r.id} onPress={() => open(r.url)} style={styles.row}>
            <Wrench size={14} color={c.accent} />
            <T variant="small" color={c.accent} numberOfLines={1} style={{ marginLeft: 6, flex: 1 }}>{hostOf(r.url)} — {r.tags.split(',').filter(Boolean).join(', ')}</T>
          </Pressable>
        ))}
        {!kev?.required_action && !v.remediation && !patchRefs.length && !d.affected.some((a) => a.fixed_version) ? (
          <T variant="small">No remediation guidance has been published in the connected sources yet.</T>
        ) : null}
      </Card>

      <SectionHeader title="Affected products" right={<T variant="tiny">{d.affected.length} entries</T>} />
      <Card>
        {d.affected.length === 0 ? (
          <T variant="small">No affected product data published yet. NVD analysis and CNA records often arrive after initial disclosure.</T>
        ) : (
          Object.entries(bySource).map(([src, rows]) => (
            <View key={src} style={{ marginBottom: space.md }}>
              <T variant="label" style={{ marginBottom: 4 }}>{SOURCE_LABEL[src] ?? src}</T>
              {rows.slice(0, 25).map((a) => (
                <View key={a.id} style={[styles.affected, { borderColor: c.border }]}>
                  <Package size={13} color={c.textFaint} />
                  <View style={{ flex: 1 }}>
                    <T variant="small" color={c.text} style={{ fontWeight: '600' }}>{[a.vendor, a.product].filter(Boolean).join(' / ')}{a.ecosystem ? ` (${a.ecosystem})` : ''}</T>
                    <T variant="mono" style={{ fontSize: 11 }}>{a.version_spec}</T>
                  </View>
                </View>
              ))}
              {rows.length > 25 ? <T variant="tiny">+{rows.length - 25} more</T> : null}
            </View>
          ))
        )}
        <Button label={busy ? 'Refreshing…' : 'Refresh from CVE.org and OSV.dev'} kind="secondary" icon={RefreshCw} loading={busy} onPress={() => refresh(true)} />
        {v.enriched_at ? <T variant="tiny" style={{ marginTop: 6, textAlign: 'center' }}>Enriched {timeAgo(v.enriched_at)}</T> : null}
      </Card>

      <SectionHeader title={`References (${d.references.length})`} />
      <Card style={{ paddingVertical: 4 }}>
        <Pressable onPress={() => open(`https://nvd.nist.gov/vuln/detail/${v.id}`)} style={[styles.ref, { borderColor: c.border }]}>
          <ExternalLink size={14} color={c.accent} />
          <T variant="small" color={c.accent} style={{ flex: 1 }}>NVD detail page</T>
        </Pressable>
        <Pressable onPress={() => open(`https://www.cve.org/CVERecord?id=${v.id}`)} style={[styles.ref, { borderColor: c.border }]}>
          <ExternalLink size={14} color={c.accent} />
          <T variant="small" color={c.accent} style={{ flex: 1 }}>CVE.org record</T>
        </Pressable>
        {d.references.slice(0, 60).map((r) => (
          <Pressable key={r.id} onPress={() => open(r.url)} style={[styles.ref, { borderColor: c.border }]}>
            {/exploit/i.test(r.tags) ? <FileWarning size={14} color={c.warn} /> : <Link2 size={14} color={c.textFaint} />}
            <View style={{ flex: 1 }}>
              <T variant="small" color={c.text} numberOfLines={1}>{hostOf(r.url)}</T>
              {r.tags ? <T variant="tiny" numberOfLines={1}>{r.tags.split(',').join(' · ')}</T> : null}
            </View>
          </Pressable>
        ))}
      </Card>

      {news.length ? (
        <>
          <SectionHeader title="In the news" right={<Newspaper size={14} color={c.textFaint} />} />
          {news.map((a) => <ArticleCard key={a.id} a={a} />)}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hero: { borderRadius: 28, padding: space.xl },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  fact: { width: '50%', paddingRight: space.sm },
  affected: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
  ref: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
