import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import type { TextInputProps } from 'react-native';
import { Field } from './components';

export function FormField<T extends FieldValues>({ control, name, label, hint, ...input }: TextInputProps & {
  control: Control<T>; name: Path<T>; label: string; hint?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          hint={hint}
          value={field.value ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
          {...input}
        />
      )}
    />
  );
}
