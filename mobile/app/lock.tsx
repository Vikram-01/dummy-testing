import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, View } from 'react-native';
import { promptBiometric } from '@/lib/deviceSecurity';
import { vault } from '@/local/db';
import { useAuth } from '@/state/auth';
import { Body, Button, Caption, Field, Screen, Title } from '@/ui/components';
import { space, useTheme } from '@/ui/theme';

export default function Lock() {
  const { colors } = useTheme();
  const { mode, biometricEnabled, unlock, unlockWithPasscode, signOut, eraseDevice } = useAuth();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newCode, setNewCode] = useState('');

  const tryBio = async () => {
    if (!biometricEnabled) return;
    if (!(await unlock())) setMsg('Couldn’t verify. Try again or use your passcode.');
  };
  useEffect(() => {
    void tryBio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (v = code) => {
    if (!/^\d{6}$/.test(v)) return;
    setBusy(true);
    setMsg(null);
    const r = await unlockWithPasscode(v);
    setBusy(false);
    if (!r.ok) {
      setCode('');
      setMsg(r.waitSec > 0 ? `Too many attempts. Try again in ${r.waitSec} s.` : 'Wrong passcode.');
    }
  };

  const forgot = () => {
    if (biometricEnabled) {
      setResetting(true);
      return;
    }
    Alert.alert('Forgot passcode?', 'Without fingerprint unlock, the only option is to erase everything on this device and start again. Restore from a backup if you have one.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase all data', style: 'destructive', onPress: () => eraseDevice() },
    ]);
  };

  const resetWithBio = async () => {
    if (!/^\d{6}$/.test(newCode)) return setMsg('Enter 6 digits');
    if (!(await promptBiometric('Confirm it’s you to reset the passcode'))) return setMsg('Biometric check failed');
    await vault.changePasscode(newCode);
    setResetting(false);
    setNewCode('');
    await submit(newCode);
  };

  if (mode === 'server') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
          <Ionicons name="lock-closed" size={44} color={colors.primary} />
          <Title>Locked</Title>
          {msg ? <Caption color={colors.negative}>{msg}</Caption> : null}
          <Button title="Unlock" icon="finger-print" onPress={tryBio} style={{ alignSelf: 'stretch' }} />
          <Button title="Sign in with password instead" variant="ghost" onPress={() => signOut()} />
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      <Screen edges={['top', 'bottom']}>
        <View style={{ alignItems: 'center', gap: space.md, marginTop: space.xxl * 2 }}>
          <Ionicons name="lock-closed" size={40} color={colors.primary} />
          <Title>{resetting ? 'Set a new passcode' : 'Enter passcode'}</Title>
          <Body muted style={{ textAlign: 'center' }}>Your data is encrypted on this phone.</Body>
        </View>
        {resetting ? (
          <>
            <Field label="New 6-digit passcode" value={newCode} onChangeText={(t) => setNewCode(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} secureTextEntry autoFocus />
            <Button title="Confirm with fingerprint" icon="finger-print" onPress={resetWithBio} />
            <Button title="Cancel" variant="ghost" onPress={() => setResetting(false)} />
          </>
        ) : (
          <>
            <Field label="Passcode" value={code} autoFocus keyboardType="number-pad" maxLength={6} secureTextEntry
              onChangeText={(t) => {
                const v = t.replace(/\D/g, '');
                setCode(v);
                if (v.length === 6) void submit(v);
              }} />
            <Button title="Unlock" onPress={() => submit()} loading={busy} />
            {biometricEnabled ? <Button title="Use fingerprint" icon="finger-print" variant="secondary" onPress={tryBio} /> : null}
            <Button title="Forgot passcode?" variant="ghost" onPress={forgot} />
          </>
        )}
        {msg ? <Caption color={colors.negative} style={{ textAlign: 'center' }}>{msg}</Caption> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
