import type { ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Outline icons drawn from the approved design's own path set (ADR-P037: in-repo
 * SVG paths, no icon font). 24×24 viewBox, round caps and joins. New icons are
 * added here only when a screen needs them.
 */
const PATHS = {
  mail: (
    <>
      <Rect x={3} y={5} width={18} height={14} rx={2} />
      <Path d="m3 7 9 6 9-6" />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  eye: (
    <>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  eyeOff: (
    <>
      <Path d="M3 3l18 18" />
      <Path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  arrow: <Path d="M5 12h14M13 6l6 6-6 6" />,
  bell: (
    <>
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" />
      <Path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  chart: <Path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  dumbbell: <Path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />,
  food: (
    <>
      <Path d="M12 7c-1-3-4-3-5-2-3 2-2 9 1 12 1 1 2 1 4 0 2 1 3 1 4 0 3-3 4-10 1-12-1-1-4-1-5 2z" />
      <Path d="M12 7c0-2 1-4 3-4" />
    </>
  ),
  home: <Path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  user: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  check: <Path d="M5 12l5 5 9-10" />,
  chevron: <Path d="M9 6l6 6-6 6" />,
  back: <Path d="M15 6l-6 6 6 6" />,
  pencil: <Path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />,
  clipboard: (
    <>
      <Rect x={5} y={4} width={14} height={17} rx={2} />
      <Path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </>
  ),
  drop: <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  flame: <Path d="M12 3s5 4.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3 0-3 .5-5.5.5-8z" />,
  heart: <Path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  logout: (
    <>
      <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <Path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  refresh: (
    <Path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4" />
  ),
  scale: (
    <>
      <Path d="M5 20h14a1 1 0 0 0 1-1L18 7H6L4 19a1 1 0 0 0 1 1z" />
      <Path d="M9 11a3 3 0 0 1 6 0" />
    </>
  ),
  shield: (
    <>
      <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  ),
  sparkle: (
    <>
      <Path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z" />
      <Path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  // From the prototype (PR #238): the past-weeks panel and the date fields.
  calendar: (
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2} />
      <Path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  target: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={5} />
      <Circle cx={12} cy={12} r={1} />
    </>
  ),
  watch: (
    <>
      <Rect x={6} y={6} width={12} height={12} rx={3} />
      <Path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 10v2l1.5 1" />
    </>
  ),
  x: <Path d="M6 6l12 12M18 6 6 18" />,
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
  testID?: string;
}

/**
 * Decorative by default: an icon beside visible text duplicates that text, so it
 * is hidden from assistive technology (.ai/08_UI_UX.md §Icons). An icon-only
 * control names itself on the control, not on the glyph.
 */
export function Icon({ name, color, size = 20, strokeWidth = 2, testID }: IconProps) {
  // Hidden through a View: react-native-svg forwards unknown props to the DOM
  // <svg> on Web, where React Native accessibility props are not attributes.
  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg
        fill="none"
        height={size}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        viewBox="0 0 24 24"
        width={size}
      >
        {PATHS[name]}
      </Svg>
    </View>
  );
}
