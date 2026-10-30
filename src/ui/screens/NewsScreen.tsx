import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { Category } from '../../lib/config/categories';
import { countArticles, listArticles, type ArticleFilter } from '../../lib/repo/articles';
import { useApp, useDb } from '../AppState';
import { countActive, EMPTY_NEWS, FilterButton, NewsFilters, NewsFilterSheet, SearchInput } from '../components/filters';
import { ArticleList } from '../components/lists';
import { Chip, T } from '../components/primitives';
import { space } from '../theme';

export function useDebounced<T>(v: T, ms = 250): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/**
 * Reusable news view. `base` scopes the section (e.g. Cloud Security =
 * cloud + container + IAM categories); quick chips narrow within it.
 */
export function NewsScreen({ base, quickCategories, intro }: { base: ArticleFilter; quickCategories?: Category[]; intro?: string }) {
  const db = useDb();
  const { dataVersion } = useApp();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [f, setF] = useState<NewsFilters>(EMPTY_NEWS);
  const [open, setOpen] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  const filter: ArticleFilter = useMemo(() => {
    const cats = quick ? [quick] : f.categories.length ? f.categories : base.categories;
    return {
      ...base,
      q: dq,
      categories: cats,
      sourceIds: f.sourceIds.length ? f.sourceIds : base.sourceIds,
      days: f.days ?? undefined,
    };
  }, [base, dq, f, quick]);

  const loader = useCallback((limit: number, offset: number) => listArticles(db, filter, limit, offset), [db, filter]);

  useEffect(() => {
    countArticles(db, filter).then(setTotal).catch(() => setTotal(null));
  }, [db, filter, dataVersion]);

  const header = (
    <View style={{ gap: space.sm, marginBottom: space.sm }}>
      {intro ? <T variant="small">{intro}</T> : null}
      <SearchInput value={q} onChange={setQ} placeholder="Search titles, summaries, CVE IDs" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <FilterButton count={countActive(f)} onPress={() => setOpen(true)} />
        {quickCategories?.map((c) => <Chip key={c} label={c} active={quick === c} onPress={() => setQuick(quick === c ? null : c)} />)}
      </ScrollView>
      {total != null ? <T variant="tiny">{total} article{total === 1 ? '' : 's'} stored locally</T> : null}
    </View>
  );

  return (
    <>
      <ArticleList
        loader={loader}
        header={header}
        empty={{ title: dq || countActive(f) ? 'No matching articles' : 'No articles yet', body: dq || countActive(f) ? 'Try a different search or clear filters.' : 'Pull down or tap Sync now to fetch the latest news.' }}
      />
      <NewsFilterSheet visible={open} onClose={() => setOpen(false)} value={f} onChange={setF} showCategories={!quickCategories} />
    </>
  );
}
