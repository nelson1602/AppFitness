import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { interpolate, useLocalization } from '@/shared/localization';
import { useReducedMotion } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import {
  FIGURE_CYCLE_MS,
  FIGURE_STILL_PHASE,
  figureCarriesLoad,
  type FigureMotion,
  figurePose,
  figurePropFor,
  type Joint,
  limbPath,
} from '../domain/exercise-figure';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** The farmer's-carry dumbbell, centred under the hand. */
const LOAD_WIDTH = 14;

/** The prototype draws the figure 180 high in a 120×100 box. */
const FIGURE_HEIGHT = 180;

/** Back limbs first, so the front leg and arm draw over them (prototype order). */
const LIMBS: readonly { joints: readonly Joint[]; front: boolean }[] = [
  { joints: ['p', 'k2', 'f2'], front: false },
  { joints: ['s', 'e2', 'w2'], front: false },
  // Through the mid-back, so the spine can arch (cat-cow); straight otherwise.
  { joints: ['s', 'm', 'p'], front: true },
  { joints: ['p', 'k1', 'f1'], front: true },
  { joints: ['s', 'e1', 'w1'], front: true },
];

/**
 * The prototype's demo figure: a glowing stick figure easing between the two
 * poses of the movement (2.4 s cycle). Under reduced motion it holds the
 * prototype's first frame. Decorative to assistive technology beyond its
 * label — the numbered cues beside it carry the instructions.
 */
export function ExerciseFigure({
  motion,
  exerciseName,
  idSuffix,
}: {
  motion: FigureMotion;
  exerciseName: string;
  /** Distinct per figure so two open demos never share gradient ids. */
  idSuffix: string;
}) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(FIGURE_STILL_PHASE);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(phase);
      phase.value = FIGURE_STILL_PHASE;
      return;
    }
    phase.value = FIGURE_STILL_PHASE;
    phase.value = withRepeat(
      withTiming(1 + FIGURE_STILL_PHASE, { duration: FIGURE_CYCLE_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(phase);
  }, [phase, reduceMotion]);

  const front = `figureFront-${idSuffix}`;
  const back = `figureBack-${idSuffix}`;
  const prop = figurePropFor(motion);
  const propStroke = { stroke: colors.figurePropLine, strokeOpacity: 0.5 };

  return (
    <Svg
      accessibilityLabel={interpolate(t('workout.demo.figureLabel'), { name: exerciseName })}
      accessibilityRole="image"
      accessible
      height={FIGURE_HEIGHT}
      testID="workout-exercise-figure"
      viewBox="0 0 120 100"
      width="100%"
    >
      <Defs>
        <LinearGradient id={front} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={colors.figureLight} />
          <Stop offset="1" stopColor={colors.figureLightEnd} />
        </LinearGradient>
        <LinearGradient id={back} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={colors.figureShade} />
          <Stop offset="1" stopColor={colors.figureShadeEnd} />
        </LinearGradient>
      </Defs>
      <Line
        stroke={colors.figureGround}
        strokeOpacity={0.35}
        strokeWidth={1}
        x1={4}
        x2={116}
        y1={95}
        y2={95}
      />
      {prop === 'bench' ? (
        <Rect fill={colors.figureProp} height={5} rx={2} width={56} x={16} y={64} {...propStroke} />
      ) : null}
      {prop === 'seat' ? (
        <Path
          d="M40 69h32M44 69v26M68 69v26M42 69V36"
          fill="none"
          strokeLinecap="round"
          strokeWidth={3}
          {...propStroke}
        />
      ) : null}
      {prop === 'box' ? (
        <Rect
          fill={colors.figureProp}
          height={29}
          rx={3}
          width={24}
          x={82}
          y={66}
          {...propStroke}
        />
      ) : null}
      {prop === 'bike' ? (
        <G
          fill="none"
          stroke={colors.figurePropLine}
          strokeLinecap="round"
          strokeOpacity={0.55}
          strokeWidth={2.5}
        >
          <Circle cx={60} cy={78} r={13} />
          <Path d="M46 58L60 78L78 46M74 46h8M42 58h10M60 78l8 17M60 78l-10 17" />
        </G>
      ) : null}
      {/* v10 Block C, item 11: the props of the new movements, same strokes. */}
      {prop === 'bars' ? (
        <Path
          d="M40 59h40M44 59v36M76 59v36"
          fill="none"
          strokeLinecap="round"
          strokeWidth={3}
          {...propStroke}
        />
      ) : null}
      {prop === 'rowSeat' ? (
        <G>
          <Rect
            fill={colors.figureProp}
            height={5}
            rx={2}
            width={30}
            x={28}
            y={81}
            {...propStroke}
          />
          <Path
            d="M88 72v23M88 72L100 60"
            fill="none"
            strokeLinecap="round"
            strokeWidth={3}
            {...propStroke}
          />
        </G>
      ) : null}
      {prop === 'lowBox' ? (
        <Rect
          fill={colors.figureProp}
          height={15}
          rx={3}
          width={28}
          x={83}
          y={80}
          {...propStroke}
        />
      ) : null}
      {prop === 'legPress' ? (
        <Path
          d="M16 40L38 80h18M60 66L100 41"
          fill="none"
          strokeLinecap="round"
          strokeWidth={3}
          {...propStroke}
        />
      ) : null}
      {LIMBS.map(({ joints, front: isFront }) => (
        <Limb
          gradient={`url(#${isFront ? front : back})`}
          halo={colors.figureHalo}
          joints={joints}
          key={joints.join('')}
          motion={motion}
          phase={phase}
        />
      ))}
      {figureCarriesLoad(motion)
        ? (['w2', 'w1'] as const).map((joint) => (
            <Load
              fill={colors.figureProp}
              joint={joint}
              key={joint}
              motion={motion}
              phase={phase}
              stroke={colors.figurePropLine}
            />
          ))
        : null}
      <Head fill={colors.figureHalo} motion={motion} opacity={0.28} phase={phase} radius={9.5} />
      <Head fill={`url(#${front})`} motion={motion} opacity={1} phase={phase} radius={7} />
    </Svg>
  );
}

interface FigurePartProps {
  motion: FigureMotion;
  phase: SharedValue<number>;
}

function Limb({
  motion,
  phase,
  joints,
  gradient,
  halo,
}: FigurePartProps & { joints: readonly Joint[]; gradient: string; halo: string }) {
  const haloProps = useAnimatedProps(() => ({
    d: limbPath(figurePose(motion, phase.value % 1), joints),
  }));
  const strokeProps = useAnimatedProps(() => ({
    d: limbPath(figurePose(motion, phase.value % 1), joints),
  }));
  return (
    <G>
      <AnimatedPath
        animatedProps={haloProps}
        fill="none"
        stroke={halo}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.28}
        strokeWidth={12}
      />
      <AnimatedPath
        animatedProps={strokeProps}
        fill="none"
        stroke={gradient}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={7}
      />
    </G>
  );
}

/** A dumbbell held in the hand (farmer's carry): it moves with the wrist. */
function Load({
  motion,
  phase,
  joint,
  fill,
  stroke,
}: FigurePartProps & { joint: 'w1' | 'w2'; fill: string; stroke: string }) {
  const animatedProps = useAnimatedProps(() => {
    const [x, y] = figurePose(motion, phase.value % 1)[joint];
    return { x: x - LOAD_WIDTH / 2, y: y + 1 };
  });
  return (
    <AnimatedRect
      animatedProps={animatedProps}
      fill={fill}
      height={6}
      rx={2}
      stroke={stroke}
      strokeOpacity={0.6}
      strokeWidth={1.5}
      width={LOAD_WIDTH}
    />
  );
}

function Head({
  motion,
  phase,
  radius,
  fill,
  opacity,
}: FigurePartProps & { radius: number; fill: string; opacity: number }) {
  const animatedProps = useAnimatedProps(() => {
    const [cx, cy] = figurePose(motion, phase.value % 1).h;
    return { cx, cy };
  });
  return <AnimatedCircle animatedProps={animatedProps} fill={fill} opacity={opacity} r={radius} />;
}
