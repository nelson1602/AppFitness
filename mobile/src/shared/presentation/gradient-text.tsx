import MaskedView from '@react-native-masked-view/masked-view';
import { Text, View, type TextStyle } from 'react-native';

import { backgroundImageStyle } from './gradient-style';

interface GradientTextProps {
  children: string;
  /** Typography of the surrounding text, so the masked words line up with it. */
  textStyle: TextStyle;
  start: string;
  end: string;
  testID?: string;
}

/**
 * Text filled with a horizontal gradient (ADR-P037 amendment, native form):
 * the text shape masks a gradient view. The visible copy is decorative — the
 * caller exposes the whole sentence as one accessible name — so neither the mask
 * nor the sizing copy is read twice. `gradient-text.web.tsx` is the Web form.
 * Both endpoints are contrast-gated on every stage ground.
 */
export function GradientText({
  children,
  textStyle,
  start,
  end,
  testID = 'gradient-text',
}: GradientTextProps) {
  return (
    <MaskedView
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      maskElement={
        <Text allowFontScaling style={textStyle}>
          {children}
        </Text>
      }
      testID={testID}
    >
      <View style={backgroundImageStyle(`linear-gradient(90deg, ${start}, ${end})`, start)}>
        {/* Sizes the gradient to the words; never visible. */}
        <Text allowFontScaling style={[textStyle, { opacity: 0 }]}>
          {children}
        </Text>
      </View>
    </MaskedView>
  );
}
