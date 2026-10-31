import { ArrowDownWideNarrow, Check, Search, ShieldAlert, SlidersHorizontal, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES } from '../../lib/config/categories';
import { NEWS_SOURCES } from '../../lib/config/sources';
import type { CveSort } from '../../lib/repo/cves';
import { SEVERITIES, Severity } from '../../lib/repo/types';
import { sevLabel } from '../format';
import { radius, space, type, useTheme } from '../theme';
import { Button, Chip, IconButton, T, TextLink } from './primitives';

export interface NewsFilters {
  sourceIds: string[];
  categories: string[];
  days: number | null; // null = all (within retention)
}
export const EMPTY_NEWS: NewsFilters = { sourceIds: [], categories: [], days: null };

export interface CveFilters {
  severities: Severity[];
  minScore: number | null;
  vendor: string;
  product: string;
  exploitedOnly: boolean;
  days: number | null;
  sort: CveSort;
}
export const EMPTY_CVE: CveFilters = { severities: [], minScore: null, vendor: '', product: '', exploitedOnly: false, days: null, sort: 'published' };

export const DAY_OPTIONS: { label: string; v: number | null }[] = [
  { label: 'Any time', v: null },
  { label: '24 hours', v: 1 },
  { label: '3 days', v: 3 },
  { label: '5 days', v: 5 },
];

export function countActive(f: Partial<NewsFilters & CveFilters>): number {
  let n = 0;
  if (f.sourceIds?.length) n++;
  if (f.categories?.length) n++;
  if (f.days) n++;
  if (f.severities?.length) n++;
  if (f.minScore != null) n++;
  if (f.vendor) n++;
  if (f.product) n++;
  if (f.exploitedOnly) n++;
  return n;
}

/** M3 modal bottom sheet: 28dp top corners, drag handle, surfaceContainerLow. */
function Sheet({ visible, onClose, title, children, onReset }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; onReset: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.scrim, { backgroundColor: c.scrim + '66' }]} onPress={onClose} accessibilityLabel="Close filters" />
      <View style={[styles.sheet, { backgroundColor: c.surfaceContainerLow, paddingBottom: insets.bottom + space.lg }]}>
        <View style={[styles.handle, { backgroundColor: c.onSurfaceVariant + '66' }]} />
        <View style={styles.sheetHead}>
          <T variant="h2">{title}</T>
          <View style={{ flex: 1 }} />
          <TextLink label="Reset" onPress={onReset} />
          <IconButton icon={X} label="Close" onPress={onClose} />
        </View>
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: space.lg }}>{children}</ScrollView>
        <Button label="Show results" icon={Check} onPress={onClose} />
      </View>
    </Modal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space.md }}>
      <T variant="label" style={{ marginBottom: space.sm }}>{title}</T>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function FilterButton({ count, onPress }: { count: number; onPress: () => void }) {
  return <Chip label={count ? `Filters (${count})` : 'Filters'} icon={SlidersHorizontal} active={count > 0} onPress={onPress} />;
}

export function NewsFilterSheet({ visible, onClose, value, onChange, showCategories = true }: { visible: boolean; onClose: () => void; value: NewsFilters; onChange: (v: NewsFilters) => void; showCategories?: boolean }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Filter news" onReset={() => onChange(EMPTY_NEWS)}>
      <Group title="Published">
        {DAY_OPTIONS.map((o) => <Chip key={o.label} label={o.label} active={value.days === o.v} onPress={() => onChange({ ...value, days: o.v })} />)}
      </Group>
      {showCategories ? (
        <Group title="Category">
          {CATEGORIES.map((cat) => <Chip key={cat} label={cat} active={value.categories.includes(cat)} onPress={() => onChange({ ...value, categories: toggle(value.categories, cat) })} />)}
        </Group>
      ) : null}
      <Group title="Source">
        {NEWS_SOURCES.map((s) => <Chip key={s.id} label={s.name} active={value.sourceIds.includes(s.id)} onPress={() => onChange({ ...value, sourceIds: toggle(value.sourceIds, s.id) })} />)}
      </Group>
    </Sheet>
  );
}

const SORTS: { v: CveSort; label: string }[] = [
  { v: 'published', label: 'Newest' },
  { v: 'severity', label: 'Severity' },
  { v: 'score', label: 'CVSS score' },
  { v: 'modified', label: 'Recently modified' },
];

export function CveFilterSheet({ visible, onClose, value, onChange, lockSeverity }: { visible: boolean; onClose: () => void; value: CveFilters; onChange: (v: CveFilters) => void; lockSeverity?: boolean }) {
  const c = useTheme();
  const input = [styles.input, { backgroundColor: 'transparent', borderColor: c.outline, color: c.onSurface }];
  return (
    <Sheet visible={visible} onClose={onClose} title="Filter CVEs" onReset={() => onChange(EMPTY_CVE)}>
      <Group title="Sort by">
        {SORTS.map((s) => <Chip key={s.v} label={s.label} icon={ArrowDownWideNarrow} active={value.sort === s.v} onPress={() => onChange({ ...value, sort: s.v })} />)}
      </Group>
      {!lockSeverity ? (
        <Group title="Severity">
          {SEVERITIES.map((s) => <Chip key={s} label={s === 'NONE' ? 'None' : s === 'UNKNOWN' ? 'Unknown' : sevLabel(s)} color={c.sev[s]} active={value.severities.includes(s)} onPress={() => onChange({ ...value, severities: toggle(value.severities, s) })} />)}
        </Group>
      ) : null}
      <Group title="Minimum CVSS score">
        {[null, 4, 7, 9].map((v) => <Chip key={String(v)} label={v == null ? 'Any' : `${v.toFixed(1)}+`} active={value.minScore === v} onPress={() => onChange({ ...value, minScore: v })} />)}
      </Group>
      <Group title="Exploited status">
        <Chip label="Any" active={!value.exploitedOnly} onPress={() => onChange({ ...value, exploitedOnly: false })} />
        <Chip label="Verified exploited (CISA KEV)" icon={ShieldAlert} color={c.danger} active={value.exploitedOnly} onPress={() => onChange({ ...value, exploitedOnly: true })} />
      </Group>
      <Group title="Published">
        {DAY_OPTIONS.map((o) => <Chip key={o.label} label={o.label} active={value.days === o.v} onPress={() => onChange({ ...value, days: o.v })} />)}
      </Group>
      <View style={{ marginTop: space.md, gap: space.sm }}>
        <T variant="label">Vendor and product</T>
        <TextInput style={input} placeholder="Vendor (e.g. microsoft)" placeholderTextColor={c.onSurfaceVariant} autoCapitalize="none" autoCorrect={false} value={value.vendor} onChangeText={(t) => onChange({ ...value, vendor: t })} maxLength={80} />
        <TextInput style={input} placeholder="Product (e.g. exchange)" placeholderTextColor={c.onSurfaceVariant} autoCapitalize="none" autoCorrect={false} value={value.product} onChangeText={(t) => onChange({ ...value, product: t })} maxLength={80} />
      </View>
    </Sheet>
  );
}

/** M3 search bar: 56dp pill on surfaceContainerHigh with a leading search icon. */
export function SearchInput({ value, onChange, placeholder, onSubmit }: { value: string; onChange: (s: string) => void; placeholder: string; onSubmit?: () => void }) {
  const c = useTheme();
  return (
    <View style={[styles.searchBar, { backgroundColor: c.surfaceContainerHigh }]}>
      <Search size={20} color={c.onSurfaceVariant} />
      <TextInput
        style={[type.bodyLarge, styles.searchInput, { color: c.onSurface }]}
        placeholder={placeholder}
        placeholderTextColor={c.onSurfaceVariant}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        maxLength={120}
        accessibilityLabel={placeholder}
      />
      {value ? <IconButton icon={X} label="Clear search" size={18} onPress={() => onChange('')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingTop: space.sm },
  handle: { width: 32, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: space.sm, marginBottom: space.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { ...type.bodyLarge, borderWidth: 1, borderRadius: radius.xs, paddingHorizontal: space.lg, height: 56 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 56, borderRadius: radius.xl, paddingLeft: space.lg, paddingRight: space.xs },
  searchInput: { flex: 1, height: 56, paddingVertical: 0 },
});
