import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { withAlpha } from './gradient-style';

interface HeroFadeProps {
  children: ReactNode;
  /** Any opaque token colour; only its alpha ramp is used as the mask. */
  maskColor: string;
}

/** react-native-web prefixes and forwards `maskImage` to the DOM style. */
type WebMaskStyle = ViewStyle & { maskImage: string; maskComposite: string };

/**
 * Web form of `hero-fade.tsx`: the same bottom alpha fade as a CSS
 * `mask-image`, intersected with soft side edges (the design's `art-hero`
 * mask) so the art also melts sideways on wide screens, with no edge at all.
 */
export function HeroFade({ children, maskColor }: HeroFadeProps) {
  const mask: WebMaskStyle = {
    flex: 1,
    maskComposite: 'intersect',
    maskImage: [
      `linear-gradient(180deg, ${maskColor} 0%, ${maskColor} 42%, ${withAlpha(maskColor, 0.55)} 68%, ${withAlpha(maskColor, 0)} 96%)`,
      `linear-gradient(90deg, ${withAlpha(maskColor, 0)} 0%, ${maskColor} 10%, ${maskColor} 90%, ${withAlpha(maskColor, 0)} 100%)`,
    ].join(', '),
  };
  return (
    <View style={mask} testID="hero-fade">
      {children}
    </View>
  );
}
