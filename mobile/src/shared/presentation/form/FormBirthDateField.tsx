import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { BirthDateField } from '../birth-date-field';

interface FormBirthDateFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** The local calendar day, `YYYY-MM-DD`. */
  today: string;
  required?: boolean;
}

/**
 * v8.1 (ADR-P043 amendment): a React Hook Form birth date that opens the
 * Día / Mes / Año wheel. The form value stays the `YYYY-MM-DD` string the
 * feature's Zod schema validates, and the field keeps the `field-<name>` test
 * id of `FormDateField`.
 */
export function FormBirthDateField<T extends FieldValues>({
  control,
  name,
  label,
  today,
  required = false,
}: FormBirthDateFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <BirthDateField
          error={error?.message}
          label={required ? `${label} *` : label}
          onChange={onChange}
          testID={`field-${name}`}
          today={today}
          value={typeof value === 'string' && value.length > 0 ? value : null}
        />
      )}
    />
  );
}
