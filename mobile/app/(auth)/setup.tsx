import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@/state/auth';
import { Body, Button, Caption, Card, Screen, Title } from '@/ui/components';
import { FormField } from '@/ui/FormField';
import { useTheme } from '@/ui/theme';

const WEAK = new Set(['000000', '111111', '123456', '654321', '121212', '112233', '123123', '999999', '222222', '555555']);
const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  passcode: z.string().regex(/^\d{6}$/, '6 digits').refine((v) => !WEAK.has(v), 'Too easy to guess'),
  confirm: z.string(),
}).refine((v) => v.passcode === v.confirm, { path: ['confirm'], message: 'Passcodes do not match' });

export default function Setup() {
  const { colors } = useTheme();
  const { createLocal } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: '', passcode: '', confirm: '' } });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await createLocal(v.name, v.passcode);
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Screen>
      <Title>Set up on this phone</Title>
      <Body muted>Your passcode unlocks the encrypted vault on this device. You can turn on fingerprint unlock afterwards.</Body>
      <Card>
        <FormField control={control} name="name" label="Your name" autoComplete="name" />
        <FormField control={control} name="passcode" label="Choose a 6-digit passcode" keyboardType="number-pad" maxLength={6} secureTextEntry />
        <FormField control={control} name="confirm" label="Confirm passcode" keyboardType="number-pad" maxLength={6} secureTextEntry onSubmitEditing={() => onSubmit()} />
        {error ? <Caption color={colors.negative}>{error}</Caption> : null}
        <Button title="Create my vault" onPress={onSubmit} loading={formState.isSubmitting} />
      </Card>
      <Caption faint>There is no way to recover a forgotten passcode without fingerprint unlock, because nobody else holds your data. Download a backup from Profile → Privacy & data now and then.</Caption>
    </Screen>
  );
}
