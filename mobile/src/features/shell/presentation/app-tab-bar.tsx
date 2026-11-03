import { useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalization } from '@/shared/localization';
import { backgroundImageStyle, ctaBackgroundImage, Icon } from '@/shared/presentation';
import { type Theme, useTheme } from '@/shared/theme';

import { TABS } from './tab-config';

export interface AppTabBarProps {
  activeIndex: number;
  onSelect: (index: number) => void;
  progress?: Animated.Value | Animated.AnimatedInterpolation<number>;
}

/** The floating bar's inset from the screen edges (design: 12). */
const barInset = (spacing: Theme['spacing']) => spacing.md;

/**
 * Scroll room a tab page leaves at its end so its last card clears the
 * floating bar: the inset, the bar (a 48 tab plus its padding) and a gap.
 */
export function tabBarClearance(spacing: Theme['spacing'], bottomInset: number): number {
  return bottomInset + barInset(spacing) + spacing.x5l + spacing.sm * 2 + spacing.lg;
}

/**
 * The design's pill tab bar for the stable expo-router `Tabs` (ADR-P039 D1).
 *
 * Selected is never colour alone (ADR-P022 D7): the active tab is a filled
 * gradient pill that shows its label, and it is `selected` to assistive
 * technology. Inactive tabs are icon-only, each named by its label. It floats
 * over the page (v8.1 round 2): inset 12, radius 26, translucent navy.
 */
export function AppTabBar({ activeIndex, onSelect, progress }: AppTabBarProps) {
  const theme = useTheme();
  const { colors, radius, spacing, typography } = theme;
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  const settledProgress = useMemo(() => new Animated.Value(activeIndex), [activeIndex]);
  const pageProgress = progress ?? settledProgress;

  return (
    <View
      style={{
        backgroundColor: colors.tabBarFill,
        borderColor: colors.tabBarBorder,
        borderRadius: radius.bar,
        borderWidth: 1,
        bottom: insets.bottom + barInset(spacing),
        left: barInset(spacing),
        padding: spacing.sm,
        position: 'absolute',
        right: barInset(spacing),
      }}
      testID="tab-bar"
    >
      <View accessibilityRole="tablist" style={[styles.row, { gap: spacing.xs }]} testID="tab-list">
        {TABS.map((tab, index) => {
          const focused = activeIndex === index;
          const label = t(tab.labelKey);
          const opacity = pageProgress.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          });
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={tab.name}
              onPress={() => onSelect(index)}
              style={[
                styles.tab,
                {
                  borderRadius: radius.full,
                  // The active pill gives way at large text so the other four
                  // tabs stay on screen (v8 Block 5 copy pass).
                  flexShrink: focused ? 1 : 0,
                  gap: spacing.xs,
                  minHeight: theme.spacing.x5l,
                  minWidth: theme.spacing.x5l,
                  paddingHorizontal: focused ? spacing.md : 0,
                },
              ]}
              testID={`tab-${tab.name}`}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  backgroundImageStyle(ctaBackgroundImage(colors), colors.ctaStart),
                  { borderRadius: radius.full, opacity },
                ]}
                testID={`tab-${tab.name}-pill`}
              />
              <Icon
                color={focused ? colors.onCta : colors.onStageVariant}
                name={tab.icon}
                size={22}
              />
              {focused ? (
                <Text
                  adjustsFontSizeToFit
                  allowFontScaling
                  minimumFontScale={0.5}
                  numberOfLines={1}
                  style={[typography.label, { color: colors.onCta, flexShrink: 1 }]}
                  testID={`tab-${tab.name}-label`}
                >
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tab: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
