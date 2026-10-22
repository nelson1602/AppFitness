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
  face: (
    <>
      <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <Path d="M9 9v1M15 9v1M12 9v4h-1M9 16c1.7 1.3 4.3 1.3 6 0" />
    </>
  ),
  finger: (
    <>
      <Path d="M12 11v3a8 8 0 0 1-1 4" />
      <Path d="M8 12a4 4 0 0 1 8 0v1" />
      <Path d="M5 10a7 7 0 0 1 14 0v3" />
      <Path d="M16 17a14 14 0 0 1-.5 3" />
      <Path d="M8 16a12 12 0 0 1-1 4" />
    </>
  ),
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
