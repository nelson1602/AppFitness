import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { TextInput, View } from 'react-native';

import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  required?: boolean;
}

/**
 * Reusable React Hook Form text field: label + TextInput + inline error.
 * RHF-`Controller`-driven and theme-tokened; reused across profile/goal
 * forms. Presentational only — validation lives in the Zod schema.
 */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  keyboardType = 'default',
  required = false,
}: FormFieldProps<T>) {
  const theme = useTheme();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label">
            {label}
            {required ? ' *' : ''}
          </AppText>
          <TextInput
            accessibilityLabel={label}
            testID={`field-${name}`}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={keyboardType}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value == null ? '' : String(value)}
            style={{
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: error ? theme.colors.error : theme.colors.outline,
              borderRadius: theme.radius.medium,
              borderWidth: 1,
              color: theme.colors.onSurface,
              minHeight: theme.spacing.x5l,
              paddingHorizontal: theme.spacing.md,
              ...theme.typography.body,
            }}
          />
          {error ? (
            <AppText variant="caption" tone="error">
              {error.message}
            </AppText>
          ) : null}
        </View>
      )}
    />
  );
}
