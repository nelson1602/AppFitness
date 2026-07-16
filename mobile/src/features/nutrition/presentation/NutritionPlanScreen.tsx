import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { getSession } from '@/features/authentication';
import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { MealPlanDay, MealPlanMeal, MealSlot } from '../domain/meal-plan';
import { NUTRITION_DISCLAIMER } from '../domain/nutrition-explain';
import { selectMealPlan } from '../application/meal-plan.service';
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
 * 15-day meal plan surface (Phase 15 Slice 3B). A read-only projection of
 * the deterministic generator over the dashboard/iCoach assessment (single
 * source of truth). No recompute, no logging of values, no medical claims.
 */
export function NutritionPlanScreen() {
  const theme = useTheme();
  const { status, data, error, refresh } = useDashboardStore();
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const userId = getSession()?.user.id ?? null;
  const selection = useMemo(
    () => selectMealPlan(data?.assessment ?? null, userId),
    [data?.assessment, userId],
  );

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

      {status === 'loading' || status === 'idle' ? (
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
