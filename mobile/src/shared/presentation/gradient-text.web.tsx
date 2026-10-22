import { Text, type TextStyle } from 'react-native';

interface GradientTextProps {
  children: string;
  textStyle: TextStyle;
  start: string;
  end: string;
  testID?: string;
}

/**
 * Web form of `gradient-text.tsx`. The masked-view library has no Web
 * implementation, so the words fall back to the solid `start` colour (cyan),
 * as the owner approved in the ADR-P037 amendment. Hidden from assistive
 * technology like the native form; the caller names the sentence.
 */
export function GradientText({
  children,
  textStyle,
  start,
  testID = 'gradient-text',
}: GradientTextProps) {
  return (
    <Text aria-hidden allowFontScaling style={[textStyle, { color: start }]} testID={testID}>
      {children}
    </Text>
  );
}
