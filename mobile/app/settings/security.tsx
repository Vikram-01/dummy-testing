import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { errorMessage } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { useSessions } from '@/hooks/queries';
import { biometricStatus, rootedDeviceRisk } from '@/lib/deviceSecurity';
import { relativeTime } from '@/lib/format';
import { vault } from '@/local/db';
import { useAuth } from '@/state/auth';
import { keys } from '@/state/queryClient';
import { Badge, Body, Button, Caption, Card, Divider, Field, ListRow, Screen, SectionHeader, ToggleRow } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export default function Security() {
  const { colors } = useTheme();
  const { biometricEnabled, setBiometricEnabled, mode } = useAuth();
  const [bio, setBio] = useState<{ available: boolean; enrolled: boolean; label: string } | null>(null);
  const [rooted, setRooted] = useState(false);
  const [oldCode, setOld] = useState('');
  const [newCode, setNew] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const sessions = useSessions();
  const qc = useQueryClient();

  useEffect(() => {
    biometricStatus().then(setBio).catch(() => setBio({ available: false, enrolled: false, label: 'Biometrics' }));
    rootedDeviceRisk().then(setRooted);
  }, []);

  const revoke = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions }),
    onError: (e) => Alert.alert('Couldn’t sign out that device', errorMessage(e)),
  });

  const changePasscode = async () => {
    setMsg(null);
    if (!/^\d{6}$/.test(newCode)) return setMsg('New passcode must be 6 digits');
    if (!(await vault.checkPasscode(oldCode))) return setMsg('Current passcode is wrong');
    await vault.changePasscode(newCode);
    setOld('');
    setNew('');
    setMsg('Passcode changed');
  };

  const canBio = !!bio?.available && !!bio?.enrolled;

  return (
    <Screen>
      {rooted ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
          <Caption color={colors.warning}>This device appears rooted or modified. Secure storage and screenshot blocking may be bypassed on such devices.</Caption>
        </Card>
      ) : null}

      <SectionHeader title="Unlock" />
      <Card>
        <ToggleRow title={`${bio?.label ?? 'Biometric'} unlock`} value={biometricEnabled} disabled={!canBio}
          subtitle={canBio ? 'Unlock with your fingerprint or face (strong biometrics only)' : 'Set up a fingerprint in Android settings first'}
          onChange={(v) => setBiometricEnabled(v)} />
        <Caption faint>The app locks after 2 minutes in the background. Screenshots and screen recording are blocked while signed in.</Caption>
      </Card>

      {mode === 'local' ? (
        <>
          <SectionHeader title="Change passcode" />
          <Card>
            <Field label="Current passcode" value={oldCode} onChangeText={(t) => setOld(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} secureTextEntry />
            <Field label="New passcode" value={newCode} onChangeText={(t) => setNew(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} secureTextEntry />
            {msg ? <Caption color={msg === 'Passcode changed' ? colors.positive : colors.negative}>{msg}</Caption> : null}
            <Button title="Change passcode" variant="secondary" onPress={changePasscode} />
          </Card>
        </>
      ) : (
        <>
          <SectionHeader title="Signed-in devices" />
          <Card style={{ gap: 0 }}>
            {(sessions.data?.data ?? []).map((s, i) => (
              <Fragment key={s.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow icon="phone-portrait-outline" title={s.device_name} subtitle={`Active ${relativeTime(s.last_used_at)}`}
                  right={s.current ? <Badge label="This device" tone="primary" /> : <Button title="Sign out" variant="ghost" onPress={() => revoke.mutate(s.id)} />} />
              </Fragment>
            ))}
            {sessions.isError ? <Body muted>{errorMessage(sessions.error)}</Body> : null}
          </Card>
        </>
      )}
    </Screen>
  );
}
