import { Text, View } from 'react-native';

import { useTheme } from '../theme';

type ChipTone = 'cyan' | 'energy' | 'neutral';

interface ChipProps {
  label: string;
  tone?: ChipTone;
  testID?: string;
}

/**
 * A passive status label on the stage (ADR-P035). The text names the state, and
 * the tone colours its border and text — colour is never the only signal.
 * Tone foregrounds are contrast-gated on every stage ground.
 */
export function Chip({ label, tone = 'neutral', testID = 'chip' }: ChipProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const color = {
    cyan: colors.accentCyan,
    energy: colors.accentEnergy,
    neutral: colors.onStageVariant,
  }[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderColor: color,
        borderRadius: radius.full,
        borderWidth: 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
      testID={testID}
    >
      <Text allowFontScaling style={[typography.caption, { color }]}>
        {label}
      </Text>
    </View>
  );
}
