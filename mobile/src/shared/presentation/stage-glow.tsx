import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { backgroundImageStyle } from './gradient-style';
import { DASHBOARD_GLOW_HEIGHT, dashboardGlowImage } from './stage-style';

/**
 * The design dashboard's top glow over the solid dark `stage` (v8.1 round 2),
 * fixed at the top of the screen behind a transparent header: the tab shell's
 * and, since v10 Block C, every pushed screen's (`Screen`, stage `under-header`).
 * Decorative and untouchable.
 */
export function StageGlow({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.glow,
        backgroundImageStyle(dashboardGlowImage(colors), 'transparent'),
        { height: DASHBOARD_GLOW_HEIGHT },
      ]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  glow: { left: 0, position: 'absolute', right: 0, top: 0 },
});
