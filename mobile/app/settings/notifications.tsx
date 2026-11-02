import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { financeApi } from '@/api/endpoints';
import type { NotificationPrefs } from '@/api/types';
import { useNotificationPrefs } from '@/hooks/queries';
import { notificationPermission, scheduleReminders } from '@/services/notifications';
import { keys } from '@/state/queryClient';
import { Body, Button, Caption, Card, Divider, ErrorState, Screen, SkeletonCard, ToggleRow } from '@/ui/components';

const ROWS: { key: keyof NotificationPrefs; title: string; subtitle: string }[] = [
  { key: 'policy_renewals', title: 'Policy renewals', subtitle: '7 days before an insurance policy renews' },
  { key: 'emi_due', title: 'EMI due', subtitle: '2 days before a loan EMI' },
  { key: 'card_due', title: 'Credit card due', subtitle: '3 days before a payment due date' },
  { key: 'maturity_alerts', title: 'Deposit maturity', subtitle: '7 days before an FD or RD matures' },
  { key: 'sync_failures', title: 'Sync problems', subtitle: 'When an account stops updating (server mode)' },
];

export default function Notifications() {
  const q = useNotificationPrefs();
  const qc = useQueryClient();
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    notificationPermission().then(setGranted);
  }, []);

  const update = useMutation({
    mutationFn: (p: Partial<NotificationPrefs>) => financeApi.setNotificationPrefs(p),
    onSuccess: async (prefs) => {
      qc.setQueryData(keys.notif, prefs);
      const [ins, liab, sav] = await Promise.all([financeApi.insurance(), financeApi.liabilities(), financeApi.savings()]);
      await scheduleReminders({ insurance: ins.data, liabilities: liab.data, savings: sav.data }, prefs);
    },
  });

  const enable = async () => {
    const ok = await notificationPermission(true);
    setGranted(ok);
    if (!ok) Alert.alert('Notifications are off', 'Turn them on for Personal Finance 360 in Android settings.', [{ text: 'Cancel' }, { text: 'Open settings', onPress: () => Linking.openSettings() }]);
    else if (q.data) update.mutate({});
  };

  return (
    <Screen>
      {granted === false ? (
        <Card>
          <Body>Notifications are turned off for this app.</Body>
          <Button title="Turn on notifications" onPress={enable} />
        </Card>
      ) : null}
      {q.isPending ? <SkeletonCard /> : !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <Card style={{ gap: 0 }}>
          {ROWS.map((r, i) => (
            <ToggleRowWithDivider key={r.key} first={i === 0}>
              <ToggleRow title={r.title} subtitle={r.subtitle} value={q.data[r.key]} onChange={(v) => update.mutate({ [r.key]: v })} disabled={update.isPending} />
            </ToggleRowWithDivider>
          ))}
        </Card>
      )}
      <Caption faint>Reminders never show amounts, balances, account numbers or institution names, and they are hidden on the lock screen.</Caption>
    </Screen>
  );
}

function ToggleRowWithDivider({ first, children }: { first: boolean; children: React.ReactNode }) {
  return (
    <>
      {first ? null : <Divider />}
      {children}
    </>
  );
}
