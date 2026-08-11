import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import type { EngineInput, NutritionPlan } from '@/features/icoach';
import {
  formatNumber,
  useLocalization,
  type SupportedLanguage,
  type TranslationKey,
} from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { macroKcal } from '../domain/nutrition-explain';
import { NutritionDataGap } from './NutritionDataGap';

type Goal = EngineInput['goal'];
type Translate = (key: TranslationKey) => string;

const GOAL_KEY: Record<Goal, TranslationKey> = {
  FAT_LOSS: 'nutrition.goal.fatLoss',
  MUSCLE_GAIN: 'nutrition.goal.muscleGain',
  RECOMPOSITION: 'nutrition.goal.recomposition',
  STRENGTH: 'nutrition.goal.strength',
  ENDURANCE: 'nutrition.goal.endurance',
  GENERAL_HEALTH: 'nutrition.goal.generalHealth',
  REHABILITATION: 'nutrition.goal.rehabilitation',
  MAINTENANCE: 'nutrition.goal.maintenance',
};

function localizedGoalAdjustment(goal: Goal, adjustmentPct: number, t: Translate): string {
  const goalLabel = t(GOAL_KEY[goal]);
  if (adjustmentPct === 0) {
    return `${t('nutrition.targets.maintenancePrefix')} ${goalLabel}.`;
  }
  const direction = t(adjustmentPct < 0 ? 'nutrition.targets.below' : 'nutrition.targets.above');
  return `${t('nutrition.targets.adjustmentPrefix')} ${Math.abs(adjustmentPct)}% ${direction} ${t('nutrition.targets.adjustmentSuffix')} ${goalLabel}.`;
}

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
 * Read-only projection of deterministic iCoach nutrition output. Presentation
 * copy is localized here; targets and macro calculations remain unchanged.
 */
export function NutritionTargets() {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const { status, data, error, refresh } = useDashboardStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const assessment = data?.assessment;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{t('nutrition.targets.title')}</AppText>
        <AppText tone="muted">{t('nutrition.targets.subtitle')}</AppText>
      </View>

      {status === 'loading' || status === 'idle' ? (
        <AppText accessibilityLabel={t('nutrition.targets.loadingAccessibility')}>
          {t('nutrition.plan.loading')}
        </AppText>
      ) : error ? (
        <Banner title={t('nutrition.targets.unavailable')} tone="error">
          {t('nutrition.targets.errorMessage')}
        </Banner>
      ) : !assessment ? (
        <NutritionDataGap missing={data?.missing ?? []} context="targets" />
      ) : (
        <NutritionContent
          nutrition={assessment.assessment.nutrition}
          goal={assessment.engineInput.goal}
          language={language}
          t={t}
        />
      )}

      <AppText variant="caption" tone="muted">
        {t('nutrition.plan.disclaimer')}
      </AppText>
    </View>
  );
}

function NutritionContent({
  nutrition,
  goal,
  language,
  t,
}: {
  nutrition: NutritionPlan;
  goal: Goal;
  language: SupportedLanguage;
  t: Translate;
}) {
  const theme = useTheme();
  const kcal = macroKcal(nutrition);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card accessibilityLabel={t('nutrition.targets.calorieAccessibility')}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" tone="muted">
            {t('nutrition.targets.dailyCalories')}
          </AppText>
          <AppText variant="headline">{formatNumber(nutrition.calories, language)} kcal</AppText>
          <AppText tone="muted">
            {localizedGoalAdjustment(goal, nutrition.adjustmentPct, t)}
          </AppText>
        </View>
      </Card>

      {nutrition.safetyFloorApplied ? (
        <Banner title={t('nutrition.plan.safeMinimumTitle')} tone="info">
          {t('nutrition.plan.safeMinimumMessage')}
        </Banner>
      ) : null}

      <Card accessibilityLabel={t('nutrition.targets.macrosAccessibility')}>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="title">{t('nutrition.targets.macros')}</AppText>
          <MacroRow
            label={t('nutrition.plan.protein')}
            grams={nutrition.proteinG}
            kcal={kcal.protein}
          />
          <MacroRow label={t('nutrition.plan.carbs')} grams={nutrition.carbsG} kcal={kcal.carbs} />
          <MacroRow label={t('nutrition.plan.fat')} grams={nutrition.fatG} kcal={kcal.fat} />
        </View>
      </Card>

      <AppButton
        accessibilityLabel={t('nutrition.targets.viewPlanAccessibility')}
        onPress={() => router.push('/nutrition-plan')}
        variant="secondary"
      >
        {t('nutrition.targets.viewPlan')}
      </AppButton>
    </View>
  );
}
