import { router } from 'expo-router';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { NutritionTargets } from './NutritionTargets';

/**
 * The Nutrición tab (ADR-P039 D1): today's targets, then the two nutrition
 * spokes that used to sit on the dashboard. The 15-day plan carousel and the
 * redesigned food logger are later phases (docs/design/GAP_ANALYSIS.md).
 */
export function NutritionTab() {
  const { spacing } = useTheme();
  const { t } = useLocalization();

  return (
    <View style={{ gap: spacing.lg }}>
      <NutritionTargets />
      <View style={{ gap: spacing.sm }}>
        <AppButton
          accessibilityLabel={t('dashboard.foodLogAccessibility')}
          onPress={() => router.push('/food-log')}
          testID="nutrition-food-log"
          variant="secondary"
        >
          {t('dashboard.foodLog')}
        </AppButton>
        <AppButton
          accessibilityLabel={t('dashboard.preferencesAccessibility')}
          onPress={() => router.push('/dietary-preferences')}
          testID="nutrition-preferences"
          variant="secondary"
        >
          {t('dashboard.preferences')}
        </AppButton>
      </View>
    </View>
  );
}
