import { useId } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Platform, TextInput, View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from '../app-text';
import { usePaidWriteDisabled } from '../paid-write-context';

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  required?: boolean;
  /**
   * Select the field's whole value when it gains focus. Opt-in (default off) so
   * existing create-style forms are unaffected; enable it for edit forms that
   * prefill a value so tapping in replaces the text deterministically instead
   * of leaving a mid-cursor that mangles a subsequent overwrite.
   */
  selectTextOnFocus?: boolean;
}

/**
 * Reusable React Hook Form text field: label + TextInput + inline error.
 * RHF-`Controller`-driven and theme-tokened; shared across the profile,
 * goal, and medical forms. Presentational only — validation lives in each
 * feature's Zod schema.
 */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  keyboardType = 'default',
  required = false,
  selectTextOnFocus = false,
}: FormFieldProps<T>) {
  const theme = useTheme();
  const disabled = usePaidWriteDisabled();
  // BUG-033: TalkBack names an Android EditText by its placeholder or value, so
  // the visible label is linked as the name. `accessibilityLabel` is then not
  // passed on Android (owner Option B): TalkBack reads it as text on an empty
  // field with no placeholder, which spoke the label twice. Web and iOS keep
  // `accessibilityLabel` alone; on Web `aria-labelledby` would override it.
  const labelId = useId();
  const labelledBy = Platform.OS === 'android' ? labelId : undefined;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View>
          <View style={{ gap: theme.spacing.xs }}>
            <AppText nativeID={labelledBy} variant="label">
              {label}
              {required ? ' *' : ''}
            </AppText>
            <TextInput
              accessibilityLabel={labelledBy ? undefined : label}
              accessibilityLabelledBy={labelledBy}
              accessibilityState={disabled ? { disabled: true } : undefined}
              testID={`field-${name}`}
              autoCapitalize="none"
              autoCorrect={false}
              editable={disabled ? false : undefined}
              selectTextOnFocus={selectTextOnFocus}
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
                opacity: disabled ? 0.56 : 1,
                minHeight: theme.spacing.x5l,
                paddingHorizontal: theme.spacing.md,
                ...theme.typography.body,
              }}
            />
          </View>
          {/*
           * BUG-034 (Android) and BUG-038 (Web): a live region is announced
           * when its text changes, never when it is inserted already holding
           * text. On Android and Web the message is therefore an always-mounted,
           * initially empty live region, kept at zero height while empty.
           * Android uses the native live region (`Text` does not map
           * `aria-live` there); react-native-web maps `aria-live` to the DOM.
           * Spacing matches the former `gap` only while a message is shown.
           */}
          <View style={error ? { marginTop: theme.spacing.xs } : undefined}>
            {Platform.OS !== 'ios' ? (
              <AppText
                accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
                aria-live={Platform.OS === 'web' ? 'polite' : undefined}
                style={error ? undefined : { height: 0 }}
                variant="caption"
                tone="error"
              >
                {error?.message ?? ''}
              </AppText>
            ) : error ? (
              // iOS: UX-1C-2B-a's request is kept unchanged (not announced on iOS).
              <AppText aria-live="polite" variant="caption" tone="error">
                {error.message}
              </AppText>
            ) : null}
          </View>
        </View>
      )}
    />
  );
}
