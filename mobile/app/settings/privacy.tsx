import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';
import { api, errorMessage } from '@/api/client';
import { financeApi } from '@/api/endpoints';
import type { PrivacyPrefs } from '@/api/types';
import { usePrivacyPrefs } from '@/hooks/queries';
import { exportText } from '@/services/export';
import { useAuth } from '@/state/auth';
import { usePrivacy } from '@/state/privacy';
import { keys } from '@/state/queryClient';
import { Body, Button, Caption, Card, Divider, Field, Screen, SectionHeader, ToggleRow } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export default function Privacy() {
  const { colors } = useTheme();
  const { mode, eraseDevice, signOut } = useAuth();
  const { hideOnLaunch, setHideOnLaunch } = usePrivacy();
  const q = usePrivacyPrefs();
  const qc = useQueryClient();
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  const update = useMutation({
    mutationFn: (p: Partial<PrivacyPrefs>) => financeApi.setPrivacyPrefs(p),
    onSuccess: (prefs) => qc.setQueryData(keys.privacy, prefs),
  });

  const backup = async () => {
    setBusy(true);
    try {
      if (mode === 'local') {
        const db = await api<unknown>('GET', '/local/backup');
        // JSON backup, shared via the Android share sheet. It is NOT encrypted — store it somewhere safe.
        await exportText(`PF360-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 1), 'application/json');
      } else {
        const r = await financeApi.requestExport();
        Alert.alert('Export requested', r.message);
      }
    } catch (e) {
      Alert.alert('Export failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const del = () =>
    Alert.alert(
      mode === 'local' ? 'Erase everything on this phone?' : 'Delete your account?',
      mode === 'local' ? 'Your encrypted vault, passcode and settings will be permanently removed. This cannot be undone.' : 'Your account and all synced data will be deleted from our servers. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              if (mode === 'local') await eraseDevice();
              else {
                const r = await financeApi.deleteAccount(pwd);
                Alert.alert('Done', r.message);
                await signOut();
              }
            } catch (e) {
              Alert.alert('Couldn’t delete', errorMessage(e));
            }
          },
        },
      ],
    );

  return (
    <Screen>
      <SectionHeader title="Privacy" />
      <Card style={{ gap: 0 }}>
        <ToggleRow title="Hide amounts when the app opens" value={hideOnLaunch} onChange={(v) => { setHideOnLaunch(v); update.mutate({ hide_balances_on_launch: v }); }} />
        <Divider />
        <ToggleRow title="Share anonymous usage analytics" subtitle="Off by default. This build contains no analytics SDK." value={!!q.data?.analytics_opt_in} onChange={(v) => update.mutate({ analytics_opt_in: v })} />
        <Divider />
        <ToggleRow title="Send crash reports" subtitle="This build contains no crash reporter. Reports would never include financial data." value={!!q.data?.crash_reports_opt_in} onChange={(v) => update.mutate({ crash_reports_opt_in: v })} />
      </Card>

      <SectionHeader title="Your data" />
      <Card>
        <Body>{mode === 'local' ? 'Download a backup' : 'Export my data'}</Body>
        <Caption muted>{mode === 'local' ? 'Saves everything as a JSON file through the share sheet. The file is not encrypted — keep it somewhere private.' : 'We’ll email you a secure download link.'}</Caption>
        <Button title={mode === 'local' ? 'Download backup' : 'Request export'} variant="secondary" icon="download-outline" loading={busy} onPress={backup} />
      </Card>
      <Card>
        <Body color={colors.negative}>{mode === 'local' ? 'Erase all data on this phone' : 'Delete account'}</Body>
        {mode === 'server' ? <Field label="Confirm with your password" value={pwd} onChangeText={setPwd} secureTextEntry /> : null}
        <Button title={mode === 'local' ? 'Erase everything' : 'Delete my account'} variant="danger" onPress={del} disabled={mode === 'server' && !pwd} />
      </Card>
      <Caption faint>Personal Finance 360 never collects bank OTPs, UPI PINs, ATM PINs, card CVV, net-banking or broker passwords.</Caption>
    </Screen>
  );
}
