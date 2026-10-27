import { createElement } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './app-text';
import type { DateFieldProps } from './date-field';

export type { DateFieldProps } from './date-field';

/**
 * Web DateField (ADR-P043): the native picker module has no Web build, so the
 * browser's own `<input type="date">` is used. Same props, same `YYYY-MM-DD`
 * value.
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
  testID,
}: DateFieldProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText tone="onStage" variant="label">
        {label}
      </AppText>
      {createElement('input', {
        'aria-label': label,
        'data-testid': testID,
        max: maximumDate,
        min: minimumDate,
        onChange: (event: { target: { value: string } }) => {
          if (event.target.value) onChange(event.target.value);
        },
        style: {
          backgroundColor: theme.colors.fieldFill,
          border: `1px solid ${error ? theme.colors.errorOnStage : theme.colors.fieldIcon}`,
          borderRadius: theme.radius.field,
          color: theme.colors.onField,
          font: 'inherit',
          minHeight: theme.spacing.x6l - theme.spacing.xs,
          padding: `0 ${theme.spacing.md}px`,
        },
        type: 'date',
        value: value ?? '',
      })}
      {error ? (
        <AppText tone="errorOnStage" variant="label">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
