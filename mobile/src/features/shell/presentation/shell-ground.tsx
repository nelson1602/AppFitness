import { StyleSheet, View } from 'react-native';

import {
  backgroundImageStyle,
  DASHBOARD_GLOW_HEIGHT,
  dashboardGlowImage,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * The design dashboard's glow (v8.1 round 2): fixed at the top of the shell,
 * behind the transparent header and pages, over the solid dark `stage`.
 * Decorative and untouchable.
 */
export function ShellGlow() {
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
      testID="shell-glow"
    />
  );
}

const styles = StyleSheet.create({
  glow: { left: 0, position: 'absolute', right: 0, top: 0 },
});
