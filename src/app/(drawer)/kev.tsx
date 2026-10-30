import { ShieldAlert, Skull } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { listKev, type KevFilter } from '../../lib/repo/cves';
import { useApp, useDb } from '../../ui/AppState';
import { SearchInput } from '../../ui/components/filters';
import { KevList } from '../../ui/components/lists';
import { Chip, T } from '../../ui/components/primitives';
import { useDebounced } from '../../ui/screens/NewsScreen';
import { space, useTheme } from '../../ui/theme';

type Mode = 'recent' | 'month' | 'all' | 'ransomware';

export default function Kev() {
  const db = useDb();
  const c = useTheme();
  const { settings } = useApp();
  const [mode, setMode] = useState<Mode>('recent');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);

  const filter: KevFilter = useMemo(() => {
    // KEV dates are calendar days; the repo includes the whole first day of the window.
    return {
      q: dq,
      sinceDays: mode === 'recent' ? settings.retentionDays : mode === 'month' ? 30 : undefined,
      ransomwareOnly: mode === 'ransomware',
    };
  }, [dq, mode, settings.retentionDays]);

  const loader = useCallback((limit: number, offset: number) => listKev(db, filter, limit, offset), [db, filter]);

  const header = (
    <View style={{ gap: space.sm, marginBottom: space.sm }}>
      <T variant="small">
        CISA&apos;s Known Exploited Vulnerabilities catalog — the authoritative list of vulnerabilities with confirmed exploitation in the wild. The full catalog is kept as reference data.
      </T>
      <SearchInput value={q} onChange={setQ} placeholder="CVE ID, vendor or product" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={`Added last ${settings.retentionDays} days`} icon={ShieldAlert} color={c.danger} active={mode === 'recent'} onPress={() => setMode('recent')} />
        <Chip label="Last 30 days" active={mode === 'month'} onPress={() => setMode('month')} />
        <Chip label="Known ransomware use" icon={Skull} color={c.danger} active={mode === 'ransomware'} onPress={() => setMode('ransomware')} />
        <Chip label="Entire catalog" active={mode === 'all'} onPress={() => setMode('all')} />
      </ScrollView>
    </View>
  );

  return (
    <KevList
      loader={loader}
      header={header}
      empty={{
        title: mode === 'recent' ? `No KEV additions in ${settings.retentionDays} days` : 'No KEV entries',
        body: mode === 'recent' ? 'CISA adds entries a few times a week. Try "Last 30 days".' : 'The catalog downloads on the next sync.',
      }}
    />
  );
}
