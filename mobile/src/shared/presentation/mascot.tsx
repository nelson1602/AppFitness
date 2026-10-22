import { Image, View } from 'react-native';

import { useTheme } from '../theme';
import { backgroundImageStyle, withAlpha } from './gradient-style';

const artFull = require('../../../assets/images/muneco.webp');
const artSolo = require('../../../assets/images/muneco-solo.webp');

/** `muneco.webp` is 941×1672; the hero is its top 941×515 band (approved crop). */
const FULL = { width: 941, height: 1672 };
const HERO_CROP_HEIGHT = 515;

interface MascotProps {
  /** `hero`: the runner and wordmark band fading into the stage; `solo`: the cut-out figure. */
  variant: 'hero' | 'solo';
  /** Set only when the mascot carries meaning; otherwise it is decorative. */
  accessibilityLabel?: string;
  size?: number;
  testID?: string;
}

/**
 * The AppFitnessRD mascot (ADR-P035 D6). Decorative unless labelled: the heading
 * beside it carries the identity. The hero melts into the stage through overlay
 * gradients in the stage colours — React Native has no CSS mask, and this needs
 * no extra asset — so there is no dividing line under the art.
 */
export function Mascot({
  variant,
  accessibilityLabel,
  size = 120,
  testID = 'mascot',
}: MascotProps) {
  const { colors } = useTheme();
  const decorative = accessibilityLabel === undefined;
  const a11y = decorative
    ? ({
        accessibilityElementsHidden: true,
        accessible: false,
        'aria-hidden': true,
        importantForAccessibility: 'no-hide-descendants',
      } as const)
    : ({ accessibilityLabel, accessibilityRole: 'image', accessible: true } as const);

  if (variant === 'solo') {
    return (
      <Image
        {...a11y}
        resizeMode="contain"
        source={artSolo}
        style={{ height: size, width: size }}
        testID={testID}
      />
    );
  }

  return (
    <View
      {...a11y}
      style={{ aspectRatio: FULL.width / HERO_CROP_HEIGHT, overflow: 'hidden', width: '100%' }}
      testID={testID}
    >
      <Image
        resizeMode="cover"
        source={artFull}
        style={{ aspectRatio: FULL.width / FULL.height, width: '100%' }}
        testID={`${testID}-art`}
      />
      {/* Bottom fade into the stage, then soft side edges. */}
      <View
        pointerEvents="none"
        style={[
          { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
          backgroundImageStyle(
            `linear-gradient(180deg, ${withAlpha(colors.stageTop, 0)} 42%, ${withAlpha(colors.stageMid, 0.55)} 70%, ${colors.stageMid} 97%)`,
            'transparent',
          ),
        ]}
        testID={`${testID}-fade`}
      />
      <View
        pointerEvents="none"
        style={[
          { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
          backgroundImageStyle(
            `linear-gradient(90deg, ${colors.stageTop} 0%, ${withAlpha(colors.stageTop, 0)} 10%, ${withAlpha(colors.stageTop, 0)} 90%, ${colors.stageTop} 100%)`,
            'transparent',
          ),
        ]}
      />
    </View>
  );
}
