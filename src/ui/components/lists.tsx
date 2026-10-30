import { useFocusEffect } from 'expo-router';
import type React from 'react';
import { SearchX } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { toggleBookmark } from '../../lib/repo/library';
import type { ArticleRow, CveRow, KevRow } from '../../lib/repo/types';
import { useApp, useDb } from '../AppState';
import { space, useTheme } from '../theme';
import { ArticleCard, CveCard, KevCard } from './cards';
import { EmptyState, ErrorBanner, Loading } from './primitives';

const PAGE = 30;

/**
 * Infinite-scroll pager over a SQLite query. `loader` must be memoized by the
 * caller (useCallback over its filter); a new loader identity, or a bump of
 * the global dataVersion (after a sync or bookmark change), reloads page one.
 * Results from superseded queries are discarded via a generation counter.
 */
export function usePaged<T>(loader: (limit: number, offset: number) => Promise<T[]>) {
  const { dataVersion } = useApp();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gen = useRef(0);

  const reload = useCallback(async () => {
    const g = ++gen.current;
    try {
      const first = await loader(PAGE, 0);
      if (g !== gen.current) return;
      setItems(first);
      setDone(first.length < PAGE);
      setError(null);
    } catch (e) {
      if (g === gen.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (g === gen.current) setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    // Data loads asynchronously; state is only set after the query resolves.
    (async () => {
      await reload();
    })();
  }, [reload, dataVersion]);

  const loadMore = useCallback(async () => {
    if (more || done || loading) return;
    setMore(true);
    const g = gen.current;
    try {
      const next = await loader(PAGE, items.length);
      if (g !== gen.current) return;
      setItems((cur) => [...cur, ...next]);
      if (next.length < PAGE) setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMore(false);
    }
  }, [more, done, loading, items.length, loader]);

  return { items, loading, more, error, reload, loadMore };
}

interface ListProps<T> {
  /** Must be memoized (useCallback) so the list only reloads when the query changes. */
  loader: (limit: number, offset: number) => Promise<T[]>;
  header?: React.ReactElement;
  empty: { title: string; body?: string };
}

function GenericList<T>({ loader, header, empty, render, keyOf }: ListProps<T> & { render: (item: T) => React.ReactElement; keyOf: (t: T) => string }) {
  const c = useTheme();
  const { syncNow, syncing } = useApp();
  const p = usePaged(loader);
  const { reload } = p;
  // Refresh when returning to the screen (e.g. after bookmarking in a detail view).
  useFocusEffect(useCallback(() => void reload(), [reload]));
  return (
    <FlatList
      data={p.items}
      keyExtractor={keyOf}
      renderItem={({ item }) => render(item)}
      contentContainerStyle={{ padding: space.md, paddingBottom: 48 }}
      ListHeaderComponent={
        <View>
          {header}
          {p.error ? <View style={{ marginBottom: space.sm }}><ErrorBanner message={p.error} onRetry={p.reload} /></View> : null}
        </View>
      }
      ListEmptyComponent={p.loading ? <Loading /> : <EmptyState icon={SearchX} title={empty.title} body={empty.body} action={{ label: 'Sync now', onPress: () => syncNow() }} />}
      ListFooterComponent={p.more ? <ActivityIndicator style={{ margin: space.lg }} color={c.accent} /> : undefined}
      onEndReached={p.loadMore}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} tintColor={c.accent} colors={[c.accent]} progressBackgroundColor={c.surface} />}
      initialNumToRender={8}
      windowSize={9}
      removeClippedSubviews
    />
  );
}

export function ArticleList(props: ListProps<ArticleRow>) {
  const db = useDb();
  const { bump } = useApp();
  const onToggle = useCallback(async (a: ArticleRow) => {
    await toggleBookmark(db, 'article', String(a.id));
    bump();
  }, [db, bump]);
  return <GenericList {...props} keyOf={(a) => String(a.id)} render={(a) => <ArticleCard a={a} onToggleBookmark={onToggle} />} />;
}

export function CveList(props: ListProps<CveRow>) {
  const db = useDb();
  const { bump } = useApp();
  const onToggle = useCallback(async (v: CveRow) => {
    await toggleBookmark(db, 'cve', v.id);
    bump();
  }, [db, bump]);
  return <GenericList {...props} keyOf={(v) => v.id} render={(v) => <CveCard v={v} onToggleBookmark={onToggle} />} />;
}

export function KevList(props: ListProps<KevRow>) {
  return <GenericList {...props} keyOf={(k) => k.cve_id} render={(k) => <KevCard k={k} />} />;
}
