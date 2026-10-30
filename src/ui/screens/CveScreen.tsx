import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { countCves, listCves, type CveFilter } from '../../lib/repo/cves';
import { SEVERITIES, Severity } from '../../lib/repo/types';
import { useApp, useDb } from '../AppState';
import { countActive, CveFilters, CveFilterSheet, EMPTY_CVE, FilterButton, SearchInput } from '../components/filters';
import { CveList } from '../components/lists';
import { Chip, T } from '../components/primitives';
import { sevLabel } from '../format';
import { space, useTheme } from '../theme';
import { useDebounced } from './NewsScreen';

export function CveScreen({ base, intro, initial }: { base?: CveFilter; intro?: string; initial?: Partial<CveFilters> }) {
  const db = useDb();
  const c = useTheme();
  const { dataVersion } = useApp();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [f, setF] = useState<CveFilters>({ ...EMPTY_CVE, ...initial });
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const lockSeverity = !!base?.severities;

  const filter: CveFilter = useMemo(
    () => ({
      ...base,
      q: dq,
      severities: f.severities.length ? f.severities : base?.severities,
      minScore: f.minScore ?? base?.minScore,
      vendor: f.vendor || undefined,
      product: f.product || undefined,
      exploitedOnly: f.exploitedOnly || base?.exploitedOnly,
      days: f.days ?? undefined,
      sort: f.sort,
    }),
    [base, dq, f],
  );

  const loader = useCallback((limit: number, offset: number) => listCves(db, filter, limit, offset), [db, filter]);

  useEffect(() => {
    countCves(db, filter).then(setTotal).catch(() => setTotal(null));
  }, [db, filter, dataVersion]);

  const quick: Severity[] = lockSeverity ? [] : SEVERITIES;
  const header = (
    <View style={{ gap: space.sm, marginBottom: space.sm }}>
      {intro ? <T variant="small">{intro}</T> : null}
      <SearchInput value={q} onChange={setQ} placeholder="CVE ID, vendor, product or keyword" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <FilterButton count={countActive(f)} onPress={() => setOpen(true)} />
        {quick.map((s) => (
          <Chip key={s} label={sevLabel(s)} color={c.sev[s]} active={f.severities.includes(s)} onPress={() => setF({ ...f, severities: f.severities.includes(s) ? f.severities.filter((x) => x !== s) : [...f.severities, s] })} />
        ))}
      </ScrollView>
      {total != null ? <T variant="tiny">{total} vulnerabilit{total === 1 ? 'y' : 'ies'} stored locally</T> : null}
    </View>
  );

  return (
    <>
      <CveList
        loader={loader}
        header={header}
        empty={{ title: dq || countActive(f) ? 'No matching vulnerabilities' : 'No CVEs yet', body: dq || countActive(f) ? 'Try a different search or clear filters.' : 'CVE data arrives from NVD on the next sync. The first sync can take a few minutes without an NVD API key.' }}
      />
      <CveFilterSheet visible={open} onClose={() => setOpen(false)} value={f} onChange={setF} lockSeverity={lockSeverity} />
    </>
  );
}
