import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { useCategories } from '@/hooks/queries';
import { monthLabel, pct, shiftMonth, ym } from '@/lib/format';
import { CategoryBars, Donut } from '@/ui/charts';
import { Caption, Card, EmptyState, ErrorState, Heading, Money, Row, Screen, Segmented, SkeletonCard, Stat } from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { space, useTheme } from '@/ui/theme';

export default function Spending() {
  const { colors } = useTheme();
  const [month, setMonth] = useState(ym(new Date(Date.now() - 86400000 * new Date().getDate())));
  const [view, setView] = useState<'expense' | 'income'>('expense');
  const q = useCategories(month);
  const d = q.data?.data;
  const items = d ? (view === 'expense' ? d.expense : d.income) : [];

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <DataBanners query={q} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12} accessibilityLabel="Previous month"><Ionicons name="chevron-back" size={22} color={colors.primary} /></Pressable>
        <Heading>{monthLabel(month)}</Heading>
        <Pressable onPress={() => month < ym(new Date()) && setMonth(shiftMonth(month, 1))} hitSlop={12} accessibilityLabel="Next month"><Ionicons name="chevron-forward" size={22} color={colors.primary} /></Pressable>
      </Row>
      {q.isPending ? <SkeletonCard lines={4} /> : !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <Card>
            <Row gap={space.lg}>
              <Stat label="Income" value={<Money value={d.income_total} compact variant="heading" />} />
              <Stat label="Expenses" value={<Money value={d.expense_total} compact variant="heading" />} />
              <Stat label="Savings rate" value={<Heading>{pct(d.savings_rate_pct, { decimals: 1 })}</Heading>} />
            </Row>
          </Card>
          <Segmented value={view} onChange={setView} options={[{ value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} />
          {items.length === 0 ? <Card><EmptyState icon="pie-chart-outline" title="Nothing recorded" /></Card> : (
            <>
              <Card>
                <Donut data={items.slice(0, 6).concat(items.length > 6 ? [{ category: 'Other', amount: items.slice(6).reduce((s, x) => s + x.amount, 0) }] : []).map((c) => ({ label: c.category, value: c.amount }))} />
              </Card>
              <Card>
                <CategoryBars items={items} max={20} />
                <Caption faint>Categories are assigned automatically by the server from transaction descriptions.</Caption>
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
