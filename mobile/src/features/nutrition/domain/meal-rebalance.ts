import type { FoodId, FoodItem } from './food-catalog';
import type { MealMacros, MealPlanFood, MealSlot } from './meal-plan';
import { MEAL_SLOTS } from './meal-plan';

/**
 * Real-time meal rebalancing (ADR-P040 Addendum v10-B, `meal-rebalance@1.0.0`).
 *
 * An overlay computed from today's log, never a write to the saved plan (the
 * same contract as the off-plan adjustment, D7). Every food logged today —
 * from the plan or "fuera del plan" — changes what is left of the day, and the
 * meals not yet eaten are re-portioned to it:
 *
 * 1. remaining = the day's target (+ the activity bonus) − consumed today.
 *    The target itself never changes.
 * 2. Meals already eaten ("Lo comí") or skipped ("Omitir") are never touched.
 * 3. The pending meals are scaled by remaining ÷ their planned kcal, unless
 *    they already fit within ±5 %. Protein-rich foods keep as much of the
 *    protein still needed today as they can; the other foods take the rest.
 *    Portions stay in the plan's 0.25-serving steps.
 * 4. A pending meal that would fall below 150 kcal becomes a lighter dish of
 *    the catalogue for its slot (Dominican dishes, country DO), when one fits;
 *    otherwise it is marked optional.
 * 5. remaining ≤ 0: every pending meal says the day is covered and offers one
 *    light option of at most 100 kcal, or skipping it.
 *
 * Deleting a logged food lowers "consumed", so the overlay recomputes to the
 * plan as it was: nothing is stored. Pure and deterministic: identical inputs
 * give deep-equal outputs. Wellness wording only.
 */
export const MEAL_REBALANCE_RULE_VERSION = 'meal-rebalance@1.0.0';

/** Pending meals within ±5 % of what is left are kept as planned. */
export const REBALANCE_TOLERANCE = 0.05;
/** The smallest meal the plan serves after rebalancing. */
export const MIN_MEAL_KCAL = 150;
/** A light option when the day is covered: one serving of at most this. */
export const LIGHT_OPTION_MAX_KCAL = 100;
/** A food is protein-rich when protein carries at least this share of its kcal (meal-portions). */
const PROTEIN_SHARE = 0.35;
/** A lighter dish may exceed the meal's new budget by at most this factor. */
const SWAP_HEADROOM = 1.25;

/**
 * Light options, in order of preference (one catalogue serving each, ≤ 100
 * kcal): fruit first, then yogurt and vegetables. The first not excluded is
 * offered, rotated by the meal's slot so two covered meals differ.
 */
export const LIGHT_OPTIONS: readonly FoodId[] = [
  'food.papaya',
  'food.pineapple',
  'food.orange',
  'food.watermelon',
  'food.strawberries',
  'food.greek_yogurt_nonfat',
  'food.cucumber',
];

/** The plan meal as the rebalance reads it (the saved plan's `PlannedMeal` fits). */
export interface RebalanceMeal {
  slot: MealSlot;
  dishId?: string;
  dishNameKey?: string;
  foods: readonly MealPlanFood[];
  totals: MealMacros;
}

/** A lighter dish the catalogue offers for a slot, already adapted to the exclusions. */
export interface LighterDish {
  dishId: string;
  dishNameKey: string;
  foods: readonly MealPlanFood[];
  totals: MealMacros;
}

export interface RebalanceInput {
  /** Today's planned meals (the saved plan's effective day). */
  meals: readonly RebalanceMeal[];
  /** Slots eaten or skipped today: never touched. */
  closedSlots: ReadonlySet<MealSlot>;
  /** The day's calorie target including today's activity bonus. */
  targetCalories: number;
  proteinTargetG: number;
  /** Everything logged today, from the plan and outside it. */
  consumed: MealMacros;
  /** Lighter catalogue dishes for a slot, lightest first (DO plans); [] elsewhere. */
  lighterDishes: (slot: MealSlot) => readonly LighterDish[];
  food: (id: FoodId) => FoodItem | undefined;
  isBlocked: (id: FoodId) => boolean;
}

export type RebalancedMealStatus = 'scaled' | 'swapped' | 'optional' | 'covered';

export interface RebalancedMeal extends RebalanceMeal {
  status: RebalancedMealStatus;
  /** The planned kcal before the rebalance (for "antes X kcal"). */
  plannedCalories: number;
  /** status 'covered': one light option, when the catalogue has one not excluded. */
  lightOption?: { foodId: FoodId; name: string; calories: number };
}

export interface DayRebalance {
  ruleVersion: typeof MEAL_REBALANCE_RULE_VERSION;
  status: 'unchanged' | 'adjusted' | 'covered';
  targetCalories: number;
  consumedCalories: number;
  /** target − consumed, may be negative. */
  remainingCalories: number;
  /** The pending meals' scale (remaining ÷ planned); 1 when unchanged, 0 when covered. */
  scale: number;
  /** Pending meals after the rebalance, in slot order; empty when unchanged. */
  meals: readonly RebalancedMeal[];
  /**
   * The day's planned total: consumed + what the pending meals now plan,
   * never above the target. What was eaten beyond the target is consumption,
   * not plan, so a covered day plans exactly its target.
   */
  plannedTotalCalories: number;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const quarter = (n: number): number => Math.round(n * 4) / 4;

function sumMacros(foods: readonly MealPlanFood[]): MealMacros {
  return foods.reduce<MealMacros>(
    (acc, f) => ({
      calories: acc.calories + f.macros.calories,
      proteinG: r1(acc.proteinG + f.macros.proteinG),
      carbsG: r1(acc.carbsG + f.macros.carbsG),
      fatG: r1(acc.fatG + f.macros.fatG),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function isProteinRich(food: MealPlanFood): boolean {
  return food.macros.proteinG * 4 >= PROTEIN_SHARE * Math.max(1, food.macros.calories);
}

/** A plan line at a new serving multiple, in the plan's 0.25 steps; null when it rounds to 0. */
function rescale(food: MealPlanFood, factor: number): MealPlanFood | null {
  const servings = quarter(food.servings * factor);
  if (servings <= 0) return null;
  const ratio = servings / food.servings;
  return {
    ...food,
    servings,
    serving: { amount: r1(food.serving.amount * ratio), unit: food.serving.unit },
    macros: {
      calories: Math.round(food.macros.calories * ratio),
      proteinG: r1(food.macros.proteinG * ratio),
      carbsG: r1(food.macros.carbsG * ratio),
      fatG: r1(food.macros.fatG * ratio),
    },
  };
}

/**
 * One meal portioned to `budget` kcal: protein-rich foods by `proteinFactor`,
 * the others by what keeps the meal on budget (never below zero).
 */
function portionMeal(meal: RebalanceMeal, budget: number, proteinFactor: number): MealPlanFood[] {
  const proteinKcal = meal.foods.filter(isProteinRich).reduce((s, f) => s + f.macros.calories, 0);
  const otherKcal = meal.totals.calories - proteinKcal;
  let pFactor = proteinFactor;
  let oFactor = otherKcal > 0 ? (budget - pFactor * proteinKcal) / otherKcal : 0;
  if (otherKcal <= 0 || oFactor < 0) {
    // Only protein foods (or they alone exceed the budget): they take it all.
    oFactor = 0;
    pFactor = proteinKcal > 0 ? budget / proteinKcal : 0;
  }
  return meal.foods.flatMap((food) => {
    const scaled = rescale(food, isProteinRich(food) ? pFactor : oFactor);
    return scaled ? [scaled] : [];
  });
}

function lightOptionFor(
  slot: MealSlot,
  food: RebalanceInput['food'],
  isBlocked: RebalanceInput['isBlocked'],
): RebalancedMeal['lightOption'] {
  const offset = MEAL_SLOTS.indexOf(slot);
  for (let i = 0; i < LIGHT_OPTIONS.length; i += 1) {
    const id = LIGHT_OPTIONS[(offset + i) % LIGHT_OPTIONS.length];
    const item = food(id);
    if (item && !isBlocked(id) && item.calories <= LIGHT_OPTION_MAX_KCAL) {
      return { foodId: id, name: item.name, calories: Math.round(item.calories) };
    }
  }
  return undefined;
}

export function rebalanceDay(input: RebalanceInput): DayRebalance {
  const consumed = Math.round(input.consumed.calories);
  const target = Math.round(input.targetCalories);
  const remaining = target - consumed;
  const pending = MEAL_SLOTS.flatMap((slot) =>
    input.meals.filter((meal) => meal.slot === slot && !input.closedSlots.has(slot)),
  );
  const planned = pending.reduce((sum, meal) => sum + meal.totals.calories, 0);
  const base = {
    ruleVersion: MEAL_REBALANCE_RULE_VERSION,
    targetCalories: target,
    consumedCalories: consumed,
    remainingCalories: remaining,
  } as const;

  if (pending.length === 0 || planned <= 0) {
    return {
      ...base,
      status: 'unchanged',
      scale: 1,
      meals: [],
      plannedTotalCalories: Math.min(target, consumed),
    };
  }

  // 5. The day is covered: each pending meal offers a light option or skipping it.
  if (remaining <= 0) {
    return {
      ...base,
      status: 'covered',
      scale: 0,
      meals: pending.map((meal) => ({
        ...meal,
        status: 'covered' as const,
        plannedCalories: meal.totals.calories,
        lightOption: lightOptionFor(meal.slot, input.food, input.isBlocked),
      })),
      plannedTotalCalories: target,
    };
  }

  const scale = remaining / planned;
  if (Math.abs(scale - 1) <= REBALANCE_TOLERANCE) {
    return {
      ...base,
      status: 'unchanged',
      scale: 1,
      meals: [],
      plannedTotalCalories: Math.min(target, consumed + planned),
    };
  }

  // 3. Protein: the protein-rich foods keep as much of today's remaining
  // protein as they can, between the calorie scale and no change.
  const proteinNeeded = Math.max(0, input.proteinTargetG - input.consumed.proteinG);
  const pendingProtein = pending.reduce((sum, meal) => sum + meal.totals.proteinG, 0);
  const proteinRatio = pendingProtein > 0 ? proteinNeeded / pendingProtein : scale;
  const proteinFactor =
    scale < 1
      ? Math.min(1, Math.max(scale, proteinRatio))
      : Math.max(1, Math.min(scale, proteinRatio));

  const meals = pending.map((meal): RebalancedMeal => {
    const budget = meal.totals.calories * scale;
    const plannedCalories = meal.totals.calories;
    if (budget < MIN_MEAL_KCAL) {
      // 4. Too small to be a meal: a lighter dish that fits, else optional.
      const lighter = input
        .lighterDishes(meal.slot)
        .find(
          (dish) =>
            dish.dishId !== meal.dishId &&
            dish.totals.calories <= Math.max(budget, MIN_MEAL_KCAL) * SWAP_HEADROOM,
        );
      if (lighter) {
        return {
          slot: meal.slot,
          dishId: lighter.dishId,
          dishNameKey: lighter.dishNameKey,
          foods: lighter.foods,
          totals: lighter.totals,
          status: 'swapped',
          plannedCalories,
        };
      }
      const foods = portionMeal(meal, budget, proteinFactor);
      return { ...meal, foods, totals: sumMacros(foods), status: 'optional', plannedCalories };
    }
    const foods = portionMeal(meal, budget, proteinFactor);
    return { ...meal, foods, totals: sumMacros(foods), status: 'scaled', plannedCalories };
  });

  return {
    ...base,
    status: 'adjusted',
    scale,
    meals,
    plannedTotalCalories: Math.min(
      target,
      consumed + meals.reduce((sum, meal) => sum + meal.totals.calories, 0),
    ),
  };
}
