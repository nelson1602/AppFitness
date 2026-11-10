import { View } from 'react-native';

import { darkColors, useTheme } from '../theme';
import { withAlpha } from './gradient-style';

type ProgressTone = 'energy' | 'cyan' | 'success';

interface ProgressBarProps {
  /** Progress from 0 to 1; values outside are clamped. */
  value: number;
  /** Spoken name; the bar's meaning never rests on its colour alone. */
  accessibilityLabel: string;
  tone?: ProgressTone;
  height?: number;
  /**
   * `cta`: drawn on the CTA blue (the Inicio goal card) — the dark-mode
   * accents and light track in both themes, since the blue does not change
   * (v10 Block C review).
   */
  surface?: 'stage' | 'cta';
  testID?: string;
}

/** Linear progress (ADR-P035), exposed as a progress bar with a numeric value. */
export function ProgressBar({
  value,
  accessibilityLabel,
  tone = 'cyan',
  height = 8,
  surface = 'stage',
  testID = 'progress-bar',
}: ProgressBarProps) {
  const theme = useTheme();
  const { radius } = theme;
  const colors = surface === 'cta' ? darkColors : theme.colors;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const color = { energy: colors.accentEnergy, cyan: colors.accentCyan, success: colors.success }[
    tone
  ];

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      accessible
      style={{
        backgroundColor: withAlpha(colors.onStage, 0.14),
        borderRadius: radius.full,
        height,
        overflow: 'hidden',
        width: '100%',
      }}
      testID={testID}
    >
      <View
        style={{ backgroundColor: color, height: '100%', width: `${clamped * 100}%` }}
        testID={`${testID}-fill`}
      />
    </View>
  );
}
