import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { backgroundImageStyle, ctaBackgroundImage, Icon } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { tabOf } from './tab-config';

/**
 * The design's pill tab bar for the stable expo-router `Tabs` (ADR-P039 D1).
 *
 * Selected is never colour alone (ADR-P022 D7): the active tab is a filled
 * gradient pill that shows its label, and it is `selected` to assistive
 * technology. Inactive tabs are icon-only, each named by its label.
 */
export function AppTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const { colors, radius, spacing, typography } = theme;
  const { t } = useLocalization();

  return (
    <View
      style={{
        backgroundColor: colors.stageDeep,
        borderColor: colors.glassBorder,
        borderTopWidth: 1,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
      }}
      testID="tab-bar"
    >
      <View accessibilityRole="tablist" style={[styles.row, { gap: spacing.xs }]} testID="tab-list">
        {state.routes.map((route, index) => {
          const tab = tabOf(route.name);
          if (!tab) return null;
          const focused = state.index === index;
          const label = t(tab.labelKey);
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onPress={onPress}
              style={[
                styles.tab,
                {
                  borderRadius: radius.full,
                  gap: spacing.xs,
                  minHeight: theme.spacing.x5l,
                  minWidth: theme.spacing.x5l,
                  paddingHorizontal: focused ? spacing.md : 0,
                },
                focused
                  ? backgroundImageStyle(ctaBackgroundImage(colors), colors.ctaStart)
                  : undefined,
              ]}
              testID={`tab-${route.name}`}
            >
              <Icon
                color={focused ? colors.onCta : colors.onStageVariant}
                name={tab.icon}
                size={22}
              />
              {focused ? (
                <Text
                  allowFontScaling
                  style={[typography.label, { color: colors.onCta, flexShrink: 1 }]}
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
