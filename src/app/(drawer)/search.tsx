import { BookmarkPlus, Bug, Newspaper, Search as SearchIcon, Star, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { countArticles, listArticles, type ArticleFilter } from '../../lib/repo/articles';
import { countCves, listCves, type CveFilter } from '../../lib/repo/cves';
import { deleteSavedSearch, listSavedSearches, saveSearch, type SavedSearch, type SavedSearchQuery } from '../../lib/repo/library';
import type { ArticleRow, CveRow, Severity } from '../../lib/repo/types';
import { useApp, useDb } from '../../ui/AppState';
import { ArticleCard, CveCard } from '../../ui/components/cards';
import { countActive, CveFilters, CveFilterSheet, EMPTY_CVE, EMPTY_NEWS, FilterButton, NewsFilters, NewsFilterSheet, SearchInput } from '../../ui/components/filters';
import { Button, Card, Chip, EmptyState, Loading, SectionHeader, T } from '../../ui/components/primitives';
import { useDebounced } from '../../ui/screens/NewsScreen';
import { font, fonts, radius, space, useTheme } from '../../ui/theme';

type Scope = 'all' | 'news' | 'cves';

export default function Search() {
  const db = useDb();
  const c = useTheme();
  const { dataVersion } = useApp();
  const [scope, setScope] = useState<Scope>('all');
  const [q, setQ] = useState('');
  const [cveId, setCveId] = useState('');
  const dq = useDebounced(q, 300);
  const dId = useDebounced(cveId, 300);
  const [nf, setNf] = useState<NewsFilters>(EMPTY_NEWS);
  const [cf, setCf] = useState<CveFilters>(EMPTY_CVE);
  const [sheet, setSheet] = useState<'news' | 'cve' | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [naming, setNaming] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; articles: ArticleRow[]; cves: CveRow[]; nA: number; nC: number } | null>(null);

  const active = !!(dq.trim() || dId.trim() || countActive(nf) || countActive(cf));

  const aFilter: ArticleFilter = useMemo(() => ({ q: dq, cveId: dId || undefined, sourceIds: nf.sourceIds, categories: nf.categories, days: nf.days ?? undefined }), [dq, dId, nf]);
  const cFilter: CveFilter = useMemo(
    () => ({ q: dq, cveId: dId || undefined, severities: cf.severities, minScore: cf.minScore ?? undefined, vendor: cf.vendor || undefined, product: cf.product || undefined, exploitedOnly: cf.exploitedOnly, days: cf.days ?? undefined, sort: cf.sort }),
    [dq, dId, cf],
  );

  const queryKey = useMemo(() => JSON.stringify({ scope, aFilter, cFilter }), [scope, aFilter, cFilter]);
  const res = active && result?.key === queryKey ? result : null;
  const loading = active && !res;

  const refreshSaved = useCallback(async () => setSaved(await listSavedSearches(db)), [db]);
  useEffect(() => {
    // Data loads asynchronously; state is only set after the query resolves.
    (async () => {
      await refreshSaved();
    })();
  }, [refreshSaved]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    (async () => {
      const wantA = scope !== 'cves';
      const wantC = scope !== 'news';
      const [articles, cves, nA, nC] = await Promise.all([
        wantA ? listArticles(db, aFilter, scope === 'all' ? 15 : 60) : Promise.resolve([]),
        wantC ? listCves(db, cFilter, scope === 'all' ? 15 : 60) : Promise.resolve([]),
        wantA ? countArticles(db, aFilter) : Promise.resolve(0),
        wantC ? countCves(db, cFilter) : Promise.resolve(0),
      ]);
      if (alive) setResult({ key: queryKey, articles, cves, nA, nC });
    })().catch(() => alive && setResult({ key: queryKey, articles: [], cves: [], nA: 0, nC: 0 }));
    return () => {
      alive = false;
    };
  }, [db, aFilter, cFilter, scope, active, dataVersion, queryKey]);

  const currentQuery = (): SavedSearchQuery => ({
    scope, q: dq || undefined, cveId: dId || undefined,
    sourceIds: nf.sourceIds, categories: nf.categories, days: nf.days ?? cf.days ?? undefined,
    severities: cf.severities, minScore: cf.minScore ?? undefined, vendor: cf.vendor || undefined, product: cf.product || undefined, exploitedOnly: cf.exploitedOnly,
  });

  const applySaved = (s: SavedSearch) => {
    const x = s.query;
    setScope(x.scope);
    setQ(x.q ?? '');
    setCveId(x.cveId ?? '');
    setNf({ sourceIds: x.sourceIds ?? [], categories: x.categories ?? [], days: x.days ?? null });
    setCf({ ...EMPTY_CVE, severities: (x.severities ?? []) as Severity[], minScore: x.minScore ?? null, vendor: x.vendor ?? '', product: x.product ?? '', exploitedOnly: !!x.exploitedOnly, days: x.days ?? null });
  };

  const input = [styles.input, { backgroundColor: c.surfaceContainerHigh, borderColor: 'transparent', color: c.onSurface, fontFamily: fonts.regular }];

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.sm }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search news and vulnerabilities" />
          <TextInput style={input} value={cveId} onChangeText={(t) => setCveId(t.replace(/[^0-9a-zA-Z-]/g, ''))} placeholder="CVE ID (e.g. CVE-2026-1234)" placeholderTextColor={c.textFaint} autoCapitalize="characters" autoCorrect={false} maxLength={24} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Everything" icon={SearchIcon} active={scope === 'all'} onPress={() => setScope('all')} />
            <Chip label="News" icon={Newspaper} active={scope === 'news'} onPress={() => setScope('news')} />
            <Chip label="CVEs" icon={Bug} active={scope === 'cves'} onPress={() => setScope('cves')} />
            {scope !== 'cves' ? <FilterButton count={countActive(nf)} onPress={() => setSheet('news')} /> : null}
            {scope !== 'news' ? <Chip label={countActive(cf) ? `CVE filters (${countActive(cf)})` : 'CVE filters'} active={countActive(cf) > 0} onPress={() => setSheet('cve')} /> : null}
          </ScrollView>
        </View>

        {naming != null ? (
          <Card style={{ marginTop: space.md, gap: space.sm }}>
            <T variant="h3">Save this search</T>
            <TextInput style={input} value={naming} onChangeText={setNaming} placeholder="Name" placeholderTextColor={c.textFaint} maxLength={80} autoFocus />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><Button label="Cancel" kind="secondary" icon={X} onPress={() => setNaming(null)} /></View>
              <View style={{ flex: 1 }}>
                <Button label="Save" icon={Star} onPress={async () => { await saveSearch(db, naming, currentQuery()); setNaming(null); refreshSaved(); }} />
              </View>
            </View>
          </Card>
        ) : null}

        {!active ? (
          <>
            <SectionHeader title="Saved searches" />
            {saved.length === 0 ? (
              <Card><T variant="small">Run a search with any filters, then save it here for one-tap access.</T></Card>
            ) : (
              saved.map((s) => (
                <Card key={s.id} onPress={() => applySaved(s)} style={{ marginBottom: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Star size={16} color={c.accent} />
                    <View style={{ flex: 1 }}>
                      <T variant="h3">{s.name}</T>
                      <T variant="tiny" numberOfLines={1}>{describe(s.query)}</T>
                    </View>
                    <Pressable hitSlop={10} accessibilityLabel={`Delete ${s.name}`} onPress={() => Alert.alert('Delete saved search?', s.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSavedSearch(db, s.id); refreshSaved(); } }])}>
                      <Trash2 size={16} color={c.textFaint} />
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </>
        ) : loading ? (
          <Loading label="Searching" />
        ) : res ? (
          <>
            <View style={{ marginTop: space.md }}>
              <Button label="Save search" kind="secondary" icon={BookmarkPlus} onPress={() => setNaming(dq || dId || 'Saved search')} />
            </View>
            {scope !== 'news' ? (
              <>
                <SectionHeader title={`Vulnerabilities (${res.nC})`} right={scope === 'all' && res.nC > res.cves.length ? <Pressable onPress={() => setScope('cves')}><T variant="small" color={c.accent} style={{ fontWeight: '700' }}>Show all</T></Pressable> : null} />
                {res.cves.length ? res.cves.map((v) => <CveCard key={v.id} v={v} />) : <T variant="small">No matching CVEs.</T>}
              </>
            ) : null}
            {scope !== 'cves' ? (
              <>
                <SectionHeader title={`News (${res.nA})`} right={scope === 'all' && res.nA > res.articles.length ? <Pressable onPress={() => setScope('news')}><T variant="small" color={c.accent} style={{ fontWeight: '700' }}>Show all</T></Pressable> : null} />
                {res.articles.length ? res.articles.map((a) => <ArticleCard key={a.id} a={a} />) : <T variant="small">No matching articles.</T>}
              </>
            ) : null}
            {res.nA + res.nC === 0 ? <EmptyState icon={SearchIcon} title="No results" body="Search covers everything stored locally (the retention window plus bookmarks)." /> : null}
          </>
        ) : null}
      </ScrollView>
      <NewsFilterSheet visible={sheet === 'news'} onClose={() => setSheet(null)} value={nf} onChange={setNf} />
      <CveFilterSheet visible={sheet === 'cve'} onClose={() => setSheet(null)} value={cf} onChange={setCf} />
    </>
  );
}

function describe(q: SavedSearchQuery): string {
  const parts: string[] = [q.scope === 'all' ? 'Everything' : q.scope === 'news' ? 'News' : 'CVEs'];
  if (q.q) parts.push(`"${q.q}"`);
  if (q.cveId) parts.push(q.cveId);
  if (q.severities?.length) parts.push(q.severities.join('/').toLowerCase());
  if (q.minScore != null) parts.push(`CVSS ${q.minScore}+`);
  if (q.vendor) parts.push(`vendor ${q.vendor}`);
  if (q.product) parts.push(`product ${q.product}`);
  if (q.exploitedOnly) parts.push('exploited');
  if (q.categories?.length) parts.push(`${q.categories.length} categories`);
  if (q.sourceIds?.length) parts.push(`${q.sourceIds.length} sources`);
  if (q.days) parts.push(`last ${q.days}d`);
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, fontSize: font.body },
});
