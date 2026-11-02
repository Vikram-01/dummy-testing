import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { useDashboard } from '@/hooks/queries';
import { useSync } from '@/hooks/useSync';
import { useAuth } from '@/state/auth';
import { date, monthLabel, relativeTime } from '@/lib/format';
import { useMe } from '@/hooks/queries';
import { LineChart } from '@/ui/charts';
import {
  Badge, Body, Button, Caption, Card, EmptyState, ErrorState, Heading, Label, Money, Row, Screen, SectionHeader, SkeletonCard,
  type IconName,
} from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { space, useTheme } from '@/ui/theme';

const TILES: { key: 'bank' | 'demat' | 'mutual_funds' | 'fixed_deposits' | 'retirement' | 'liabilities'; label: string; icon: IconName; href: Href }[] = [
  { key: 'bank', label: 'Bank balances', icon: 'business-outline', href: '/(tabs)/accounts' },
  { key: 'demat', label: 'Stocks (demat)', icon: 'stats-chart-outline', href: '/(tabs)/investments' },
  { key: 'mutual_funds', label: 'Mutual funds', icon: 'pie-chart-outline', href: '/(tabs)/investments' },
  { key: 'fixed_deposits', label: 'FD / RD', icon: 'lock-closed-outline', href: '/savings' },
  { key: 'retirement', label: 'PPF · EPF · NPS', icon: 'umbrella-outline', href: '/savings' },
  { key: 'liabilities', label: 'Liabilities', icon: 'card-outline', href: '/loans' },
];

export default function Home() {
  const { colors } = useTheme();
  const q = useDashboard();
  const me = useMe();
  const sync = useSync();
  const { mode } = useAuth();
  const d = q.data?.data;

  const firstName = me.data?.full_name?.split(' ')[0];

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <DataBanners query={q} />
      {firstName ? <Body muted>Hello, {firstName}</Body> : null}

      {q.isPending ? (
        <>
          <SkeletonCard lines={4} />
          <SkeletonCard />
        </>
      ) : !d ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : d.net_worth_history.length === 0 && d.total_assets === 0 ? (
        <Card>
          {mode === 'local' ? (
            <EmptyState icon="add-circle-outline" title="Let’s add your first account"
              message="Enter your bank balances, investments, deposits, policies and loans to see your net worth."
              action="Add accounts" onAction={() => router.push('/manage')} />
          ) : (
            <EmptyState icon="link-outline" title="No accounts linked yet"
              message="Link your bank, demat and mutual fund accounts through Account Aggregator consent to see your net worth."
              action="Link accounts" onAction={() => router.push('/settings/consents')} />
          )}
        </Card>
      ) : (
        <>
          <Card>
            <Caption muted>Total net worth</Caption>
            <Money value={d.net_worth} variant="display" />
            <Row>
              <Money value={d.net_worth_change_1m} sign colorize variant="label" />
              <Caption muted>vs last month · as of {date(d.as_of)}</Caption>
            </Row>
            <LineChart
              a11y={`Net worth over the last ${d.net_worth_history.length} months`}
              labels={d.net_worth_history.map((p) => monthLabel(p.month, true))}
              series={[{ name: 'Net worth', values: d.net_worth_history.map((p) => p.net_worth) }]}
            />
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {TILES.map((t) => (
              <Card key={t.key} onPress={() => router.push(t.href)} accessibilityLabel={t.label}
                style={{ width: '47.5%', flexGrow: 1, gap: space.sm, padding: space.md }}>
                <Row>
                  <Ionicons name={t.icon} size={16} color={t.key === 'liabilities' ? colors.negative : colors.primary} />
                  <Caption muted numberOfLines={1}>{t.label}</Caption>
                </Row>
                <Money value={d.totals[t.key]} compact variant="heading" />
              </Card>
            ))}
          </View>

          <SectionHeader title={mode === 'local' ? 'Your data' : 'Sync status'} action={mode === 'local' ? 'Update' : 'Manage'} onAction={() => router.push(mode === 'local' ? '/manage' : '/settings/institutions')} />
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Ionicons
                  name={d.sync.status === 'ok' ? 'checkmark-circle' : d.sync.status === 'running' ? 'sync' : 'alert-circle'}
                  size={20}
                  color={d.sync.status === 'ok' ? colors.positive : d.sync.status === 'running' ? colors.primary : colors.warning}
                />
                <Heading>{sync.syncing ? 'Syncing…' : d.sync.status === 'ok' ? 'All up to date' : d.sync.status === 'never' ? 'Not synced yet' : 'Some accounts need attention'}</Heading>
              </Row>
              {d.sync.institutions_failed > 0 ? <Badge label={`${d.sync.institutions_failed} stale`} tone="warning" /> : null}
            </Row>
            <Label muted>{mode === 'local' ? `Last updated ${relativeTime(d.sync.last_synced_at)} · ${d.sync.institutions_ok} institutions entered manually` : `Last synced ${relativeTime(d.sync.last_synced_at)} · ${d.sync.institutions_ok} institutions OK`}</Label>
            {sync.error ? <Caption color={colors.negative}>{sync.error}</Caption> : null}
            {mode === 'local'
              ? <Button title="Update balances" variant="secondary" icon="create-outline" onPress={() => router.push('/manage')} />
              : <Button title="Sync now" variant="secondary" icon="refresh" loading={sync.syncing} onPress={sync.start} />}
          </Card>
        </>
      )}
    </Screen>
  );
}
