import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { loadHomeData, useHomeData } from '@/features/dashboard/application/use-home-data';
import { TabScreen } from '@/features/shell/presentation/tab-screen';
// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionAccessNotice } from '@/features/subscriptions/presentation/SubscriptionAccessNotice';
import type { IngredientSubstitution } from '@/features/weekly-plan/domain/weekly-plan';
import { PlanChangePrompt } from '@/features/weekly-plan/presentation/PlanChangePrompt';
import {
  formatNumber,
  interpolate,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import {
  AppButton,
  AppText,
  Banner,
  Chip,
  GlassCard,
  GlassRow,
  Icon,
  ProgressBar,
  Ring,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { getById } from '../application/food-catalog.service';
import { foodDisplayName } from '../application/food-display.service';
import { useFoodLogStore } from '../application/food-log.store';
import type { MealPlan } from '../domain/meal-plan';
import { AVOID_TAG_KEY } from './avoid-tag-labels';
import { MealPlanPanel, type PlanExtra, PlanDayStrip, type ViewDay } from './meal-plan-day';
import { NutritionDataGap } from './NutritionDataGap';
import { PlanOverlayBanner } from './NutritionPlanScreen';
import { useNutritionPlanView } from './use-nutrition-plan-view';

const MACRO_KEY: Record<'protein' | 'carbs' | 'fat', TranslationKey> = {
  protein: 'nutrition.plan.protein',
  carbs: 'nutrition.plan.carbs',
  fat: 'nutrition.plan.fat',
};
const MACRO_TONE = { protein: 'cyan', carbs: 'success', fat: 'energy' } as const;
/** Every distinct iCoach substitution in the saved week, once. */
function weekSubstitutions(days: readonly ViewDay[]): IngredientSubstitution[] {
  const seen = new Map<string, IngredientSubstitution>();
  for (const day of days) {
    if (day.preview) continue;
    for (const meal of day.meals) {
      for (const substitution of meal.substitutions ?? []) {
        seen.set(`${substitution.from}>${substitution.to ?? ''}`, substitution);
      }
    }
  }
  return [...seen.values()];
}

/**
 * Nutrición in the prototype's layout (v8.1, docs/design prototype
 * `tab === 'nutricion'`): today's calorie ring with the three macros, the
 * foods kept off the plan, what the iCoach adjusted, the 15-day plan slider
 * with the day's meals ("Lo comí", ingredients, adjustments, extras) and
 * "Registrar comida". Targets and preferences stay one tap away below.
 */
export function NutritionTab() {
  const { spacing } = useTheme();
  const { t } = useLocalization();
  const foodLogStatus = useFoodLogStore((s) => s.status);
  const foodItems = useFoodLogStore((s) => s.items);
  const view = useNutritionPlanView();
  const { state, shownDay, shownIndex } = view;

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, []),
  );

  if (foodLogStatus === 'web-unavailable' || state.kind === 'web-unavailable') {
    return (
      <TabScreen>
        <Banner title={t('nutrition.targets.webUnavailableTitle')} tone="info">
          {t('nutrition.targets.webUnavailableBody')}
        </Banner>
      </TabScreen>
    );
  }

  const logFood = (
    <AppButton
      accessibilityLabel={t('dashboard.foodLogAccessibility')}
      onPress={() => router.push('/food-log')}
      testID="nutrition-food-log"
    >
      {t('dashboard.foodLog')}
    </AppButton>
  );

  // Extras are today's: the food log holds the day being logged.
  const extras: PlanExtra[] = shownDay?.isToday
    ? foodItems
        .filter((item) => !item.planned)
        .map((item) => ({
          id: item.id,
          slot: item.mealType,
          name: item.name,
          servings: item.servingCount,
          calories: Math.round(item.consumed.calories),
        }))
    : [];

  return (
    <TabScreen>
      <PlanChangePrompt />
      <TodayPanel />

      {state.kind === 'subscription' ? <SubscriptionAccessNotice /> : null}
      {state.kind === 'loading' ? (
        <AppText accessibilityLabel={t('nutrition.plan.loadingAccessibility')}>
          {t('nutrition.plan.loading')}
        </AppText>
      ) : null}
      {state.kind === 'error' ? (
        <Banner title={t('nutrition.plan.unavailable')} tone="error">
          {t('nutrition.plan.errorMessage')}
        </Banner>
      ) : null}
      {state.kind === 'gap' ? (
        <>
          <NutritionDataGap missing={state.missing} context="plan" />
          {logFood}
        </>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <ExcludedChips plan={state.plan} />
          <AdjustedPanel substitutions={weekSubstitutions(state.days)} />
          {state.overlay ? <PlanOverlayBanner overlay={state.overlay} /> : null}
          <PlanDayStrip count={state.days.length} selected={shownIndex} onSelect={view.selectDay} />
          {shownDay ? (
            <MealPlanPanel
              day={shownDay}
              extras={extras}
              footer={logFood}
              isDone={view.isDone}
              onEaten={view.onEaten}
            />
          ) : null}
        </>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <AppText accessibilityRole="header" tone="onStageVariant" variant="caption">
          {t('nutrition.tab.moreLinks')}
        </AppText>
        <GlassCard style={{ gap: spacing.xs, padding: spacing.sm }} testID="nutrition-rows">
          <GlassRow
            icon="target"
            label={t('nutrition.tab.targetsRow')}
            onPress={() => router.push('/nutrition-targets')}
            testID="nutrition-targets"
          />
          <GlassRow
            accessibilityLabel={t('dashboard.preferencesAccessibility')}
            icon="shield"
            label={t('dashboard.preferences')}
            onPress={() => router.push('/dietary-preferences')}
            testID="nutrition-preferences"
          />
        </GlassCard>
      </View>
    </TabScreen>
  );
}

/** The prototype's top panel: today's calorie ring beside the three macro bars. */
function TodayPanel() {
  const { spacing } = useTheme();
  const { language, t } = useLocalization();
  const { summary, evaluation } = useHomeData();
  const { calories } = summary;
  const consumed = Math.round(calories.consumed ?? 0);
  const ringLabel =
    calories.target === null
      ? t('home.tile.caloriesEmpty')
      : interpolate(t('nutrition.tab.ringA11y'), {
          consumed: formatNumber(consumed, language),
          target: formatNumber(calories.target, language),
        });

  return (
    <GlassCard style={{ padding: spacing.lg }} testID="nutrition-today-card">
      <View style={[styles.row, { gap: spacing.lg }]}>
        <Ring
          accessibilityLabel={ringLabel}
          size={104}
          strokeWidth={11}
          testID="nutrition-ring"
          tone="energy"
          value={calories.share ?? 0}
        >
          <AppText testID="nutrition-calories" variant="title">
            {formatNumber(consumed, language)}
          </AppText>
          {calories.target !== null ? (
            <AppText tone="onStageVariant" variant="caption">
              {interpolate(t('nutrition.tab.ringOf'), {
                target: formatNumber(calories.target, language),
              })}
            </AppText>
          ) : null}
        </Ring>
        <View style={[styles.grow, { gap: spacing.sm }]}>
          {(evaluation?.macros ?? []).map((macro) => {
            const name = t(MACRO_KEY[macro.kind]);
            const value = Math.round(macro.consumed ?? 0);
            const values = {
              consumed: formatNumber(value, language),
              target: formatNumber(macro.target, language),
            };
            return (
              <View key={macro.kind} style={{ gap: 2 }} testID={`nutrition-macro-${macro.kind}`}>
                <View style={[styles.row, styles.wrap, { gap: spacing.xs }]}>
                  <AppText style={styles.grow} tone="onStageVariant" variant="caption">
                    {name}
                  </AppText>
                  <AppText variant="caption">
                    {interpolate(t('nutrition.tab.macroValue'), values)}
                  </AppText>
                </View>
                <ProgressBar
                  accessibilityLabel={interpolate(t('home.eval.macroLabel'), {
                    macro: name,
                    ...values,
                  })}
                  height={6}
                  tone={MACRO_TONE[macro.kind]}
                  value={macro.target > 0 ? value / macro.target : 0}
                />
              </View>
            );
          })}
        </View>
      </View>
    </GlassCard>
  );
}

/** "Fuera de tu plan por tu evaluación" with one chip per excluded category or food. */
function ExcludedChips({ plan }: { plan: MealPlan }) {
  const { spacing } = useTheme();
  const { language, t } = useLocalization();
  const labels = [
    ...plan.excludedAvoidTags.map((tag) => t(AVOID_TAG_KEY[tag])),
    ...plan.excludedCatalogKeys.map((key) => {
      const food = getById(key);
      return food ? foodDisplayName(food, language) : key;
    }),
  ];
  if (labels.length === 0) return null;
  return (
    <View style={[styles.row, styles.wrap, { gap: spacing.xs }]} testID="nutrition-excluded">
      <AppText tone="onStageVariant" variant="caption">
        {t('nutrition.tab.excludedLabel')}
      </AppText>
      {labels.map((label) => (
        <Chip key={label} label={label} tone="energy" />
      ))}
    </View>
  );
}

/** "iCoach ajustó tu plan": each substitution the week's plan made, once. */
function AdjustedPanel({ substitutions }: { substitutions: readonly IngredientSubstitution[] }) {
  const { colors, spacing } = useTheme();
  const { language, t } = useLocalization();
  if (substitutions.length === 0) return null;
  const name = (id: string) => {
    const food = getById(id);
    return food ? foodDisplayName(food, language) : id;
  };
  return (
    <GlassCard testID="nutrition-adjusted">
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Icon color={colors.accentEnergy} name="sparkle" size={18} />
        <AppText accessibilityRole="header" style={styles.grow} variant="title">
          {t('nutrition.tab.adjustedTitle')}
        </AppText>
      </View>
      <View style={{ gap: spacing.xs }}>
        {substitutions.map((substitution) => (
          <View
            key={`${substitution.from}>${substitution.to ?? ''}`}
            style={[styles.row, { alignItems: 'flex-start', gap: spacing.sm }]}
          >
            <Icon color={colors.accentEnergy} name="check" size={15} />
            <AppText style={styles.grow} variant="body">
              {substitution.to
                ? interpolate(t('nutrition.plan.adjusted'), {
                    from: name(substitution.from),
                    to: name(substitution.to),
                  })
                : interpolate(t('nutrition.plan.adjustedRemoved'), {
                    from: name(substitution.from),
                  })}
            </AppText>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { alignItems: 'center', flexDirection: 'row' },
  wrap: { flexWrap: 'wrap' },
});
