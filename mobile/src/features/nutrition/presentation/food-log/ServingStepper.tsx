import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

const STEP = 0.25;
const MIN = 0.25;

/** Format a serving count without trailing zeros (1, 1.5, 0.25). */
export function formatServingCount(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/**
 * Compact −/+ stepper for the editable serving-count quantity model (Slice
 * 4A). Fractional servings only — never fabricated gram entry. Accessible:
 * each control has a label and the value is announced.
 */
export function ServingStepper({
  value,
  onChange,
  testIDPrefix,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  testIDPrefix: string;
  disabled?: boolean;
}) {
  const theme = useTheme();

  const button = (sign: -1 | 1, label: string, testID: string): React.ReactElement => {
    const atFloor = sign === -1 && value <= MIN;
    const isDisabled = disabled || atFloor;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled }}
        testID={testID}
        disabled={isDisabled}
        onPress={() => onChange(Math.max(MIN, Math.round((value + sign * STEP) * 100) / 100))}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: theme.spacing.x5l,
          minHeight: theme.spacing.x5l,
          borderRadius: theme.radius.medium,
          borderWidth: 1,
          borderColor: theme.colors.outline,
          backgroundColor: theme.colors.surfaceVariant,
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        <AppText variant="title" tone={isDisabled ? 'muted' : 'primary'}>
          {sign === -1 ? '−' : '+'}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      {button(-1, 'Decrease servings', `${testIDPrefix}-dec`)}
      <AppText
        variant="label"
        testID={`${testIDPrefix}-value`}
        accessibilityLabel={`${formatServingCount(value)} servings`}
        style={{ minWidth: theme.spacing.x3l, textAlign: 'center' }}
      >
        {formatServingCount(value)}×
      </AppText>
      {button(1, 'Increase servings', `${testIDPrefix}-inc`)}
    </View>
  );
}
