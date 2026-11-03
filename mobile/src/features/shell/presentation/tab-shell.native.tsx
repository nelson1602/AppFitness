import TopTabs, { type MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, type Animated, StyleSheet, View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { useReducedMotion, useScreenReader } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { AppHeader } from './app-header';
import { AppTabBar } from './app-tab-bar';
import { ShellGlow } from './shell-ground';
import { TABS, type TabName } from './tab-config';

/**
 * ADR-P044: the five tabs on expo-router's vendored material top tabs
 * (react-native-tab-view over react-native-pager-view), with the tab bar at
 * the bottom. The navigator owns the pages, so they stay mounted while the
 * URL changes. With a screen reader or reduced motion there is no swipe and
 * no animated paging: a tab press switches instantly.
 */
export function TabShell({ activeName }: { activeName: TabName }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const motionAllowed = !reducedMotion && !screenReader;

  return (
    <View style={[styles.shell, { backgroundColor: colors.stage }]} testID="tab-shell">
      <ShellGlow />
      <AppHeader routeName={activeName} />
      <TopTabs
        screenOptions={{
          animationEnabled: motionAllowed,
          lazy: true,
          lazyPreloadDistance: 1,
          sceneStyle: { backgroundColor: 'transparent' },
          swipeEnabled: motionAllowed,
        }}
        tabBar={(props: MaterialTopTabBarProps) => <ShellTabBar {...props} />}
        tabBarPosition="bottom"
      >
        {TABS.map((tab) => (
          <TopTabs.Screen key={tab.name} name={tab.name} />
        ))}
      </TopTabs>
    </View>
  );
}

interface ShellTabBarProps {
  navigation: {
    emit: (event: { canPreventDefault: true; target: string; type: 'tabPress' }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string, params?: object) => void;
  };
  position?: Animated.AnimatedInterpolation<number>;
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
}

/** Adapts the navigator's tab bar props to the design's AppTabBar. */
export function ShellTabBar({ navigation, position, state }: ShellTabBarProps) {
  const { t } = useLocalization();
  const shownIndex = useRef(state.index);

  // The active tab is announced however it changed (press, swipe, deep link).
  useEffect(() => {
    if (shownIndex.current === state.index) return;
    shownIndex.current = state.index;
    const tab = TABS.find((item) => item.name === state.routes[state.index]?.name);
    if (tab) AccessibilityInfo.announceForAccessibility(t(tab.labelKey));
  }, [state.index, state.routes, t]);

  return (
    <AppTabBar
      activeIndex={state.index}
      onSelect={(index) => {
        const route = state.routes[index];
        if (!route) return;
        const event = navigation.emit({
          canPreventDefault: true,
          target: route.key,
          type: 'tabPress',
        });
        if (index !== state.index && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }}
      progress={position}
    />
  );
}

const styles = StyleSheet.create({ shell: { flex: 1 } });
