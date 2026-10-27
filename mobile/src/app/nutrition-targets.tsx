import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { NutritionTargets } from '@/features/nutrition/presentation/NutritionTargets';
import { useLocalization } from '@/shared/localization';
import { StageScreen } from '@/shared/presentation';

/**
 * Nutrition targets in detail (Phase 15 Slice 1): calories, the goal
 * adjustment, macros and the safety notes. Since ADR-P039 a spoke above the
 * tabs; the Nutrición tab shows today's summary and opens this.
 */
export default function NutritionTargetsRoute() {
  const { status } = useSession();
  const { t } = useLocalization();

  if (status === 'unknown') {
    return (
      <StageScreen>
        <DashboardSkeleton />
      </StageScreen>
    );
  }
  if (status !== 'authenticated') return <Redirect href="/sign-in" />;

  return (
    <>
      <Stack.Screen options={{ title: t('nutrition.targets.title') }} />
      <StageScreen>
        <NutritionTargets />
      </StageScreen>
    </>
  );
}
