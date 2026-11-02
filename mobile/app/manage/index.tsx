import { router } from 'expo-router';
import { Fragment } from 'react';
import { Alert } from 'react-native';
import { errorMessage } from '@/api/client';
import { config } from '@/config';
import { useDashboard } from '@/hooks/queries';
import { useCollection, useLocalMutation } from '@/hooks/useLocalData';
import { COLLECTION_ORDER, COLLECTIONS, type CollectionKey } from '@/local/schema';
import { Badge, Body, Button, Caption, Card, Divider, ListRow, Screen, SectionHeader } from '@/ui/components';

function CollectionRow({ k }: { k: CollectionKey }) {
  const q = useCollection(k);
  const def = COLLECTIONS[k];
  const n = q.data?.length ?? 0;
  return <ListRow icon={def.icon} title={def.title} subtitle={n ? `${n} saved` : 'Nothing added yet'} onPress={() => router.push({ pathname: '/manage/[collection]', params: { collection: k } })} />;
}

export default function Manage() {
  const dash = useDashboard();
  const m = useLocalMutation();
  const isDemo = dash.data?.is_demo;

  const sample = (add: boolean) =>
    m.mutate({ method: add ? 'POST' : 'DELETE', path: '/local/sample' }, { onError: (e) => Alert.alert('Couldn’t update', errorMessage(e)) });

  return (
    <Screen>
      <Body muted>Add and update your accounts here. Everything is saved encrypted on this phone. Only the last 4 digits of any account, card or policy number are ever stored.</Body>
      <Card style={{ gap: 0 }}>
        {COLLECTION_ORDER.map((k, i) => (
          <Fragment key={k}>
            {i > 0 ? <Divider /> : null}
            <CollectionRow k={k} />
          </Fragment>
        ))}
      </Card>

      {config.demoModeAvailable ? (
        <>
          <SectionHeader title="Sample data (testing)" />
          <Card>
            <Badge label="DEMO" tone="demo" />
            <Caption muted>Adds a fictional set of accounts so you can explore every screen. All sample rows are marked DEMO and can be removed in one tap without touching your own entries.</Caption>
            {isDemo
              ? <Button title="Remove sample data" variant="danger" loading={m.isPending} onPress={() => sample(false)} />
              : <Button title="Add sample data" variant="secondary" icon="flask-outline" loading={m.isPending} onPress={() => sample(true)} />}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
