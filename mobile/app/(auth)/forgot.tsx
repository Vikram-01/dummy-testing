import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { config } from '@/config';
import { email, resetSchema } from '@/lib/validation';
import { Body, Button, Caption, Card, Screen, Title } from '@/ui/components';
import { FormField } from '@/ui/FormField';
import { useTheme } from '@/ui/theme';

const emailSchema = z.object({ email });

export default function Forgot() {
  const { colors } = useTheme();
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [addr, setAddr] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const f1 = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });
  const f2 = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { code: '', password: '', confirm: '' } });

  const send = f1.handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await authApi.forgot(v.email);
      setAddr(v.email);
      // Development backends may echo the code; only debug builds display it.
      setMsg(r.message + (config.demoModeAvailable && r.dev_reset_code ? `\n\nDev code: ${r.dev_reset_code}` : ''));
      setStep('reset');
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  const reset = f2.handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await authApi.reset(addr, v.code, v.password);
      setMsg(r.message);
      setStep('done');
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen>
      <Title>Reset password</Title>
      {msg ? <Body muted>{msg}</Body> : <Body muted>We’ll email a 6-digit reset code to your registered address.</Body>}
      <Card>
        {step === 'email' && (
          <>
            <FormField control={f1.control} name="email" label="Email" autoCapitalize="none" keyboardType="email-address" />
            <Button title="Send reset code" onPress={send} loading={f1.formState.isSubmitting} />
          </>
        )}
        {step === 'reset' && (
          <>
            <FormField control={f2.control} name="code" label="Reset code" keyboardType="number-pad" maxLength={6} />
            <FormField control={f2.control} name="password" label="New password" secureTextEntry autoComplete="new-password" />
            <FormField control={f2.control} name="confirm" label="Confirm new password" secureTextEntry autoComplete="new-password" />
            <Button title="Update password" onPress={reset} loading={f2.formState.isSubmitting} />
          </>
        )}
        {step === 'done' && <Button title="Back to sign in" onPress={() => router.replace('/(auth)/login')} />}
        {error ? <Caption color={colors.negative}>{error}</Caption> : null}
      </Card>
    </Screen>
  );
}
