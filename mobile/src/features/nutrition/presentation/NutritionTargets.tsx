import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import type { EngineInput, NutritionPlan } from '@/features/icoach';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import {
  goalAdjustmentLabel,
  macroKcal,
  NUTRITION_DISCLAIMER,
  SAFETY_FLOOR_NOTE,
} from '../domain/nutrition-explain';

function MacroRow({ label, grams, kcal }: { label: string; grams: number; kcal: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
      <AppText tone="muted">{label}</AppText>
      <AppText variant="label">
        {grams}g · {kcal} kcal
      </AppText>
    </View>
  );
}

/**
 * Nutrition targets surface (Phase 15 Slice 1). A READ-ONLY projection of
 * the deterministic iCoach nutrition output already computed for the
 * dashboard — it reuses the dashboard store as the single source of truth
 * and never recomputes calories/macros. No food logging, no catalog.
 */
export function NutritionTargets() {
  const theme = useTheme();
  const { status, data, error, refresh } = useDashboardStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const assessment = data?.assessment;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Nutrition targets</AppText>
        <AppText tone="muted">
          Your daily calorie and macronutrient targets from your iCoach assessment.
        </AppText>
      </View>

      {status === 'loading' || status === 'idle' ? (
        <AppText accessibilityLabel="Loading nutrition targets">Loading…</AppText>
      ) : error ? (
        <Banner title="Nutrition unavailable" tone="error">
          {error}
        </Banner>
      ) : !assessment ? (
        // Data-gap state: the assessment needs profile + a weight measurement.
        // Baseline gaps are resolved on the dashboard (single owner of that
        // routing) — send the user there rather than duplicating it here.
        <Card accessibilityLabel="Nutrition needs more data">
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="title">Finish your baseline first</AppText>
            <AppText tone="muted">
              Add your profile and a weight measurement so your iCoach assessment can calculate
              nutrition targets.
            </AppText>
            <AppButton
              accessibilityLabel="Go to the dashboard to finish your baseline"
              onPress={() => router.push('/dashboard')}
            >
              Go to dashboard
            </AppButton>
          </View>
        </Card>
      ) : (
        <NutritionContent
          nutrition={assessment.assessment.nutrition}
          goal={assessment.engineInput.goal}
        />
      )}

      <AppText variant="caption" tone="muted">
        {NUTRITION_DISCLAIMER}
      </AppText>
    </View>
  );
}

function NutritionContent({
  nutrition,
  goal,
}: {
  nutrition: NutritionPlan;
  goal: EngineInput['goal'];
}) {
  const theme = useTheme();
  const kcal = macroKcal(nutrition);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card accessibilityLabel="Daily calorie target">
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" tone="muted">
            Daily calories
          </AppText>
          <AppText variant="headline">{nutrition.calories} kcal</AppText>
          <AppText tone="muted">{goalAdjustmentLabel(goal, nutrition.adjustmentPct)}</AppText>
        </View>
      </Card>

      {nutrition.safetyFloorApplied ? (
        <Banner title="Safe minimum applied" tone="info">
          {SAFETY_FLOOR_NOTE}
        </Banner>
      ) : null}

      <Card accessibilityLabel="Macronutrient breakdown">
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="title">Macros</AppText>
          <MacroRow label="Protein" grams={nutrition.proteinG} kcal={kcal.protein} />
          <MacroRow label="Carbs" grams={nutrition.carbsG} kcal={kcal.carbs} />
          <MacroRow label="Fat" grams={nutrition.fatG} kcal={kcal.fat} />
        </View>
      </Card>
    </View>
  );
}
