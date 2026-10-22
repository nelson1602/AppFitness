import MaskedView from '@react-native-masked-view/masked-view';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { backgroundImageStyle, withAlpha } from './gradient-style';

interface HeroFadeProps {
  children: ReactNode;
  /** Any opaque token colour; only its alpha ramp is used as the mask. */
  maskColor: string;
}

/**
 * Fades its content to fully transparent toward the bottom, so the art melts
 * into whatever stage is behind it with no edge (ADR-P035 D6). Native form: an
 * alpha mask through MaskedView. `hero-fade.web.tsx` uses CSS `mask-image`.
 */
export function HeroFade({ children, maskColor }: HeroFadeProps) {
  return (
    <MaskedView
      maskElement={
        <View
          style={[
            { flex: 1 },
            backgroundImageStyle(
              `linear-gradient(180deg, ${maskColor} 0%, ${maskColor} 42%, ${withAlpha(maskColor, 0.55)} 68%, ${withAlpha(maskColor, 0)} 96%)`,
              'transparent',
            ),
          ]}
        />
      }
      style={{ flex: 1 }}
      testID="hero-fade"
    >
      {children}
    </MaskedView>
  );
}
