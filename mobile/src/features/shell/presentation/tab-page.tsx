import { View, StyleSheet } from 'react-native';

import { DashboardScreen } from '@/features/dashboard';
import { NutritionTab } from '@/features/nutrition/presentation/NutritionTab';
import { ProfileTab } from '@/features/profile/presentation/ProfileTab';
import { ProgressTab } from '@/features/progress/presentation/ProgressTab';
import { WorkoutsTab } from '@/features/workout/presentation/WorkoutsTab';

import type { TabName } from './tab-config';

/** The content owned by one of the five pager pages. Stack spokes stay outside. */
export function TabPage({ name }: { name: TabName }) {
  return (
    <View collapsable={false} style={styles.page} testID={`tab-page-${name}`}>
      {name === 'dashboard' ? <DashboardScreen /> : null}
      {name === 'workouts' ? <WorkoutsTab /> : null}
      {name === 'nutrition' ? <NutritionTab /> : null}
      {name === 'progress' ? <ProgressTab /> : null}
      {name === 'profile' ? <ProfileTab /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1 } });
