import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { errorMessage } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { mfaSchema } from '@/lib/validation';
import { deviceName, useAuth } from '@/state/auth';
import { pendingMfa } from '@/state/pendingMfa';
import { Body, Button, Caption, Card, Screen, Title } from '@/ui/components';
import { FormField } from '@/ui/FormField';
import { useTheme } from '@/ui/theme';

export default function Mfa() {
  const { colors } = useTheme();
  const { completeSignIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof mfaSchema>>({ resolver: zodResolver(mfaSchema), defaultValues: { code: '' } });

  const onSubmit = handleSubmit(async ({ code }) => {
    const p = pendingMfa.get();
    if (!p) {
      setError('This step expired. Please sign in again.');
      return;
    }
    setError(null);
    try {
      const t = await authApi.verifyMfa(p.token, code, deviceName());
      pendingMfa.clear();
      await completeSignIn(t);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen>
      <Title>Two-step verification</Title>
      <Body muted>Enter the 6-digit code from your authenticator app for Personal Finance 360.</Body>
      <Card>
        <FormField control={control} name="code" label="Authenticator code" keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus onSubmitEditing={() => onSubmit()} />
        {error ? <Caption color={colors.negative}>{error}</Caption> : null}
        <Button title="Verify" onPress={onSubmit} loading={formState.isSubmitting} />
        <Button title="Back to sign in" variant="ghost" onPress={() => router.back()} />
      </Card>
      <Caption faint>This code protects your Personal Finance 360 account. It is not a bank OTP — never share bank OTPs with any app.</Caption>
    </Screen>
  );
}
