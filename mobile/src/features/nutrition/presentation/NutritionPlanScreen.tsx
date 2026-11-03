import { router } from 'expo-router';
import { View } from 'react-native';

// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionAccessNotice } from '@/features/subscriptions/presentation/SubscriptionAccessNotice';
import { formatNumber, formatQuantity, interpolate, useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { OffPlanAdjustment } from '@/features/weekly-plan/domain/off-plan';

import type { MealPlan } from '../domain/meal-plan';
import { getById } from '../application/food-catalog.service';
import { foodDisplayName } from '../application/food-display.service';
import { MealPlanPanel, PlanDayStrip, type ViewDay } from './meal-plan-day';
import { useNutritionPlanView } from './use-nutrition-plan-view';
import { AVOID_TAG_KEY } from './avoid-tag-labels';
import { NutritionDataGap } from './NutritionDataGap';

/** Day totals against the targets, under the meal panel. */
function DayTotals({ day }: { day: ViewDay }) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  return (
    <View style={{ gap: theme.spacing.lg }}>
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
  const { t } = useLocalization();
  const view = useNutritionPlanView();
  const { state, shownDay, shownIndex } = view;

  // Local database is dormant on Web (ADR-P019): render an honest, info-tone
  // bilingual state — no plan, day controls, food-log link, data-gap, or error.
  if (state.kind === 'web-unavailable') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        <AppText tone="muted">{t('nutrition.plan.subtitle')}</AppText>
        <Banner title={t('nutrition.plan.webUnavailableTitle')} tone="info">
          {t('nutrition.plan.webUnavailableBody')}
        </Banner>
      </View>
    );
  }

  // v8 Block 3: the stack header names the screen; the prototype's order
  // follows — day strip, the day's meals, "Registrar comida", then totals.
  const logFood = (
    <AppButton
      accessibilityLabel={t('nutrition.plan.logTodayAccessibility')}
      testID="open-food-log"
      onPress={() => router.push('/food-log')}
    >
      {t('nutrition.plan.logToday')}
    </AppButton>
  );

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <AppText tone="muted">{t('nutrition.plan.subtitle')}</AppText>

      {state.kind === 'subscription' ? (
        <SubscriptionAccessNotice />
      ) : state.kind === 'loading' ? (
        <AppText accessibilityLabel={t('nutrition.plan.loadingAccessibility')}>
          {t('nutrition.plan.loading')}
        </AppText>
      ) : state.kind === 'error' ? (
        <Banner title={t('nutrition.plan.unavailable')} tone="error">
          {t('nutrition.plan.errorMessage')}
        </Banner>
      ) : state.kind === 'gap' ? (
        <>
          <NutritionDataGap missing={state.missing} context="plan" />
          {logFood}
        </>
      ) : (
        <>
          {state.overlay ? <PlanOverlayBanner overlay={state.overlay} /> : null}
          <PlanDayStrip count={state.days.length} selected={shownIndex} onSelect={view.selectDay} />
          {shownDay ? (
            <MealPlanPanel day={shownDay} isDone={view.isDone} onEaten={view.onEaten} />
          ) : null}
          {logFood}
          {shownDay ? <DayTotals day={shownDay} /> : null}
          <ExclusionsCard plan={state.plan} />
          {state.saved ? (
            <AppText testID="plan-saved-week" tone="muted" variant="caption">
              {t('nutrition.plan.savedWeek')}
            </AppText>
          ) : null}
        </>
      )}

      <AppText variant="caption" tone="muted">
        {t('nutrition.plan.disclaimer')}
      </AppText>
    </View>
  );
}

/** The off-plan adjustment (ADR-P040 D7) in words, when it changes today. */
export function PlanOverlayBanner({ overlay }: { overlay: OffPlanAdjustment }) {
  const { language, t } = useLocalization();
  if (!(overlay.reducedBy > 0 || overlay.avoidIntenseTraining)) return null;
  return (
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
  );
}
