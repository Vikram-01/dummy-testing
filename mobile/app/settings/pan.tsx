import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { errorMessage } from '@/api/client';
import { financeApi } from '@/api/endpoints';
import { useMe } from '@/hooks/queries';
import { panSchema } from '@/lib/validation';
import { keys } from '@/state/queryClient';
import { Body, Button, Caption, Card, Heading, Screen } from '@/ui/components';
import { FormField } from '@/ui/FormField';
import { useTheme } from '@/ui/theme';

export default function Pan() {
  const { colors } = useTheme();
  const me = useMe();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { control, handleSubmit, formState, reset } = useForm<z.infer<typeof panSchema>>({ resolver: zodResolver(panSchema), defaultValues: { pan: '' } });

  const save = handleSubmit(async ({ pan }) => {
    setMsg(null);
    try {
      await financeApi.setPan(pan);
      reset({ pan: '' }); // the full PAN is cleared from memory immediately
      setEditing(false);
      await qc.invalidateQueries({ queryKey: keys.me });
    } catch (e) {
      setMsg(errorMessage(e));
    }
  });

  return (
    <Screen>
      <Card>
        <Caption muted>PAN on file</Caption>
        <Heading style={{ letterSpacing: 2 }}>{me.data?.pan_masked ?? 'Not added'}</Heading>
        <Caption faint>Shown masked everywhere. The first five characters are never displayed or kept on this phone.</Caption>
      </Card>
      {editing ? (
        <Card>
          <FormField control={control} name="pan" label="PAN" autoCapitalize="characters" maxLength={10} autoCorrect={false} autoComplete="off" importantForAutofill="no" />
          {msg ? <Caption color={colors.negative}>{msg}</Caption> : null}
          <Button title="Save" onPress={save} loading={formState.isSubmitting} />
          <Button title="Cancel" variant="ghost" onPress={() => { reset({ pan: '' }); setEditing(false); }} />
        </Card>
      ) : (
        <Button title={me.data?.pan_masked ? 'Update PAN' : 'Add PAN'} variant="secondary" onPress={() => setEditing(true)} />
      )}
      <Body muted>Your PAN helps match statements (such as CAS for mutual funds) to you. It is optional.</Body>
    </Screen>
  );
}
