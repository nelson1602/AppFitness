import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from './app-header';
import { AppTabBar } from './app-tab-bar';
import { TABS, type TabName } from './tab-config';
import { TabPage } from './tab-page';

/** Web keeps URL/tab-bar navigation and never loads the native pager module. */
export function TabShell({ activeName }: { activeName: TabName }) {
  const activeIndex = TABS.findIndex((tab) => tab.name === activeName);
  return (
    <View style={styles.shell} testID="tab-shell">
      <AppHeader routeName={activeName} />
      <View style={styles.page}>
        <TabPage name={activeName} />
      </View>
      <AppTabBar activeIndex={activeIndex} onSelect={(index) => router.replace(TABS[index].href)} />
    </View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1 }, shell: { flex: 1 } });
