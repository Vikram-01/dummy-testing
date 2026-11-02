import { router } from 'expo-router';
import { useBankAccounts, useInsurance, useLiabilities, useSavings } from '@/hooks/queries';
import { relativeTime } from '@/lib/format';
import { useAuth } from '@/state/auth';
import {
  Button, Caption, Card, Divider, EmptyState, ErrorState, ListRow, Money, Row, Screen, SectionHeader, SkeletonCard,
} from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { Fragment } from 'react';

export default function Accounts() {
  const { mode } = useAuth();
  const banks = useBankAccounts();
  const savings = useSavings();
  const ins = useInsurance();
  const liab = useLiabilities();
  const refreshing = banks.isRefetching || savings.isRefetching;
  const refresh = () => Promise.all([banks.refetch(), savings.refetch(), ins.refetch(), liab.refetch()]);
  const list = banks.data?.data ?? [];
  const total = list.reduce((s, a) => s + a.available_balance, 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <DataBanners query={banks} />

      {mode === 'local' ? <Button title="Add or update accounts" icon="create-outline" variant="secondary" onPress={() => router.push('/manage')} /> : null}
      <SectionHeader title="Bank accounts" />
      {banks.isPending ? <SkeletonCard /> : banks.isError && !banks.data ? <ErrorState error={banks.error} onRetry={() => banks.refetch()} /> : list.length === 0 ? (
        <Card><EmptyState icon="business-outline" title="No bank accounts" message={mode === 'local' ? 'Add a bank account and its balance.' : 'Link a bank account with Account Aggregator consent.'} action={mode === 'local' ? 'Add a bank account' : 'Link a bank'} onAction={() => router.push(mode === 'local' ? { pathname: '/manage/edit', params: { collection: 'bank_accounts' } } : '/settings/consents')} /></Card>
      ) : (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Caption muted>Total available</Caption>
            <Money value={total} variant="heading" />
          </Row>
          <Divider />
          {list.map((a, i) => (
            <Fragment key={a.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon="business-outline"
                title={a.bank_name}
                subtitle={`${a.account_type} · ${a.account_masked} · synced ${relativeTime(a.last_synced_at)}`}
                right={<Money value={a.available_balance} />}
                rightSub={a.current_balance !== a.available_balance ? <Caption muted>Ledger <Money value={a.current_balance} variant="caption" /></Caption> : undefined}
                onPress={() => router.push({ pathname: '/account/[id]', params: { id: a.id, name: `${a.bank_name} ${a.account_masked}` } })}
              />
            </Fragment>
          ))}
        </Card>
      )}

      <SectionHeader title="More" />
      <Card style={{ gap: 0 }}>
        <ListRow icon="swap-vertical-outline" title="Income & expenses" subtitle="Categories and cash flow" onPress={() => router.push('/spending')} />
        <Divider />
        <ListRow icon="umbrella-outline" title="Savings & retirement" subtitle="FD, RD, PPF, EPF, NPS"
          right={<Money value={savings.data ? savings.data.data.totals.deposits + savings.data.data.totals.retirement : null} compact />}
          onPress={() => router.push('/savings')} />
        <Divider />
        <ListRow icon="shield-checkmark-outline" title="Insurance" subtitle={ins.data ? `${ins.data.data.length} policies` : 'Life, health, motor'}
          right={ins.data?.data.some((p) => p.days_to_renewal <= 30) ? <Caption muted>Renewal due</Caption> : undefined}
          onPress={() => router.push('/insurance')} />
        <Divider />
        <ListRow icon="card-outline" title="Loans & credit cards" subtitle="EMIs, dues, utilisation"
          right={<Money value={liab.data?.data.totals.total ?? null} compact />}
          onPress={() => router.push('/loans')} />
      </Card>
    </Screen>
  );
}
