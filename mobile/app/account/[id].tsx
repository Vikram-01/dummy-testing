import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useTransactions } from '@/hooks/queries';
import { date } from '@/lib/format';
import { Badge, Body, Caption, Divider, EmptyState, ErrorState, Loading, Money, Row, Segmented } from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { space, useTheme } from '@/ui/theme';

export default function AccountTransactions() {
  const { colors } = useTheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [dir, setDir] = useState<'all' | 'credit' | 'debit'>('all');
  const q = useTransactions({ account_id: id });
  const rows = useMemo(() => (q.data?.pages.flatMap((p) => p.data) ?? []).filter((t) => dir === 'all' || t.direction === dir), [q.data, dir]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: name ?? 'Transactions' }} />
      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.md }}>
            <DataBanners query={q} />
            <Segmented value={dir} onChange={setDir} options={[{ value: 'all', label: 'All' }, { value: 'credit', label: 'Money in' }, { value: 'debit', label: 'Money out' }]} />
          </View>
        }
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={q.isPending ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <EmptyState icon="receipt-outline" title="No transactions" />}
        ListFooterComponent={q.isFetchingNextPage ? <Loading label="Loading more…" /> : undefined}
        renderItem={({ item: t }) => (
          <Row gap={space.md} style={{ paddingVertical: space.md, backgroundColor: colors.bg }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Body numberOfLines={1}>{t.description}</Body>
              <Row>
                <Caption muted>{date(t.date)}</Caption>
                <Badge label={t.category} tone={t.direction === 'credit' ? 'positive' : 'neutral'} />
              </Row>
            </View>
            <Money value={t.direction === 'credit' ? t.amount : -t.amount} sign decimals={2} colorize={t.direction === 'credit'} />
          </Row>
        )}
      />
    </View>
  );
}
