import { router } from 'expo-router';
import { Fragment } from 'react';
import { useInstitutions } from '@/hooks/queries';
import { useSync } from '@/hooks/useSync';
import { relativeTime } from '@/lib/format';
import { useAuth } from '@/state/auth';
import { Badge, Button, Caption, Card, Divider, EmptyState, ErrorState, ListRow, Screen, SkeletonCard } from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { useTheme } from '@/ui/theme';

export default function Institutions() {
  const { colors } = useTheme();
  const { mode } = useAuth();
  const q = useInstitutions();
  const sync = useSync();
  const list = q.data?.data ?? [];
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <DataBanners query={q} />
      {q.isPending ? <SkeletonCard /> : q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <Card><EmptyState icon="link-outline" title="Nothing connected yet" message={mode === 'local' ? 'Institutions appear here as you add accounts.' : 'Approve an Account Aggregator consent to connect your banks and investments.'} /></Card>
      ) : (
        <Card style={{ gap: 0 }}>
          {list.map((i, n) => (
            <Fragment key={i.id}>
              {n > 0 ? <Divider /> : null}
              <ListRow icon="business-outline" title={i.name} subtitle={`${i.type} · ${i.linked_via} · ${relativeTime(i.last_synced_at)}`}
                right={<Badge label={i.status} tone={i.status === 'Connected' ? 'positive' : 'warning'} />} />
            </Fragment>
          ))}
        </Card>
      )}
      {mode === 'local' ? (
        <Button title="Add or update accounts" icon="create-outline" onPress={() => router.push('/manage')} />
      ) : (
        <>
          {sync.error ? <Caption color={colors.negative}>{sync.error}</Caption> : null}
          <Button title="Sync all now" icon="refresh" loading={sync.syncing} onPress={sync.start} />
          <Button title="Manage consents" variant="secondary" onPress={() => router.push('/settings/consents')} />
        </>
      )}
    </Screen>
  );
}
