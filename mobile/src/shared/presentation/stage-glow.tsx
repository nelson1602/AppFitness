import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { backgroundImageStyle } from './gradient-style';
import { DASHBOARD_GLOW_HEIGHT, dashboardGlowImage } from './stage-style';

/**
 * The design dashboard's top glow over the solid dark `stage` (v8.1 round 2).
 * The tab shell draws it once behind its transparent header; a pushed screen
 * (v10 Block C) draws its top slice in the stack header and the rest in the
 * content, `offset` points higher, so the two meet without a seam.
 * Decorative and untouchable.
 */
export function StageGlow({ offset = 0, testID }: { offset?: number; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.glow,
        backgroundImageStyle(dashboardGlowImage(colors), 'transparent'),
        { height: DASHBOARD_GLOW_HEIGHT, top: -offset },
      ]}
      testID={testID}
    />
  );
}

/**
 * A stack header's background (v10 Block C): the solid stage with the glow's
 * top slice; the screen below continues it (`Screen`, stage `under-header`).
 */
export function StageHeaderBackground() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.header, { backgroundColor: colors.stage }]}
      testID="stage-header-background"
    >
      <StageGlow />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { left: 0, position: 'absolute', right: 0 },
  header: { flex: 1, overflow: 'hidden' },
});
