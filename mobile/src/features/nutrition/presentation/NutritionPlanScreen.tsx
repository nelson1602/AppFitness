import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { getSession } from '@/features/authentication';
import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionAccessNotice } from '@/features/subscriptions/presentation/SubscriptionAccessNotice';
import { useEntitlementAccess } from '@/shared/application/use-entitlement-access';
import { localDateOf, weekDates } from '@/features/weekly-plan/domain/week';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { effectivePlanDay } from '@/features/weekly-plan/domain/adherence';
import type { IngredientSubstitution } from '@/features/weekly-plan/domain/weekly-plan';
import {
  formatDate,
  formatNumber,
  formatQuantity,
  interpolate,
  useLocalization,
  type TranslationKey,
} from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { AvoidTag, ServingUnit } from '../domain/food-catalog';
import type { MealMacros, MealPlan, MealPlanFood, MealSlot } from '../domain/meal-plan';
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
  added_sugar: 'nutrition.avoid.addedSugar',
  alcohol: 'nutrition.avoid.alcohol',
  caffeine: 'nutrition.avoid.caffeine',
  fried: 'nutrition.avoid.fried',
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
  const { language, t } = useLocalization();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {Array.from({ length: count }, (_, i) => i + 1).map((day) => {
        const active = day === selected;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`${t('nutrition.plan.showDay')} ${formatNumber(day, language)}`}
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
            {/* The chip's visible label and the announced label above it are the
                same number, so both resolve through the same formatter. */}
            <AppText tone={active ? 'onPrimary' : 'muted'} variant="label">
              {formatNumber(day, language)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One day as the screen shows it: saved (days 1–7) or preview (days 8–15). */
interface ViewDay {
  index: number;
  /** YYYY-MM-DD for saved days; null for preview days. */
  date: string | null;
  preview: boolean;
  isToday: boolean;
  isFuture: boolean;
  meals: readonly {
    slot: MealSlot;
    foods: readonly MealPlanFood[];
    totals: MealMacros;
    substitutions?: readonly IngredientSubstitution[];
  }[];
  targets: MealMacros;
  totals: MealMacros;
  safetyFloorApplied: boolean;
}

function sumMacros(meals: ViewDay['meals']): MealMacros {
  return meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + meal.totals.calories,
      proteinG: sum.proteinG + meal.totals.proteinG,
      carbsG: sum.carbsG + meal.totals.carbsG,
      fatG: sum.fatG + meal.totals.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function SubstitutionLine({ substitution }: { substitution: IngredientSubstitution }) {
  const { language, t } = useLocalization();
  const name = (id: string) => {
    const food = getById(id);
    return food ? foodDisplayName(food, language) : id;
  };
  return (
    <AppText tone="primary" variant="caption">
      {substitution.to
        ? interpolate(t('nutrition.plan.adjusted'), {
            from: name(substitution.from),
            to: name(substitution.to),
          })
        : interpolate(t('nutrition.plan.adjustedRemoved'), { from: name(substitution.from) })}
    </AppText>
  );
}

function MealCard({
  meal,
  day,
  done,
  onEaten,
}: {
  meal: ViewDay['meals'][number];
  day: ViewDay;
  done: boolean;
  onEaten: (() => void) | null;
}) {
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
            {/* BUG-028: formatQuantity keeps each value and its unit on one line. */}
            <AppText variant="caption" tone="muted">
              {formatQuantity(f.serving.amount, t(UNIT_KEY[f.serving.unit]), language)} ·{' '}
              {formatQuantity(f.macros.calories, 'kcal', language)} · {t('nutrition.plan.protein')}{' '}
              {formatQuantity(f.macros.proteinG, 'g', language)} / {t('nutrition.plan.carbs')}{' '}
              {formatQuantity(f.macros.carbsG, 'g', language)} / {t('nutrition.plan.fat')}{' '}
              {formatQuantity(f.macros.fatG, 'g', language)}
            </AppText>
          </View>
        ))}
        {(meal.substitutions ?? []).map((substitution, index) => (
          <SubstitutionLine key={`${substitution.from}-${index}`} substitution={substitution} />
        ))}
        <AppText variant="caption" tone="muted">
          {t('nutrition.plan.mealTotal')}: {formatQuantity(meal.totals.calories, 'kcal', language)}
        </AppText>
        {done ? (
          <AppText testID={`plan-eaten-${day.index}-${meal.slot}`} tone="success" variant="label">
            {t('nutrition.plan.eaten')}
          </AppText>
        ) : onEaten ? (
          <AppButton
            accessibilityLabel={interpolate(t('nutrition.plan.ateAccessibility'), {
              meal: slotLabel,
            })}
            onPress={onEaten}
            testID={`plan-ate-${day.index}-${meal.slot}`}
            variant="secondary"
          >
            {t('nutrition.plan.ate')}
          </AppButton>
        ) : null}
      </View>
    </Card>
  );
}

function DayView({
  day,
  isDone,
  onEaten,
}: {
  day: ViewDay;
  isDone: (slot: MealSlot) => boolean;
  onEaten: ((slot: MealSlot) => void) | null;
}) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="title">
          {t('nutrition.plan.day')} {formatNumber(day.index, language)}
        </AppText>
        {day.date ? (
          <AppText tone="muted" variant="caption">
            {formatDate(new Date(`${day.date}T12:00:00`), language, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </AppText>
        ) : null}
        {day.preview ? (
          <AppText testID="plan-preview-badge" tone="warning" variant="label">
            {t('nutrition.plan.previewBadge')}
          </AppText>
        ) : null}
      </View>

      {day.meals.map((meal) => (
        <MealCard
          key={meal.slot}
          day={day}
          done={isDone(meal.slot)}
          meal={meal}
          onEaten={onEaten && !day.preview && !day.isFuture ? () => onEaten(meal.slot) : null}
        />
      ))}

      <Card accessibilityLabel={t('nutrition.plan.dayTotalsAccessibility')}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label">{t('nutrition.plan.dayTotalTarget')}</AppText>
          <AppText tone="muted">
            {t('nutrition.plan.calories')}: {formatNumber(day.totals.calories, language)} /{' '}
            {formatQuantity(day.targets.calories, 'kcal', language)}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t('nutrition.plan.protein')} {formatNumber(day.totals.proteinG, language)} /{' '}
            {formatQuantity(day.targets.proteinG, 'g', language)} · {t('nutrition.plan.carbs')}{' '}
            {formatNumber(day.totals.carbsG, language)} /{' '}
            {formatQuantity(day.targets.carbsG, 'g', language)} · {t('nutrition.plan.fat')}{' '}
            {formatNumber(day.totals.fatG, language)} /{' '}
            {formatQuantity(day.targets.fatG, 'g', language)}
          </AppText>
        </View>
      </Card>

      <AppText variant="caption" tone="muted">
        {t('nutrition.plan.day')} {formatNumber(day.index, language)}{' '}
        {t('nutrition.plan.targetSummary')}:{' '}
        {formatQuantity(day.targets.calories, 'kcal', language)} · {t('nutrition.plan.protein')}{' '}
        {formatQuantity(day.targets.proteinG, 'g', language)} · {t('nutrition.plan.carbs')}{' '}
        {formatQuantity(day.targets.carbsG, 'g', language)} · {t('nutrition.plan.fat')}{' '}
        {formatQuantity(day.targets.fatG, 'g', language)}.
      </AppText>
      {day.safetyFloorApplied ? (
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
  const { language, t } = useLocalization();
  const { status, data, error, refresh } = useDashboardStore();
  const { status: prefStatus, preferences, load: loadPreferences } = useDietaryPreferenceStore();
  const plan = useWeeklyPlanStore();
  const currentPlan = plan.current;
  const planRevisions = plan.revisions;
  const today = localDateOf(new Date().toISOString());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const entitlement = useEntitlementAccess();
  const generationAllowed = entitlement.mode === 'unregulated' || entitlement.mode === 'active';

  useEffect(() => {
    void refresh();
    void loadPreferences();
    void useWeeklyPlanStore.getState().load();
  }, [refresh, loadPreferences]);

  const userId = getSession()?.user.id ?? null;
  const selection = useMemo(
    () =>
      // Preferences are additive: only feed them in once the store is ready.
      // On an error/loading state the plan still builds with no exclusions.
      generationAllowed
        ? selectMealPlan(
            data?.assessment ?? null,
            userId,
            prefStatus === 'ready' ? preferences : [],
          )
        : ({ status: 'gap' } as const),
    [data?.assessment, generationAllowed, userId, prefStatus, preferences],
  );

  // ADR-P042 D9: days 1–7 are the saved week; days 8–15 an unsaved preview.
  const days = useMemo<ViewDay[]>(() => {
    if (selection.status !== 'ready') return [];
    const live = selection.plan.days;
    const fromLive = (index: number): ViewDay => {
      const day = live[index];
      return {
        index: index + 1,
        date: null,
        preview: true,
        isToday: false,
        isFuture: true,
        meals: day.meals,
        targets: day.targets,
        totals: day.totals,
        safetyFloorApplied: day.rationale.safetyFloorApplied,
      };
    };
    if (!currentPlan || planRevisions.length === 0) return live.map((_, index) => fromLive(index));
    const fallbackTargets = currentPlan.plan.targets;
    const saved = weekDates(currentPlan.weekStart).map((date, index): ViewDay => {
      const effective = effectivePlanDay(planRevisions, date);
      const meals = effective?.day.meals ?? [];
      const targets = effective?.plan.plan.targets ?? fallbackTargets;
      return {
        index: index + 1,
        date,
        preview: false,
        isToday: date === today,
        isFuture: date > today,
        meals,
        targets: {
          calories: targets.calories,
          proteinG: targets.proteinG,
          carbsG: targets.carbsG,
          fatG: targets.fatG,
        },
        totals: sumMacros(meals),
        safetyFloorApplied: targets.calories <= targets.floorCalories,
      };
    });
    return [...saved, ...live.slice(7).map((_, index) => fromLive(index + 7))];
  }, [selection, currentPlan, planRevisions, today]);
  const todayIndex = days.find((day) => day.isToday)?.index ?? 1;
  const shownDay = days[(selectedDay ?? todayIndex) - 1];
  const done = new Set(plan.mealSlotsDone);
  const overlay = plan.overlay;

  // Wait for both the assessment and the (additive) preference load to settle
  // so the first rendered plan already reflects any exclusions.
  const preferencesLoading = prefStatus === 'idle' || prefStatus === 'loading';

  // Local database is dormant on Web (ADR-P019): render an honest, info-tone
  // bilingual state — no plan, day controls, food-log link, data-gap, or error.
  // Either the dashboard assessment or the (additive) preferences being
  // web-unavailable means the local database is unreachable.
  if (status === 'web-unavailable' || prefStatus === 'web-unavailable') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="headline">{t('nutrition.plan.title')}</AppText>
          <AppText tone="muted">{t('nutrition.plan.subtitle')}</AppText>
        </View>
        <Banner title={t('nutrition.plan.webUnavailableTitle')} tone="info">
          {t('nutrition.plan.webUnavailableBody')}
        </Banner>
      </View>
    );
  }

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

      {!generationAllowed ? (
        <SubscriptionAccessNotice />
      ) : status === 'loading' || status === 'idle' || preferencesLoading ? (
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
          {plan.current ? (
            <AppText testID="plan-saved-week" tone="muted" variant="caption">
              {t('nutrition.plan.savedWeek')}
            </AppText>
          ) : null}
          {overlay && (overlay.reducedBy > 0 || overlay.avoidIntenseTraining) ? (
            <View testID="plan-overlay">
              <Banner title={t('nutrition.plan.overlayTitle')} tone="info">
                {[
                  overlay.reducedBy > 0
                    ? interpolate(t('nutrition.plan.overlayBody'), {
                        kcal: formatNumber(overlay.todayCalories, language),
                        reduced: formatNumber(overlay.reducedBy, language),
                      })
                    : null,
                  overlay.extraCardioMinutes > 0
                    ? interpolate(t('nutrition.plan.overlayCardio'), {
                        minutes: formatNumber(overlay.extraCardioMinutes, language),
                      })
                    : null,
                  overlay.avoidIntenseTraining ? t('nutrition.plan.overlayAlcohol') : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </Banner>
            </View>
          ) : null}
          <DaySelector
            count={days.length}
            selected={selectedDay ?? todayIndex}
            onSelect={setSelectedDay}
          />
          {shownDay ? (
            <DayView
              day={shownDay}
              isDone={(slot) => (shownDay.date ? done.has(`${shownDay.date}|${slot}`) : false)}
              onEaten={
                plan.current && shownDay.date
                  ? (slot) => {
                      void plan.markMealEaten(shownDay.date as string, slot);
                    }
                  : null
              }
            />
          ) : null}
        </>
      )}

      <AppText variant="caption" tone="muted">
        {t('nutrition.plan.disclaimer')}
      </AppText>
    </View>
  );
}
