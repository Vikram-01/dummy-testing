import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { useCollection, useLocalMutation } from '@/hooks/useLocalData';
import { COLLECTIONS, validateRecord, type CollectionKey, type FieldDef } from '@/local/schema';
import { Button, Caption, Card, Field, Label, Screen } from '@/ui/components';
import { radius, space, useTheme } from '@/ui/theme';

const today = () => new Date().toISOString().slice(0, 10);

function Chips({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={{ paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.surface }}>
            <Label color={on ? colors.primary : colors.text}>{o.label}</Label>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function EditRecord() {
  const { colors } = useTheme();
  const { collection, id } = useLocalSearchParams<{ collection: CollectionKey; id?: string }>();
  const def = COLLECTIONS[collection];
  const rows = useCollection(collection);
  const banks = useCollection('bank_accounts');
  const m = useLocalMutation();
  const existing = useMemo(() => rows.data?.find((r) => r.id === id), [rows.data, id]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const f of def.fields) {
      const v = existing?.[f.key];
      init[f.key] = v == null ? (f.type === 'date' && f.required ? today() : f.type === 'select' && f.required && f.options ? f.options[0] : '') : String(v);
    }
    if (!existing && collection === 'transactions' && banks.data?.[0]) init.account_id = banks.data[0].id;
    setForm(init);
  }, [existing, def, collection, banks.data]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const { errors: e } = validateRecord(def, form);
    setErrors(e);
    if (Object.keys(e).length) return;
    m.mutate(
      { method: existing ? 'PUT' : 'POST', path: existing ? `/local/${collection}/${existing.id}` : `/local/${collection}`, body: form },
      { onSuccess: () => router.back(), onError: (err) => Alert.alert('Couldn’t save', errorMessage(err)) },
    );
  };

  const remove = () =>
    Alert.alert(`Delete this ${def.singular}?`, collection === 'bank_accounts' ? 'Its transactions will be deleted too.' : 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => m.mutate({ method: 'DELETE', path: `/local/${collection}/${existing!.id}` }, { onSuccess: () => router.back() }) },
    ]);

  const renderField = (f: FieldDef) => {
    if (f.type === 'select') {
      return (
        <View key={f.key} style={{ gap: 6 }}>
          <Label muted>{f.label}</Label>
          <Chips value={form[f.key] ?? ''} onChange={(v) => set(f.key, v)} options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />
          {errors[f.key] ? <Caption color={colors.negative}>{errors[f.key]}</Caption> : f.hint ? <Caption faint>{f.hint}</Caption> : null}
        </View>
      );
    }
    if (f.type === 'account') {
      const opts = (banks.data ?? []).map((b) => ({ value: b.id, label: `${b.bank_name} ${b.last4 ? '··' + b.last4 : ''}` }));
      return (
        <View key={f.key} style={{ gap: 6 }}>
          <Label muted>{f.label}</Label>
          {opts.length ? <Chips value={form[f.key] ?? ''} onChange={(v) => set(f.key, v)} options={opts} /> : <Caption color={colors.negative}>Add a bank account first.</Caption>}
          {errors[f.key] ? <Caption color={colors.negative}>{errors[f.key]}</Caption> : null}
        </View>
      );
    }
    const numeric = f.type === 'money' || f.type === 'number' || f.type === 'percent' || f.type === 'last4';
    return (
      <Field key={f.key} label={f.label + (f.required ? '' : ' (optional)')} value={form[f.key] ?? ''} onChangeText={(v) => set(f.key, v)}
        error={errors[f.key]} hint={f.type === 'date' ? f.hint ?? 'YYYY-MM-DD' : f.hint} placeholder={f.placeholder ?? (f.type === 'date' ? 'YYYY-MM-DD' : undefined)}
        keyboardType={numeric ? (f.type === 'last4' ? 'number-pad' : 'decimal-pad') : f.type === 'date' ? 'numbers-and-punctuation' : 'default'}
        maxLength={f.type === 'last4' ? 4 : f.type === 'date' ? 10 : 120} autoCapitalize={f.key === 'symbol' ? 'characters' : 'sentences'} />
    );
  };

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      <Screen>
        <Stack.Screen options={{ title: existing ? `Edit ${def.singular}` : `Add ${def.singular}` }} />
        <Card>{def.fields.map(renderField)}</Card>
        <Button title="Save" onPress={save} loading={m.isPending} />
        {existing ? <Button title="Delete" variant="ghost" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
