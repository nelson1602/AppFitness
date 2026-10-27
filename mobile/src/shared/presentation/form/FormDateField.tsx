import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { View } from 'react-native';

import { useLocalization } from '../../localization/use-localization';
import { useTheme } from '../../theme';
import { AppButton } from '../app-button';
import { DateField } from '../date-field';

interface FormDateFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  /** `YYYY-MM-DD` bounds, inclusive. */
  minimumDate?: string;
  maximumDate?: string;
  /** Date the picker opens on when the field is empty. */
  initialDate?: string;
}

/**
 * v8 Block 3 (ADR-P043): a React Hook Form date that opens the native picker
 * instead of asking for typed `YYYY-MM-DD` text. The form value stays the
 * `YYYY-MM-DD` string each feature's Zod schema already validates; the field
 * keeps the `field-<name>` test id of the text field it replaces. An optional
 * date can be cleared, since a picker alone cannot empty it.
 */
export function FormDateField<T extends FieldValues>({
  control,
  name,
  label,
  required = false,
  minimumDate,
  maximumDate,
  initialDate,
}: FormDateFieldProps<T>) {
  const { spacing } = useTheme();
  const { t } = useLocalization();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        const iso = typeof value === 'string' && value.length > 0 ? value : null;
        return (
          <View style={{ gap: spacing.xs }}>
            <DateField
              error={error?.message}
              initialDate={initialDate}
              label={required ? `${label} *` : label}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              onChange={onChange}
              testID={`field-${name}`}
              value={iso}
            />
            {!required && iso ? (
              <AppButton
                onPress={() => onChange('')}
                testID={`field-${name}-clear`}
                variant="stage-link"
              >
                {t('form.date.clear')}
              </AppButton>
            ) : null}
          </View>
        );
      }}
    />
  );
}
