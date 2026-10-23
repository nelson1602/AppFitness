import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useWorkoutStore } from '../application/workout.store';
import { GeneratedWorkoutPlan } from './GeneratedWorkoutPlan';

/**
 * The Entrenamientos tab (ADR-P039 D1): the iCoach week, then the existing
 * training spokes. Set-by-set tracking and the exercise demonstrations are a
 * later phase (docs/design/GAP_ANALYSIS.md).
 */
export function WorkoutsTab() {
  const { spacing } = useTheme();
  const { t } = useLocalization();
  const status = useWorkoutStore((s) => s.status);
  const load = useWorkoutStore((s) => s.load);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Local database is dormant on Web (ADR-P019, ADR-P039 D2 Option A).
  if (status === 'web-unavailable') {
    return (
      <Banner title={t('workouts.webUnavailableTitle')} tone="info">
        {t('workouts.webUnavailableBody')}
      </Banner>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <GeneratedWorkoutPlan />
      <View style={{ gap: spacing.sm }}>
        <AppButton
          accessibilityLabel={t('dashboard.workoutLogAccessibility')}
          onPress={() => router.push('/workout-log')}
          testID="workouts-log"
          variant="primary"
        >
          {t('dashboard.workoutLog')}
        </AppButton>
        <AppButton
          accessibilityLabel={t('dashboard.routinesAccessibility')}
          onPress={() => router.push('/routines')}
          testID="workouts-routines"
          variant="secondary"
        >
          {t('dashboard.routines')}
        </AppButton>
        <AppButton
          accessibilityLabel={t('dashboard.exercisesAccessibility')}
          onPress={() => router.push('/exercises')}
          testID="workouts-exercises"
          variant="secondary"
        >
          {t('dashboard.exercises')}
        </AppButton>
      </View>
    </View>
  );
}
