import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { useLocalization } from '@/shared/localization';
import { useReducedMotion, useScreenReader } from '@/shared/presentation';

import { AppHeader } from './app-header';
import { AppTabBar } from './app-tab-bar';
import { TABS, type TabName } from './tab-config';
import { TabPagerGestureProvider } from './tab-pager-gesture';
import { TabPage } from './tab-page';

/**
 * ADR-P044: the five tabs in one native pager. The URL stays the source of
 * truth for which tab is shown: a swipe or a tab press replaces the route, and
 * a route change from elsewhere (a notification, a deep link) moves the pager.
 */
export function TabShell({ activeName }: { activeName: TabName }) {
  const requestedIndex = TABS.findIndex((tab) => tab.name === activeName);
  // The page shown, which follows the route; adjusted during render when the
  // route changes (React's "previous value in state" pattern, no effect).
  const [activeIndex, setActiveIndex] = useState(requestedIndex);
  const [lastRequested, setLastRequested] = useState(requestedIndex);
  if (requestedIndex !== lastRequested) {
    setLastRequested(requestedIndex);
    setActiveIndex(requestedIndex);
  }
  const [innerSwipeActive, setInnerSwipeActive] = useState(false);
  // Created once; drives the tab bar's pill while the page follows the finger.
  const [progress] = useState(() => new Animated.Value(requestedIndex));
  const pager = useRef<PagerView>(null);
  // The page the pager itself last settled on, so a route change it caused
  // does not move it again.
  const pagerIndex = useRef(requestedIndex);
  const reducedMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const pagingDisabled = reducedMotion || screenReader;
  const { t } = useLocalization();

  useEffect(() => {
    if (pagerIndex.current === requestedIndex) return;
    pagerIndex.current = requestedIndex;
    progress.setValue(requestedIndex);
    pager.current?.setPageWithoutAnimation(requestedIndex);
  }, [progress, requestedIndex]);

  const settle = (index: number) => {
    pagerIndex.current = index;
    setActiveIndex(index);
    progress.setValue(index);
    router.replace(TABS[index].href);
    AccessibilityInfo.announceForAccessibility(t(TABS[index].labelKey));
  };

  const select = (index: number) => {
    if (index === activeIndex) return;
    if (pagingDisabled) {
      // Screen reader or reduced motion: no animated paging.
      pager.current?.setPageWithoutAnimation(index);
      settle(index);
      return;
    }
    pager.current?.setPage(index);
  };

  return (
    <View style={styles.shell} testID="tab-shell">
      <AppHeader routeName={TABS[activeIndex].name} />
      <PagerView
        initialPage={requestedIndex}
        keyboardDismissMode="on-drag"
        onPageScroll={(event) => {
          progress.setValue(event.nativeEvent.position + event.nativeEvent.offset);
        }}
        onPageSelected={(event) => settle(event.nativeEvent.position)}
        orientation="horizontal"
        overScrollMode="never"
        ref={pager}
        scrollEnabled={!pagingDisabled && !innerSwipeActive}
        style={styles.pager}
        testID="tab-pager"
      >
        {TABS.map((tab) => (
          <TabPagerGestureProvider key={tab.name} onInnerSwipeChange={setInnerSwipeActive}>
            <TabPage name={tab.name} />
          </TabPagerGestureProvider>
        ))}
      </PagerView>
      <AppTabBar activeIndex={activeIndex} onSelect={select} progress={progress} />
    </View>
  );
}

const styles = StyleSheet.create({ pager: { flex: 1 }, shell: { flex: 1 } });
