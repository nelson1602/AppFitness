import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './app-text';
import { brandGradientStyle } from './brand-gradient';

const brandMark = require('../../../assets/brand/appfitnessrd-mark-v1.png');

interface BrandHeroProps {
  compact?: boolean;
  subtitle: string;
  title?: string;
}

/**
 * The AppFitnessRD identity header (ADR-P022 Addendum C): the runner/heartbeat
 * mark inside a cyan halo, over the blue identity gradient. Sign-in and
 * Dashboard only.
 *
 * - The artwork is decorative: the product name beside it carries the identity
 *   and is the screen's header, so assistive technology announces it once.
 * - The mark is sized to stay compact, so the sign-in form starts in the first
 *   viewport; it reads at this size without the glow, which is a soft shadow
 *   on the halo and never the only edge of the mark.
 * - Static: no animation of any kind.
 */
export function BrandHero({ compact = false, subtitle, title = 'AppFitnessRD' }: BrandHeroProps) {
  const theme = useTheme();
  const { colors } = theme;
  const markSize = compact ? 48 : 64;
  const haloSize = markSize + theme.spacing.md;

  return (
    <View
      style={[
        styles.container,
        brandGradientStyle(colors),
        {
          borderRadius: theme.radius.extraLarge,
          gap: compact ? theme.spacing.md : theme.spacing.lg,
          padding: compact ? theme.spacing.md : theme.spacing.lg,
        },
      ]}
      testID="brand-hero"
    >
      <View
        style={[
          styles.halo,
          {
            backgroundColor: colors.brand,
            borderColor: colors.brandGlow,
            borderRadius: haloSize / 2,
            boxShadow: `0 0 ${theme.spacing.lg}px ${colors.brandGlow}66`,
            height: haloSize,
            width: haloSize,
          },
        ]}
        testID="brand-halo"
      >
        <Image
          accessibilityElementsHidden
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          resizeMode="contain"
          source={brandMark}
          style={{ height: markSize, width: markSize }}
          testID="brand-mark"
        />
      </View>
      <View style={[styles.copy, { gap: theme.spacing.xs }]}>
        <AppText accessibilityRole="header" tone="onBrand" variant={compact ? 'title' : 'headline'}>
          {title}
        </AppText>
        <AppText tone="onBrandVariant">{subtitle}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  copy: {
    flex: 1,
  },
  halo: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
});
