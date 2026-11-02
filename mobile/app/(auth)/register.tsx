import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Linking } from 'react-native';
import type { z } from 'zod';
import { errorMessage } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { useScreenProtection } from '@/lib/deviceSecurity';
import { registerSchema } from '@/lib/validation';
import { Body, Button, Caption, Card, Heading, Screen, Title } from '@/ui/components';
import { FormField } from '@/ui/FormField';
import { useTheme } from '@/ui/theme';

type Form = z.infer<typeof registerSchema>;

export default function Register() {
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  useScreenProtection(!!setup);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', email: '', phone: '', password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await authApi.register({ full_name: v.full_name, email: v.email, phone: `+91${v.phone}`, password: v.password });
      setSetup({ secret: r.mfa_setup.secret, uri: r.mfa_setup.otpauth_uri });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  if (setup) {
    return (
      <Screen>
        <Title>Set up two-step verification</Title>
        <Body muted>Add this key to an authenticator app (Google Authenticator, Microsoft Authenticator, Aegis). You’ll need a code from it every time you sign in.</Body>
        <Card>
          <Caption muted>Setup key</Caption>
          <Heading selectable style={{ letterSpacing: 2 }}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</Heading>
          <Button title="Open in authenticator app" variant="secondary" onPress={() => Linking.openURL(setup.uri).catch(() => undefined)} />
        </Card>
        <Caption faint>Screenshots are blocked on this screen. Keep the key private.</Caption>
        <Button title="I’ve added it — sign in" onPress={() => router.replace('/(auth)/login')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Create account</Title>
      <Card>
        <FormField control={control} name="full_name" label="Full name" autoComplete="name" />
        <FormField control={control} name="email" label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <FormField control={control} name="phone" label="Mobile number" keyboardType="phone-pad" maxLength={10} hint="10 digits, without +91" />
        <FormField control={control} name="password" label="Password" secureTextEntry autoComplete="new-password" hint="10+ characters with upper, lower, number and symbol" />
        <FormField control={control} name="confirm" label="Confirm password" secureTextEntry autoComplete="new-password" />
        {error ? <Caption color={colors.negative}>{error}</Caption> : null}
        <Button title="Create account" onPress={onSubmit} loading={formState.isSubmitting} />
      </Card>
      <Caption faint>You’ll link banks and investments later through RBI-regulated Account Aggregator consent. We never ask for your bank or broker passwords.</Caption>
    </Screen>
  );
}
