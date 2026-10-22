import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '../theme';
import { withAlpha } from './gradient-style';
import { useReducedMotion } from './use-reduced-motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The approved design's heartbeat line, drawn in a 342×56 box. */
const PULSE_PATH =
  'M0 28H96L106 28L116 10L128 50L140 4L152 42L162 28H232L242 28L250 16L260 40L268 28H342';
const DASH = '150 370';
const DASH_CYCLE = 520;
/** One sweep every 2.4 s, the design's `pulse-run` timing. */
const SWEEP_MS = 2400;

interface PulseProps {
  height?: number;
  /** Distinct per screen so two pulses never share a gradient id on Web. */
  gradientId: string;
  testID?: string;
}

/**
 * The brand heartbeat (ADR-P035 D5, D7). It is brand energy, never a vital sign:
 * it is not driven by data and is hidden from assistive technology.
 *
 * Under reduced motion it is completely still — the full line drawn in the
 * gradient, with no sweep — so no information depends on the movement.
 */
export function Pulse({ height = 34, gradientId, testID = 'pulse' }: PulseProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(DASH_CYCLE);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(offset);
      return;
    }
    offset.value = DASH_CYCLE;
    offset.value = withRepeat(
      withTiming(0, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(offset);
  }, [offset, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, width: '100%' }}
      testID={testID}
    >
      <Svg height={height} preserveAspectRatio="none" viewBox="0 0 342 56" width="100%">
        <Defs>
          <LinearGradient
            gradientUnits="userSpaceOnUse"
            id={gradientId}
            x1={0}
            x2={342}
            y1={0}
            y2={0}
          >
            <Stop offset={0} stopColor={colors.accentCyan} />
            <Stop offset={0.55} stopColor={colors.onStageVariant} />
            <Stop offset={1} stopColor={colors.accentEnergy} />
          </LinearGradient>
        </Defs>
        <Path
          d={PULSE_PATH}
          fill="none"
          stroke={withAlpha(colors.onStage, 0.14)}
          strokeLinejoin="round"
          strokeWidth={2}
        />
        {reduceMotion ? (
          <Path
            d={PULSE_PATH}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3.4}
            testID={`${testID}-static`}
          />
        ) : (
          <AnimatedPath
            animatedProps={animatedProps}
            d={PULSE_PATH}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeDasharray={DASH}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3.4}
            testID={`${testID}-sweep`}
          />
        )}
      </Svg>
    </View>
  );
}
