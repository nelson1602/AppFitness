import type { ReactElement } from 'react';
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
  return (
    <Svg
      accessibilityElementsHidden
      accessible={false}
      aria-hidden
      fill="none"
      height={size}
      importantForAccessibility="no-hide-descendants"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      testID={testID}
      viewBox="0 0 24 24"
      width={size}
    >
      {PATHS[name]}
    </Svg>
  );
}
