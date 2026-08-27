import { View } from 'react-native';

import { AppText, AppTextInput } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

interface AuthTextFieldProps {
  label: string;
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  /** Inline validation message; rendered below the input when present. */
  error?: string;
}

/**
 * Label + input + inline error for the password-recovery screens.
 *
 * Deliberately not react-hook-form: the recovery screens have one or two
 * fields and no schema, and the sign-in surface they sit alongside uses the
 * same plain-state shape. `FormField` remains the primitive for the
 * schema-driven profile/goal/medical forms.
 */
export function AuthTextField({
  label,
  testID,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  error,
}: AuthTextFieldProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <AppTextInput
        accessibilityLabel={label}
        testID={testID}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        value={value}
      />
      {error ? (
        // Matches the FormField pattern (ADR-P024 Decision 3): request a polite
        // announcement of the already-rendered message. Android and Web only.
        <AppText aria-live="polite" testID={`${testID}-error`} variant="caption" tone="error">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
