import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { getSession } from '@/features/authentication';
import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { formatNumber, useLocalization, type TranslationKey } from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { AvoidTag, ServingUnit } from '../domain/food-catalog';
import type { MealPlan, MealPlanDay, MealPlanMeal, MealSlot } from '../domain/meal-plan';
import { getById } from '../application/food-catalog.service';
import { foodDisplayName } from '../application/food-display.service';
import { selectMealPlan } from '../application/meal-plan.service';
import { useDietaryPreferenceStore } from '../application/dietary-preference.store';
import { NutritionDataGap } from './NutritionDataGap';

const SLOT_KEY: Record<MealSlot, TranslationKey> = {
  BREAKFAST: 'nutrition.plan.breakfast',
  LUNCH: 'nutrition.plan.lunch',
  DINNER: 'nutrition.plan.dinner',
  SNACK: 'nutrition.plan.snack',
};

const UNIT_KEY: Record<ServingUnit, TranslationKey> = {
  g: 'nutrition.unit.g',
  ml: 'nutrition.unit.ml',
  piece: 'nutrition.unit.piece',
  cup: 'nutrition.unit.cup',
  tbsp: 'nutrition.unit.tbsp',
  tsp: 'nutrition.unit.tsp',
  slice: 'nutrition.unit.slice',
};

const AVOID_TAG_KEY: Record<AvoidTag, TranslationKey> = {
  nut_allergy: 'nutrition.avoid.nuts',
  shellfish_allergy: 'nutrition.avoid.shellfish',
  gluten_sensitive: 'nutrition.avoid.gluten',
  lactose_sensitive: 'nutrition.avoid.lactose',
  high_sodium_sensitive: 'nutrition.avoid.sodium',
  high_purine: 'nutrition.avoid.purine',
};

function DaySelector({
  count,
  selected,
  onSelect,
}: {
  count: number;
  selected: number;
  onSelect: (day: number) => void;
}) {
  const theme = useTheme();
  const { t } = useLocalization();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {Array.from({ length: count }, (_, i) => i + 1).map((day) => {
        const active = day === selected;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`${t('nutrition.plan.showDay')} ${day}`}
            accessibilityState={{ selected: active }}
            testID={`plan-day-${day}`}
            onPress={() => onSelect(day)}
            style={{
              backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant,
              borderColor: active ? theme.colors.primary : theme.colors.outline,
              borderRadius: theme.radius.medium,
              borderWidth: 1,
              minWidth: theme.spacing.x5l,
              minHeight: theme.spacing.x5l,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.sm,
            }}
          >
            <AppText tone={active ? 'default' : 'muted'} variant="label">
              {day}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function MealCard({ meal }: { meal: MealPlanMeal }) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const slotLabel = t(SLOT_KEY[meal.slot]);
  return (
    <Card accessibilityLabel={`${slotLabel} ${t('nutrition.plan.meal')}`}>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label">{slotLabel}</AppText>
        {meal.foods.map((f, idx) => (
          <View key={`${f.foodId}-${idx}`} style={{ gap: 2 }}>
            <AppText>{foodDisplayName({ id: f.foodId, name: f.name }, language)}</AppText>
            <AppText variant="caption" tone="muted">
              {formatNumber(f.serving.amount, language)} {t(UNIT_KEY[f.serving.unit])} ·{' '}
              {formatNumber(f.servings, language)}× · {formatNumber(f.macros.calories, language)}{' '}
              kcal · {t('nutrition.plan.protein')} {formatNumber(f.macros.proteinG, language)} g /{' '}
              {t('nutrition.plan.carbs')} {formatNumber(f.macros.carbsG, language)} g /{' '}
              {t('nutrition.plan.fat')} {formatNumber(f.macros.fatG, language)} g
            </AppText>
          </View>
        ))}
        <AppText variant="caption" tone="muted">
          {t('nutrition.plan.mealTotal')}: {formatNumber(meal.totals.calories, language)} kcal
        </AppText>
      </View>
    </Card>
  );
}

function DayView({ day }: { day: MealPlanDay }) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">
        {t('nutrition.plan.day')} {day.day}
      </AppText>

      {day.meals.map((meal) => (
        <MealCard key={meal.slot} meal={meal} />
      ))}

      <Card accessibilityLabel={t('nutrition.plan.dayTotalsAccessibility')}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label">{t('nutrition.plan.dayTotalTarget')}</AppText>
          <AppText tone="muted">
            {t('nutrition.plan.calories')}: {formatNumber(day.totals.calories, language)} /{' '}
            {formatNumber(day.targets.calories, language)} kcal
          </AppText>
          <AppText variant="caption" tone="muted">
            {t('nutrition.plan.protein')} {formatNumber(day.totals.proteinG, language)} /{' '}
            {formatNumber(day.targets.proteinG, language)} g · {t('nutrition.plan.carbs')}{' '}
            {formatNumber(day.totals.carbsG, language)} /{' '}
            {formatNumber(day.targets.carbsG, language)} g · {t('nutrition.plan.fat')}{' '}
            {formatNumber(day.totals.fatG, language)} / {formatNumber(day.targets.fatG, language)} g
          </AppText>
        </View>
      </Card>

      <AppText variant="caption" tone="muted">
        {t('nutrition.plan.day')} {day.day} {t('nutrition.plan.targetSummary')}:{' '}
        {formatNumber(day.targets.calories, language)} kcal · {t('nutrition.plan.protein')}{' '}
        {formatNumber(day.targets.proteinG, language)} g · {t('nutrition.plan.carbs')}{' '}
        {formatNumber(day.targets.carbsG, language)} g · {t('nutrition.plan.fat')}{' '}
        {formatNumber(day.targets.fatG, language)} g.
      </AppText>
      {day.rationale.safetyFloorApplied ? (
        <Banner title={t('nutrition.plan.safeMinimumTitle')} tone="info">
          {t('nutrition.plan.safeMinimumMessage')}
        </Banner>
      ) : null}
    </View>
  );
}

/**
 * Applied dietary preferences/allergies (ADR-P014 Slice 3). Renders only when
 * the deterministic plan actually excluded something, explaining what was
 * removed. Descriptive copy — not a medical claim.
 */
function ExclusionsCard({ plan }: { plan: MealPlan }) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  if (plan.excludedAvoidTags.length === 0 && plan.excludedCatalogKeys.length === 0) return null;

  const categories = plan.excludedAvoidTags.map((tag) => t(AVOID_TAG_KEY[tag]));
  const foods = plan.excludedCatalogKeys.map((key) => {
    const food = getById(key);
    return food ? foodDisplayName(food, language) : key;
  });

  return (
    <Card accessibilityLabel={t('nutrition.plan.preferencesAccessibility')}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label">{t('nutrition.plan.preferencesTitle')}</AppText>
        {categories.length > 0 ? (
          <AppText variant="caption" tone="muted">
            {t('nutrition.plan.avoidedCategories')}: {categories.join(', ')}
          </AppText>
        ) : null}
        {foods.length > 0 ? (
          <AppText variant="caption" tone="muted">
            {t('nutrition.plan.excludedFoods')}: {foods.join(', ')}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="muted">
          {t('nutrition.plan.preferencesExplanation')}
        </AppText>
      </View>
    </Card>
  );
}

/**
 * 15-day meal plan surface (Phase 15 Slice 3B; dietary preferences ADR-P014
 * Slice 3). A read-only projection of the deterministic generator over the
 * dashboard/iCoach assessment (single source of truth) and the user's active
 * dietary preferences. No recompute, no logging of values, no medical claims.
 */
export function NutritionPlanScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status, data, error, refresh } = useDashboardStore();
  const { status: prefStatus, preferences, load: loadPreferences } = useDietaryPreferenceStore();
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => {
    void refresh();
    void loadPreferences();
  }, [refresh, loadPreferences]);

  const userId = getSession()?.user.id ?? null;
  const selection = useMemo(
    () =>
      // Preferences are additive: only feed them in once the store is ready.
      // On an error/loading state the plan still builds with no exclusions.
      selectMealPlan(data?.assessment ?? null, userId, prefStatus === 'ready' ? preferences : []),
    [data?.assessment, userId, prefStatus, preferences],
  );

  // Wait for both the assessment and the (additive) preference load to settle
  // so the first rendered plan already reflects any exclusions.
  const preferencesLoading = prefStatus === 'idle' || prefStatus === 'loading';

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{t('nutrition.plan.title')}</AppText>
        <AppText tone="muted">{t('nutrition.plan.subtitle')}</AppText>
      </View>

      <AppButton
        accessibilityLabel={t('nutrition.plan.logTodayAccessibility')}
        testID="open-food-log"
        variant="secondary"
        onPress={() => router.push('/food-log')}
      >
        {t('nutrition.plan.logToday')}
      </AppButton>

      {status === 'loading' || status === 'idle' || preferencesLoading ? (
        <AppText accessibilityLabel={t('nutrition.plan.loadingAccessibility')}>
          {t('nutrition.plan.loading')}
        </AppText>
      ) : error ? (
        <Banner title={t('nutrition.plan.unavailable')} tone="error">
          {t('nutrition.plan.errorMessage')}
        </Banner>
      ) : selection.status === 'error' ? (
        <Banner title={t('nutrition.plan.unavailable')} tone="error">
          {t('nutrition.plan.errorMessage')}
        </Banner>
      ) : selection.status === 'gap' ? (
        <NutritionDataGap missing={data?.missing ?? []} context="plan" />
      ) : (
        <>
          <ExclusionsCard plan={selection.plan} />
          <DaySelector
            count={selection.plan.days.length}
            selected={selectedDay}
            onSelect={setSelectedDay}
          />
          <DayView day={selection.plan.days[selectedDay - 1]} />
        </>
      )}

      <AppText variant="caption" tone="muted">
        {t('nutrition.plan.disclaimer')}
      </AppText>
    </View>
  );
}
