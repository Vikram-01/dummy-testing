import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, View } from 'react-native';
import type { z } from 'zod';
import { apiSession, baseUrl, errorMessage } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { config } from '@/config';
import { secureStorage } from '@/lib/secureStorage';
import { loginSchema } from '@/lib/validation';
import { deviceName, useAuth } from '@/state/auth';
import { pendingMfa } from '@/state/pendingMfa';
import { Badge, Body, Button, Caption, Card, Display, Field, Heading, Row, Screen } from '@/ui/components';
import { FormField } from '@/ui/FormField';
import { space, useTheme } from '@/ui/theme';

type Form = z.infer<typeof loginSchema>;

export default function Welcome() {
  const { colors } = useTheme();
  const { expiredReason } = useAuth();
  const [showServer, setShowServer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState(baseUrl());
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await authApi.login(v.email, v.password, deviceName());
      pendingMfa.set(r.mfa_token, v.email);
      router.push('/(auth)/mfa');
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  const saveServer = async () => {
    const v = server.trim().replace(/\/+$/, '');
    if (v && !v.startsWith('https://')) return setError('Server address must start with https://');
    await secureStorage.setApiOverride(v || null);
    apiSession.setBaseOverride(v || null);
    setError(null);
  };

  const Point = ({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) => (
    <Row gap={space.md}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Body muted style={{ flex: 1 }}>{text}</Body>
    </Row>
  );

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      <Screen edges={['top', 'bottom']}>
        <View style={{ gap: space.sm, marginTop: space.xxl }}>
          <Display>Personal Finance 360</Display>
          <Body muted>Your money, all in one private place.</Body>
          {config.demoModeAvailable ? <Badge label="DEBUG BUILD" tone="demo" /> : null}
        </View>

        {expiredReason ? (
          <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
            <Caption color={colors.warning}>{expiredReason}</Caption>
          </Card>
        ) : null}

        <Card>
          <Point icon="phone-portrait-outline" text="Runs entirely on this phone. No server, no account needed." />
          <Point icon="lock-closed-outline" text="Data is encrypted with a key held in Android Keystore." />
          <Point icon="finger-print" text="Unlock with a 6-digit passcode or your fingerprint." />
          <Button title="Get started on this phone" onPress={() => router.push('/(auth)/setup')} />
        </Card>

        <Caption faint style={{ textAlign: 'center' }}>
          We never ask for bank OTPs, UPI PINs, ATM PINs, card CVV or broker trading PINs.
        </Caption>

        {!showServer ? (
          <Button title="I have a Personal Finance 360 server account" variant="ghost" onPress={() => setShowServer(true)} />
        ) : (
          <Card>
            <Heading>Sign in to a server</Heading>
            {config.demoModeAvailable ? (
              <>
                <Field label="Server address" value={server} onChangeText={setServer} autoCapitalize="none" keyboardType="url" placeholder="https://api.example.com" />
                <Button title="Use this server" variant="ghost" onPress={saveServer} />
              </>
            ) : !config.apiBaseUrl ? <Caption muted>This build has no server configured.</Caption> : null}
            <FormField control={control} name="email" label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
            <FormField control={control} name="password" label="Password" secureTextEntry autoComplete="password" onSubmitEditing={() => onSubmit()} />
            {error ? <Caption color={colors.negative}>{error}</Caption> : null}
            <Button title="Sign in" onPress={onSubmit} loading={formState.isSubmitting} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Button title="Forgot password?" variant="ghost" onPress={() => router.push('/(auth)/forgot')} style={{ paddingHorizontal: 0 }} />
              <Button title="Create account" variant="ghost" onPress={() => router.push('/(auth)/register')} style={{ paddingHorizontal: 0 }} />
            </Row>
          </Card>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
