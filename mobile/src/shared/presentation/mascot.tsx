import { useState } from 'react';
import { Image, View } from 'react-native';

import { useTheme } from '../theme';
import { HeroFade } from './hero-fade';

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
 * beside it carries the identity. The hero melts into the stage through an alpha
 * mask (`HeroFade`), so there is no dividing line under the art and no extra
 * asset is needed.
 */
export function Mascot({
  variant,
  accessibilityLabel,
  size = 120,
  testID = 'mascot',
}: MascotProps) {
  const { colors } = useTheme();
  // The hero is sized from its measured width: an aspect-ratio Image inside an
  // aspect-ratio box did not size reliably on Android, which zoomed the art.
  const [width, setWidth] = useState(0);
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
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ aspectRatio: FULL.width / HERO_CROP_HEIGHT, overflow: 'hidden', width: '100%' }}
      testID={testID}
    >
      {/* A true alpha fade, so the art melts into the stage with no edge. */}
      <HeroFade maskColor={colors.stage}>
        {width > 0 ? (
          <Image
            resizeMode="stretch"
            source={artFull}
            style={{ height: (width * FULL.height) / FULL.width, width }}
            testID={`${testID}-art`}
          />
        ) : null}
      </HeroFade>
    </View>
  );
}
