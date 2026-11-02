import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { useCollection } from '@/hooks/useLocalData';
import { COLLECTIONS, type CollectionKey } from '@/local/schema';
import { Badge, Button, Card, Divider, EmptyState, ErrorState, ListRow, Loading, Screen } from '@/ui/components';

export default function CollectionList() {
  const { collection } = useLocalSearchParams<{ collection: CollectionKey }>();
  const def = COLLECTIONS[collection];
  const q = useCollection(collection);
  const rows = [...(q.data ?? [])].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  const add = () => router.push({ pathname: '/manage/edit', params: { collection } });

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: def.title }} />
      <Button title={`Add ${def.singular}`} icon="add" onPress={add} />
      {q.isPending ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? (
        <Card><EmptyState icon={def.icon} title={`No ${def.title.toLowerCase()} yet`} message={`Tap “Add ${def.singular}” to enter one.`} /></Card>
      ) : (
        <Card style={{ gap: 0 }}>
          {rows.map((r, i) => (
            <Fragment key={r.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={String(r[def.titleField] ?? def.singular)}
                subtitle={def.subtitle(r)}
                right={r.demo ? <Badge label="DEMO" tone="demo" /> : undefined}
                onPress={() => router.push({ pathname: '/manage/edit', params: { collection, id: r.id } })}
              />
            </Fragment>
          ))}
        </Card>
      )}
    </Screen>
  );
}
