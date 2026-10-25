import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '../theme';
import { withAlpha } from './gradient-style';

type RingTone = 'energy' | 'cyan' | 'success';

interface RingProps {
  /** Progress from 0 to 1; values outside are clamped. */
  value: number;
  /** Spoken name, e.g. "3 of 4 workouts this week". The ring is never colour-only. */
  accessibilityLabel: string;
  tone?: RingTone;
  size?: number;
  strokeWidth?: number;
  /** Optional centre content (visible value). Hidden from AT; the label carries it. */
  children?: ReactNode;
  testID?: string;
}

/**
 * Circular progress (ADR-P035). Exposed as a progress bar with a numeric value
 * and a caller-supplied text name, so the meaning never rests on the arc or
 * its colour alone (ADR-P022 D7).
 */
export function Ring({
  value,
  accessibilityLabel,
  tone = 'energy',
  size = 96,
  strokeWidth = 9,
  children,
  testID = 'ring',
}: RingProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = { energy: colors.accentEnergy, cyan: colors.accentCyan, success: colors.success }[
    tone
  ];

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      accessible
      style={{ alignItems: 'center', height: size, justifyContent: 'center', width: size }}
      testID={testID}
    >
      <Svg height={size} style={{ position: 'absolute' }} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={withAlpha(colors.onStage, 0.14)}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          // A plain SVG transform: `rotation`/`origin` became an invalid
          // `transform-origin` DOM attribute on Web (React dev warning).
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          testID={`${testID}-arc`}
        />
      </Svg>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    </View>
  );
}
