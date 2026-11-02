import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Linking } from 'react-native';
import type { z } from 'zod';
import { errorMessage } from '@/api/client';
import { financeApi } from '@/api/endpoints';
import { useConsents } from '@/hooks/queries';
import { date } from '@/lib/format';
import { aaHandleSchema } from '@/lib/validation';
import { useAuth } from '@/state/auth';
import { keys } from '@/state/queryClient';
import { Badge, Body, Button, Caption, Card, EmptyState, ErrorState, Heading, Row, Screen, SkeletonCard } from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { FormField } from '@/ui/FormField';
import { space, useTheme } from '@/ui/theme';

const TONE = { ACTIVE: 'positive', PAUSED: 'warning', REVOKED: 'negative', PENDING: 'primary' } as const;

export default function Consents() {
  const { colors } = useTheme();
  const { mode } = useAuth();
  const q = useConsents();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const form = useForm<z.infer<typeof aaHandleSchema>>({ resolver: zodResolver(aaHandleSchema), defaultValues: { aa_handle: '' } });

  const act = useMutation({
    mutationFn: (v: { id: string; action: 'pause' | 'resume' | 'revoke' }) => financeApi.consentAction(v.id, v.action),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.consents }),
    onError: (e) => Alert.alert('Couldn’t update consent', errorMessage(e)),
  });

  const request = form.handleSubmit(async ({ aa_handle }) => {
    try {
      const r = await financeApi.requestConsent(aa_handle, ['DEPOSIT', 'TERM_DEPOSIT', 'RECURRING_DEPOSIT', 'EQUITIES', 'MUTUAL_FUNDS']);
      await qc.invalidateQueries({ queryKey: keys.consents });
      setAdding(false);
      // Approval (and any OTP) happens inside the Account Aggregator's own app or site — never here.
      if (r.redirect_url?.startsWith('https://')) await Linking.openURL(r.redirect_url);
      else Alert.alert('Consent requested', r.message);
    } catch (e) {
      Alert.alert('Couldn’t request consent', errorMessage(e));
    }
  });

  if (mode === 'local') {
    return (
      <Screen>
        <Card>
          <EmptyState icon="cloud-offline-outline" title="Not available in on-device mode"
            message="Automatic bank and demat linking through RBI’s Account Aggregator network needs a Personal Finance 360 server with a licensed AA partner. On this phone you enter balances yourself." />
          <Button title="Add or update accounts" onPress={() => router.push('/manage')} />
        </Card>
      </Screen>
    );
  }

  const confirmRevoke = (id: string) =>
    Alert.alert('Revoke consent?', 'Data will stop flowing from these institutions. You can grant a new consent later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => act.mutate({ id, action: 'revoke' }) },
    ]);

  const list = q.data?.data ?? [];
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <DataBanners query={q} />
      <Body muted>Account Aggregator consents let regulated institutions share your data with us. You approve each one in your AA app, and you can pause or revoke at any time.</Body>
      {q.isPending ? <SkeletonCard /> : q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <Card><EmptyState icon="document-lock-outline" title="No consents yet" /></Card>
      ) : list.map((c) => (
        <Card key={c.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading>{c.fip_names.join(', ') || c.fi_types.join(', ')}</Heading>
            <Badge label={c.status} tone={TONE[c.status]} />
          </Row>
          <Caption muted>{c.aa_name} · {c.aa_handle}</Caption>
          <Caption muted>{c.fi_types.join(' · ')} · {c.fetch_frequency} · {c.data_range_months} months history</Caption>
          <Caption muted>Valid till {date(c.valid_till)}</Caption>
          {c.status !== 'REVOKED' ? (
            <Row gap={space.sm}>
              {c.status === 'ACTIVE' ? <Button title="Pause" variant="secondary" style={{ flex: 1 }} onPress={() => act.mutate({ id: c.id, action: 'pause' })} /> : null}
              {c.status === 'PAUSED' ? <Button title="Resume" variant="secondary" style={{ flex: 1 }} onPress={() => act.mutate({ id: c.id, action: 'resume' })} /> : null}
              <Button title="Revoke" variant="ghost" style={{ flex: 1 }} onPress={() => confirmRevoke(c.id)} />
            </Row>
          ) : null}
        </Card>
      ))}
      {adding ? (
        <Card>
          <FormField control={form.control} name="aa_handle" label="Your AA handle" autoCapitalize="none" placeholder="mobilenumber@aa-provider" />
          <Button title="Request consent" onPress={request} loading={form.formState.isSubmitting} />
          <Caption faint>You’ll approve the request in your Account Aggregator app. Never share bank OTPs with Personal Finance 360.</Caption>
        </Card>
      ) : (
        <Button title="Link more accounts" icon="add" onPress={() => setAdding(true)} />
      )}
      {act.isPending ? <Caption color={colors.textMuted}>Updating…</Caption> : null}
    </Screen>
  );
}
