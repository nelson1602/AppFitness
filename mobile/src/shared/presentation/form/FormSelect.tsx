import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from '../app-text';

interface Option {
  label: string;
  value: string;
}

interface FormSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: readonly Option[];
  required?: boolean;
}

/**
 * Reusable React Hook Form enum selector rendered as a row of pressable
 * chips (no UI framework / native picker). RHF-`Controller`-driven.
 * Shared across the profile, goal, and medical forms.
 */
export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  options,
  required = false,
}: FormSelectProps<T>) {
  const theme = useTheme();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label">
            {label}
            {required ? ' *' : ''}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {options.map((opt) => {
              const selected = value === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label}: ${opt.label}`}
                  testID={`option-${name}-${opt.value}`}
                  onPress={() => onChange(opt.value)}
                  style={{
                    backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceVariant,
                    borderColor: selected ? theme.colors.primary : theme.colors.outline,
                    borderRadius: theme.radius.medium,
                    borderWidth: 1,
                    minHeight: theme.spacing.x5l,
                    justifyContent: 'center',
                    paddingHorizontal: theme.spacing.md,
                  }}
                >
                  <AppText tone={selected ? 'default' : 'muted'}>{opt.label}</AppText>
                </Pressable>
              );
            })}
          </View>
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
