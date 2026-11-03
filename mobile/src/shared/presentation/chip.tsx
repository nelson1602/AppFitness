import { Text, View } from 'react-native';

import { useTheme } from '../theme';

type ChipTone = 'cyan' | 'energy' | 'neutral' | 'success';

interface ChipProps {
  label: string;
  tone?: ChipTone;
  testID?: string;
}

/**
 * A passive status label on the stage (ADR-P035), in the design's tinted
 * form (v8.1 round 2): a translucent fill of the tone with its light text. The
 * text names the state — colour is never the only signal — and each tone's
 * text is contrast-gated over its fill on the stage grounds.
 */
export function Chip({ label, tone = 'neutral', testID = 'chip' }: ChipProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [fill, color] = {
    cyan: [colors.chipCyan, colors.onChipCyan],
    energy: [colors.chipEnergy, colors.onChipEnergy],
    neutral: [colors.chipNeutral, colors.onChipNeutral],
    success: [colors.chipSuccess, colors.onChipSuccess],
  }[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: fill,
        borderRadius: radius.full,
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
