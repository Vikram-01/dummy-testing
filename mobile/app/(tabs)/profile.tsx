import * as Application from 'expo-application';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { config } from '@/config';
import { useMe } from '@/hooks/queries';
import { useSync } from '@/hooks/useSync';
import { useAuth } from '@/state/auth';
import { usePrivacy } from '@/state/privacy';
import {
  Badge, Body, Button, Caption, Card, Divider, Heading, ListRow, Row, Screen, SectionHeader, Segmented, Skeleton, ToggleRow,
} from '@/ui/components';
import { space, useTheme, type ThemePref } from '@/ui/theme';

export default function Profile() {
  const { colors, pref, setPref } = useTheme();
  const { signOut, isDemo, mode } = useAuth();
  const { hidden, toggle } = usePrivacy();
  const me = useMe();
  const sync = useSync();
  const u = me.data;

  const confirmSignOut = () =>
    mode === 'local'
      ? signOut()
      : Alert.alert('Sign out?', 'Cached data and reminders on this device will be removed.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
        ]);

  return (
    <Screen refreshing={me.isRefetching} onRefresh={() => me.refetch()}>
      <Card>
        {u ? (
          <Row gap={space.md}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Heading color={colors.primary}>{u.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</Heading>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Heading>{u.full_name}</Heading>
              <Caption muted>{u.email}</Caption>
              <Caption muted>{u.phone_masked}</Caption>
            </View>
            {u.is_demo || isDemo ? <Badge label="DEMO" tone="demo" /> : null}
          </Row>
        ) : (
          <>
            <Skeleton width="50%" height={18} />
            <Skeleton width="70%" />
          </>
        )}
      </Card>

      <SectionHeader title="Profile" />
      <Card style={{ gap: 0 }}>
        <ListRow icon="id-card-outline" title="PAN profile" subtitle={u?.pan_masked ?? 'Not added'} onPress={() => router.push('/settings/pan')} />
      </Card>

      <SectionHeader title="Data" />
      <Card style={{ gap: 0 }}>
        {mode === 'local' ? (
          <>
            <ListRow icon="create-outline" title="My accounts & data" subtitle="Add or update balances, holdings, policies, loans" onPress={() => router.push('/manage')} />
            <Divider />
          </>
        ) : null}
        <ListRow icon="link-outline" title="Connected institutions" subtitle="Banks, depositories, AMCs, EPFO" onPress={() => router.push('/settings/institutions')} />
        <Divider />
        <ListRow icon="document-lock-outline" title="Account Aggregator consents" subtitle="View, pause or revoke data sharing" onPress={() => router.push('/settings/consents')} />
        <Divider />
        {mode === 'server' ? (
          <>
            <Divider />
            <ListRow icon="refresh" title={sync.syncing ? 'Syncing…' : 'Sync all data now'} subtitle={sync.error ?? 'Fetch the latest balances and holdings'} onPress={sync.syncing ? undefined : sync.start} />
          </>
        ) : null}
      </Card>

      <SectionHeader title="Preferences" />
      <Card>
        <Body>Appearance</Body>
        <Segmented<ThemePref> value={pref} onChange={setPref} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <ToggleRow title="Hide amounts" subtitle="Mask all balances until you tap the eye icon" value={hidden} onChange={toggle} />
        <Divider />
        <ListRow icon="notifications-outline" title="Notifications" subtitle="Renewals, EMIs, card dues" onPress={() => router.push('/settings/notifications')} />
      </Card>

      <SectionHeader title="Security & privacy" />
      <Card style={{ gap: 0 }}>
        <ListRow icon="finger-print" title="Security & sessions" subtitle="Biometric unlock, signed-in devices" onPress={() => router.push('/settings/security')} />
        <Divider />
        <ListRow icon="shield-outline" title="Privacy & data" subtitle="Export or delete your data" onPress={() => router.push('/settings/privacy')} />
      </Card>

      <Button title={mode === 'local' ? 'Lock now' : 'Sign out'} variant="ghost" icon={mode === 'local' ? 'lock-closed-outline' : 'log-out-outline'} onPress={confirmSignOut} />
      <Caption faint style={{ textAlign: 'center' }}>
        Personal Finance 360 · v{Application.nativeApplicationVersion ?? '1.0.0'} ({Application.nativeBuildVersion ?? '1'}) · {config.variant} · {mode === 'local' ? 'on-device mode' : 'server mode'}
      </Caption>
    </Screen>
  );
}
