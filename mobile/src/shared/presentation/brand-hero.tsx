import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './app-text';

const brandMark = require('../../../assets/brand/appfitnessrd-mark-v1.png');

interface BrandHeroProps {
  compact?: boolean;
  subtitle: string;
  title?: string;
}

/**
 * Branded orientation surface for the approved Confident Momentum pilot.
 * The artwork is decorative: the adjacent text carries the product identity,
 * so screen readers do not announce the image twice.
 */
export function BrandHero({ compact = false, subtitle, title = 'AppFitnessRD' }: BrandHeroProps) {
  const theme = useTheme();
  const markSize = compact ? 72 : 104;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primaryContainer,
          borderColor: theme.colors.primary,
          borderRadius: theme.radius.extraLarge,
          gap: theme.spacing.lg,
          padding: compact ? theme.spacing.lg : theme.spacing.xxl,
        },
      ]}
      testID="brand-hero"
    >
      <Image
        accessibilityElementsHidden
        accessible={false}
        resizeMode="contain"
        source={brandMark}
        style={{ height: markSize, width: markSize }}
        testID="brand-mark"
      />
      <View style={[styles.copy, { gap: theme.spacing.xs }]}>
        <AppText variant={compact ? 'title' : 'headline'}>{title}</AppText>
        <AppText tone="muted">{subtitle}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  copy: {
    flex: 1,
  },
});
