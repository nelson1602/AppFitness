import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { IngredientSubstitution } from '@/features/weekly-plan/domain/weekly-plan';
import {
  formatDate,
  formatKcalQuantity,
  formatNumber,
  formatQuantity,
  interpolate,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { AppButton, AppText, GlassCard, Icon, withAlpha } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import {
  bySlotOrder,
  type MealMacros,
  type MealPlanFood,
  type MealSlot,
} from '../domain/meal-plan';
import type { DayRebalance, RebalancedMealStatus } from '../domain/meal-rebalance';
import { getById } from '../application/food-catalog.service';
import { foodDisplayName } from '../application/food-display.service';
import { dishNameKeyFor, SWAP_MARK_KEY } from './dish-name';
import { PlanDaySlider } from './plan-day-slider';
import { formatIngredientAmount } from './serving-amount';

/**
 * "Plan alimentario" in the prototype's language (v8 Block 3,
 * docs/design/appfitnessrd-prototipo.html, Nutrición): a day strip with
 * arrows, then one glass panel per day whose meals open to their ingredients,
 * each with a round "Lo comí" check.
 */

export const SLOT_KEY: Record<MealSlot, TranslationKey> = {
  BREAKFAST: 'nutrition.plan.breakfast',
  LUNCH: 'nutrition.plan.lunch',
  DINNER: 'nutrition.plan.dinner',
  SNACK: 'nutrition.plan.snack',
};

const CHIP_WIDTH = 52;

export interface PlanMeal {
  slot: MealSlot;
  /** v8.1 Dominican dish plans: the dish whose name titles the meal. */
  dishId?: string;
  foods: readonly MealPlanFood[];
  totals: MealMacros;
  substitutions?: readonly IngredientSubstitution[];
  /** Today only (ADR-P040 v10-B): how the rebalance changed this pending meal. */
  rebalance?: {
    status: RebalancedMealStatus;
    plannedCalories: number;
    lightOption?: { foodId: string; name: string; calories: number };
  };
  /** Today only: skipped with "Omitir". */
  skipped?: boolean;
}

/** One day as the screen shows it: saved (days 1–7) or preview (days 8–15). */
export interface ViewDay {
  index: number;
  /** YYYY-MM-DD for saved days; null for preview days. */
  date: string | null;
  preview: boolean;
  isToday: boolean;
  isFuture: boolean;
  meals: readonly PlanMeal[];
  targets: MealMacros;
  totals: MealMacros;
  safetyFloorApplied: boolean;
  /** Today only (v10-B): the day's rebalance, when the log changed the plan. */
  rebalance?: {
    status: DayRebalance['status'];
    consumedCalories: number;
    targetCalories: number;
  };
}

export function PlanDayStrip({
  count,
  selected,
  onSelect,
}: {
  count: number;
  selected: number;
  onSelect: (day: number) => void;
}) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const strip = useRef<ScrollView>(null);

  useEffect(() => {
    // Keep the chosen day in view, one chip of context before it.
    strip.current?.scrollTo({
      x: Math.max(0, (selected - 2) * (CHIP_WIDTH + spacing.sm)),
      animated: false,
    });
  }, [selected, spacing.sm]);

  const arrow = (direction: -1 | 1) => {
    const target = selected + direction;
    const disabled = target < 1 || target > count;
    return (
      <Pressable
        accessibilityLabel={t(
          direction < 0 ? 'nutrition.plan.previousDay' : 'nutrition.plan.nextDay',
        )}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={4}
        onPress={() => onSelect(target)}
        style={{
          alignItems: 'center',
          backgroundColor: withAlpha(colors.onStage, 0.1),
          borderRadius: theme.spacing.x5l / 2,
          justifyContent: 'center',
          minHeight: theme.spacing.x5l,
          minWidth: theme.spacing.x5l,
          opacity: disabled ? 0.3 : 1,
        }}
        testID={direction < 0 ? 'plan-day-previous' : 'plan-day-next'}
      >
        <View style={direction > 0 ? { transform: [{ rotate: '180deg' }] } : undefined}>
          <Icon color={colors.onStage} name="back" size={18} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        {arrow(-1)}
        {/* The prototype's label row with the range track under it, between the arrows. */}
        <View style={styles.grow}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <AppText tone="muted" variant="label">
              {t('nutrition.plan.stripLabel')}
            </AppText>
            <AppText variant="label">
              {interpolate(t('nutrition.plan.dayOf'), {
                day: formatNumber(selected, language),
                count: formatNumber(count, language),
              })}
            </AppText>
          </View>
          <PlanDaySlider count={count} onSelect={onSelect} selected={selected} />
        </View>
        {arrow(1)}
      </View>
      <ScrollView
        ref={strip}
        horizontal
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
        showsHorizontalScrollIndicator
      >
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
                alignItems: 'center',
                backgroundColor: active ? colors.accentCyan : colors.glassFill,
                borderColor: active ? colors.linkOnStage : colors.glassBorder,
                borderRadius: radius.large,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: theme.spacing.x5l,
                minWidth: theme.spacing.x5l,
                paddingVertical: spacing.xs,
                width: CHIP_WIDTH,
              }}
            >
              {/* The visible number and the announced one share the formatter. */}
              <AppText
                style={{ color: active ? colors.stageDeep : colors.onStageVariant }}
                variant="caption"
              >
                {t('nutrition.plan.day')}
              </AppText>
              <AppText
                style={{ color: active ? colors.stageDeep : colors.onStage }}
                variant="title"
              >
                {formatNumber(day, language)}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SubstitutionLine({ substitution }: { substitution: IngredientSubstitution }) {
  const { colors } = useTheme();
  const { language, t } = useLocalization();
  const name = (id: string) => {
    const food = getById(id);
    return food ? foodDisplayName(food, language) : id;
  };
  return (
    <AppText style={{ color: colors.accentEnergy }} variant="caption">
      {substitution.to
        ? interpolate(t('nutrition.plan.adjusted'), {
            from: name(substitution.from),
            to: name(substitution.to),
          })
        : interpolate(t('nutrition.plan.adjustedRemoved'), { from: name(substitution.from) })}
    </AppText>
  );
}

/** ADR-P040 v10-B: how the rebalance changed a pending meal, in one line. */
const REBALANCE_LINE: Record<Exclude<RebalancedMealStatus, 'covered'>, TranslationKey> = {
  scaled: 'nutrition.rebalance.scaled',
  swapped: 'nutrition.rebalance.swapped',
  optional: 'nutrition.rebalance.optional',
};

function MealRow({
  meal,
  dayIndex,
  done,
  onEaten,
  onLightOption = null,
  onSkip = null,
}: {
  meal: PlanMeal;
  dayIndex: number;
  done: boolean;
  onEaten: (() => void) | null;
  onLightOption?: (() => void) | null;
  onSkip?: (() => void) | null;
}) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const [open, setOpen] = useState(false);
  const slotLabel = t(SLOT_KEY[meal.slot]);
  const names = meal.foods.map((f) => foodDisplayName({ id: f.foodId, name: f.name }, language));
  const dishKey = dishNameKeyFor(meal.dishId);
  const title = dishKey ? t(dishKey) : names.join(' · ');
  const count = meal.foods.length;
  const toggle = open
    ? t('nutrition.plan.hideIngredients')
    : count === 1
      ? t('nutrition.plan.ingredientsOne')
      : interpolate(t('nutrition.plan.ingredients'), { count: formatNumber(count, language) });
  const rebalance = done ? undefined : meal.rebalance;
  const covered = rebalance?.status === 'covered';
  const skipped = !done && meal.skipped === true;
  const muted = done || skipped || covered;

  return (
    <View
      accessibilityLabel={`${slotLabel} ${t('nutrition.plan.meal')}`}
      style={{ gap: spacing.sm, paddingVertical: spacing.md }}
      testID={`plan-meal-${dayIndex}-${meal.slot}`}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}
          style={[styles.grow, { gap: 2, minHeight: theme.spacing.x5l }]}
          testID={`plan-meal-toggle-${dayIndex}-${meal.slot}`}
        >
          <AppText style={{ color: colors.linkOnStage }} variant="caption">
            {slotLabel}
          </AppText>
          <AppText style={muted ? { color: colors.onStageVariant } : undefined} variant="label">
            {title}
          </AppText>
          <AppText tone="muted" variant="caption">
            {covered || skipped ? (
              // Covered or skipped today: the plan's kcal is no longer a suggestion.
              <AppText
                style={{ color: colors.onStageVariant }}
                testID={`plan-before-${dayIndex}-${meal.slot}`}
                variant="caption"
              >
                {t('nutrition.rebalance.before')}{' '}
                <AppText
                  style={{ color: colors.onStageVariant, textDecorationLine: 'line-through' }}
                  variant="caption"
                >
                  {formatKcalQuantity(rebalance?.plannedCalories ?? meal.totals.calories, language)}
                </AppText>
              </AppText>
            ) : (
              formatKcalQuantity(meal.totals.calories, language)
            )}{' '}
            ·{' '}
            <AppText style={{ color: colors.linkOnStage }} variant="caption">
              {toggle}
            </AppText>
          </AppText>
          {rebalance && rebalance.status !== 'covered' ? (
            <AppText
              style={{ color: colors.accentEnergy }}
              testID={`plan-rebalance-${dayIndex}-${meal.slot}`}
              variant="caption"
            >
              {interpolate(t(REBALANCE_LINE[rebalance.status]), {
                kcal: formatKcalQuantity(rebalance.plannedCalories, language),
              })}
            </AppText>
          ) : null}
          {skipped ? (
            <AppText
              tone="muted"
              testID={`plan-skipped-${dayIndex}-${meal.slot}`}
              variant="caption"
            >
              {t('nutrition.rebalance.skipped')}
            </AppText>
          ) : null}
        </Pressable>
        {covered || skipped ? null : done ? (
          <View
            accessibilityLabel={t('nutrition.plan.eaten')}
            accessible
            style={{
              alignItems: 'center',
              backgroundColor: colors.success,
              borderRadius: theme.spacing.x5l / 2,
              height: theme.spacing.x5l,
              justifyContent: 'center',
              width: theme.spacing.x5l,
            }}
            testID={`plan-eaten-${dayIndex}-${meal.slot}`}
          >
            <Icon color={colors.stageDeep} name="check" size={18} strokeWidth={3} />
          </View>
        ) : onEaten ? (
          <Pressable
            accessibilityLabel={interpolate(t('nutrition.plan.ateAccessibility'), {
              meal: slotLabel,
            })}
            accessibilityRole="button"
            onPress={onEaten}
            style={{
              alignItems: 'center',
              borderColor: withAlpha(colors.onStage, 0.35),
              borderRadius: theme.spacing.x5l / 2,
              borderWidth: 2,
              justifyContent: 'center',
              minHeight: theme.spacing.x5l,
              minWidth: theme.spacing.x5l,
            }}
            testID={`plan-ate-${dayIndex}-${meal.slot}`}
          >
            <Icon color={withAlpha(colors.onStage, 0.6)} name="check" size={18} strokeWidth={3} />
          </Pressable>
        ) : null}
      </View>
      {covered && !skipped ? (
        <View style={{ gap: spacing.sm }} testID={`plan-covered-${dayIndex}-${meal.slot}`}>
          <AppText style={{ color: colors.accentEnergy }} variant="label">
            {t('nutrition.rebalance.covered')}
          </AppText>
          <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
            {rebalance?.lightOption && onLightOption ? (
              <AppButton
                accessibilityLabel={interpolate(t('nutrition.rebalance.lightOptionA11y'), {
                  meal: slotLabel,
                  food: foodDisplayName(
                    { id: rebalance.lightOption.foodId, name: rebalance.lightOption.name },
                    language,
                  ),
                })}
                onPress={onLightOption}
                testID={`plan-light-${dayIndex}-${meal.slot}`}
                variant="secondary"
              >
                {interpolate(t('nutrition.rebalance.lightOption'), {
                  food: foodDisplayName(
                    { id: rebalance.lightOption.foodId, name: rebalance.lightOption.name },
                    language,
                  ),
                  kcal: formatKcalQuantity(rebalance.lightOption.calories, language),
                })}
              </AppButton>
            ) : null}
            {onSkip ? (
              <AppButton
                accessibilityLabel={interpolate(t('nutrition.rebalance.skipA11y'), {
                  meal: slotLabel,
                })}
                onPress={onSkip}
                testID={`plan-skip-${dayIndex}-${meal.slot}`}
                variant="secondary"
              >
                {t('nutrition.rebalance.skip')}
              </AppButton>
            ) : null}
          </View>
        </View>
      ) : null}
      {(meal.substitutions ?? []).map((substitution, index) => (
        <SubstitutionLine key={`${substitution.from}-${index}`} substitution={substitution} />
      ))}
      {open ? (
        <View
          style={{
            backgroundColor: colors.glassFill,
            borderRadius: radius.large,
            gap: spacing.xs,
            padding: spacing.md,
          }}
          testID={`plan-ingredients-${dayIndex}-${meal.slot}`}
        >
          {meal.foods.map((f, idx) => (
            <View key={`${f.foodId}-${idx}`} style={[styles.row, { gap: spacing.sm }]}>
              {/* BUG-028: formatQuantity keeps each value and its unit together. */}
              <AppText
                style={[styles.grow, f.swappedFrom ? { color: colors.linkOnStage } : undefined]}
                variant="caption"
              >
                {names[idx]}
                {f.swappedFrom ? ` ${t(SWAP_MARK_KEY)}` : ''}{' '}
                <AppText tone="muted" variant="caption">
                  ·{' '}
                  {formatIngredientAmount(f.foodId, f.serving.amount, f.serving.unit, language, t)}
                </AppText>
              </AppText>
              <AppText tone="muted" variant="caption">
                {formatKcalQuantity(f.macros.calories, language)}
              </AppText>
            </View>
          ))}
          <AppText tone="muted" variant="caption">
            {t('nutrition.plan.protein')} {formatQuantity(meal.totals.proteinG, 'g', language)} ·{' '}
            {t('nutrition.plan.carbs')} {formatQuantity(meal.totals.carbsG, 'g', language)} ·{' '}
            {t('nutrition.plan.fat')} {formatQuantity(meal.totals.fatG, 'g', language)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** A food logged outside the plan on the shown day (prototype "fuera del plan"). */
export interface PlanExtra {
  id: string;
  slot: MealSlot;
  name: string;
  servings: number;
  calories: number;
}

export function MealPlanPanel({
  day,
  isDone,
  onEaten,
  onLightOption = null,
  onSkip = null,
  extras = [],
  footer = null,
}: {
  day: ViewDay;
  isDone: (slot: MealSlot) => boolean;
  onEaten: ((slot: MealSlot) => void) | null;
  /** ADR-P040 v10-B, a covered day: eat the light option instead of the meal. */
  onLightOption?: ((slot: MealSlot) => void) | null;
  /** ADR-P040 v10-B: skip a pending meal today. */
  onSkip?: ((slot: MealSlot) => void) | null;
  extras?: readonly PlanExtra[];
  /** Rendered at the end of the panel (the tab's "Registrar comida"). */
  footer?: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  const { language, t } = useLocalization();
  return (
    <GlassCard style={{ gap: 0, padding: spacing.lg }}>
      <View style={{ gap: spacing.xs, paddingBottom: spacing.xs }}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon color={colors.linkOnStage} name="sparkle" size={17} />
          <AppText accessibilityRole="header" style={styles.grow} variant="panelTitle">
            {interpolate(t('nutrition.plan.mealsOfDay'), {
              day: formatNumber(day.index, language),
            })}
          </AppText>
        </View>
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
          <AppText
            style={{ color: colors.accentEnergy }}
            testID="plan-preview-badge"
            variant="label"
          >
            {t('nutrition.plan.previewBadge')}
          </AppText>
        ) : null}
        {day.rebalance && day.rebalance.status !== 'unchanged' ? (
          <AppText
            style={{ color: colors.accentEnergy }}
            testID="plan-rebalance-day"
            variant="caption"
          >
            {interpolate(
              t(
                day.rebalance.status === 'covered'
                  ? 'nutrition.rebalance.dayCovered'
                  : 'nutrition.rebalance.dayAdjusted',
              ),
              {
                consumed: formatNumber(day.rebalance.consumedCalories, language),
                target: formatKcalQuantity(day.rebalance.targetCalories, language),
              },
            )}
          </AppText>
        ) : null}
      </View>
      {bySlotOrder(day.meals).map((meal, index) => (
        <View
          key={meal.slot}
          style={
            index > 0
              ? { borderTopColor: colors.glassBorder, borderTopWidth: StyleSheet.hairlineWidth }
              : undefined
          }
        >
          <MealRow
            dayIndex={day.index}
            done={isDone(meal.slot)}
            meal={meal}
            onEaten={onEaten && !day.preview && !day.isFuture ? () => onEaten(meal.slot) : null}
            onLightOption={onLightOption && day.isToday ? () => onLightOption(meal.slot) : null}
            onSkip={onSkip && day.isToday ? () => onSkip(meal.slot) : null}
          />
        </View>
      ))}
      {bySlotOrder(extras).map((extra) => (
        <View
          key={extra.id}
          style={{
            borderTopColor: colors.glassBorder,
            borderTopWidth: StyleSheet.hairlineWidth,
            gap: 2,
            paddingVertical: spacing.md,
          }}
          testID={`plan-extra-${extra.id}`}
        >
          <AppText style={{ color: colors.accentEnergy }} variant="caption">
            {interpolate(t('nutrition.plan.extraLabel'), { slot: t(SLOT_KEY[extra.slot]) })}
          </AppText>
          <AppText variant="label">{extra.name}</AppText>
          <AppText tone="muted" variant="caption">
            {`${interpolate(
              t(
                extra.servings === 1
                  ? 'nutrition.plan.extraServingOne'
                  : 'nutrition.plan.extraServingMany',
              ),
              { servings: formatNumber(extra.servings, language) },
            )} · ${formatKcalQuantity(extra.calories, language)}`}
          </AppText>
        </View>
      ))}
      {footer ? <View style={{ paddingTop: spacing.md }}>{footer}</View> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { alignItems: 'center', flexDirection: 'row' },
  wrap: { flexWrap: 'wrap' },
});
