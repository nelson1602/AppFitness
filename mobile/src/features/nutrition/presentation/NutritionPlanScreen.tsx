import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { getSession } from '@/features/authentication';
import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { AVOID_TAG_LABELS } from '../domain/food-catalog';
import type { MealPlan, MealPlanDay, MealPlanMeal, MealSlot } from '../domain/meal-plan';
import { NUTRITION_DISCLAIMER } from '../domain/nutrition-explain';
import { getById } from '../application/food-catalog.service';
import { selectMealPlan } from '../application/meal-plan.service';
import { useDietaryPreferenceStore } from '../application/dietary-preference.store';
import { NutritionDataGap } from './NutritionDataGap';

const SLOT_LABEL: Record<MealSlot, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
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
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {Array.from({ length: count }, (_, i) => i + 1).map((day) => {
        const active = day === selected;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`Show day ${day}`}
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
  return (
    <Card accessibilityLabel={`${SLOT_LABEL[meal.slot]} meal`}>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label">{SLOT_LABEL[meal.slot]}</AppText>
        {meal.foods.map((f, idx) => (
          <View key={`${f.foodId}-${idx}`} style={{ gap: 2 }}>
            <AppText>{f.name}</AppText>
            <AppText variant="caption" tone="muted">
              {f.serving.amount}
              {f.serving.unit} · {f.servings}× · {f.macros.calories} kcal · P {f.macros.proteinG}g /
              C {f.macros.carbsG}g / F {f.macros.fatG}g
            </AppText>
          </View>
        ))}
        <AppText variant="caption" tone="muted">
          Meal total: {meal.totals.calories} kcal
        </AppText>
      </View>
    </Card>
  );
}

function DayView({ day }: { day: MealPlanDay }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">Day {day.day}</AppText>

      {day.meals.map((meal) => (
        <MealCard key={meal.slot} meal={meal} />
      ))}

      <Card accessibilityLabel="Day totals versus targets">
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label">Day total vs target</AppText>
          <AppText tone="muted">
            {day.totals.calories} / {day.targets.calories} kcal
          </AppText>
          <AppText variant="caption" tone="muted">
            Protein {day.totals.proteinG} / {day.targets.proteinG}g · Carbs {day.totals.carbsG} /{' '}
            {day.targets.carbsG}g · Fat {day.totals.fatG} / {day.targets.fatG}g
          </AppText>
        </View>
      </Card>

      <AppText variant="caption" tone="muted">
        {day.rationale.summary}
      </AppText>
      {day.rationale.safetyFloorApplied ? (
        <Banner title="Safe minimum applied" tone="info">
          {day.rationale.notes.join(' ')}
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
  if (plan.excludedAvoidTags.length === 0 && plan.excludedCatalogKeys.length === 0) return null;

  const categories = plan.excludedAvoidTags.map((t) => AVOID_TAG_LABELS[t]);
  const foods = plan.excludedCatalogKeys.map((k) => getById(k)?.name ?? k);

  return (
    <Card accessibilityLabel="Applied dietary preferences">
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label">Your dietary preferences shaped this plan</AppText>
        {categories.length > 0 ? (
          <AppText variant="caption" tone="muted">
            Avoided categories: {categories.join(', ')}
          </AppText>
        ) : null}
        {foods.length > 0 ? (
          <AppText variant="caption" tone="muted">
            Excluded foods: {foods.join(', ')}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="muted">
          Allergies and preferences deterministically remove foods before selection, so the plan
          reflects them. Not medical advice.
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
        <AppText variant="headline">15-day meal plan</AppText>
        <AppText tone="muted">
          A deterministic routine built from your iCoach targets and the local food catalog.
        </AppText>
      </View>

      <AppButton
        accessibilityLabel="Log the food you ate today"
        testID="open-food-log"
        variant="secondary"
        onPress={() => router.push('/food-log')}
      >
        Log today’s food
      </AppButton>

      {status === 'loading' || status === 'idle' || preferencesLoading ? (
        <AppText accessibilityLabel="Loading meal plan">Loading…</AppText>
      ) : error ? (
        <Banner title="Meal plan unavailable" tone="error">
          {error}
        </Banner>
      ) : selection.status === 'error' ? (
        <Banner title="Meal plan unavailable" tone="error">
          {selection.message}
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
        {NUTRITION_DISCLAIMER}
      </AppText>
    </View>
  );
}
