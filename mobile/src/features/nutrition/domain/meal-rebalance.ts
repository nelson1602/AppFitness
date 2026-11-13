import type { FoodId, FoodItem } from './food-catalog';
import type { MealMacros, MealPlanFood, MealSlot } from './meal-plan';
import { MEAL_SLOTS } from './meal-plan';

/**
 * Real-time meal rebalancing (ADR-P040 Addendum v10-B, amended by v11-A and v11-B:
 * `meal-rebalance@1.2.0`).
 *
 * An overlay computed from today's log, never a write to the saved plan (the
 * same contract as the off-plan adjustment, D7). Every food logged today —
 * from the plan or "fuera del plan" — changes what is left of the day, and the
 * meals not yet eaten are re-portioned to it:
 *
 * 0. Today's plan at today's target (v1.1.0): a saved day planned for another
 *    target is first portioned to today's target, with no label ("fitted").
 *    On a carry-over day (v1.2.0, Addendum v11-B) a plan already within 5 %
 *    under the target is portioned up too, when that plans more.
 * 1. remaining = the day's target (+ the activity bonus) − consumed today.
 *    The target itself never changes.
 * 2. Meals already eaten ("Lo comí") or skipped ("Omitir") are never touched.
 *    With nothing logged or skipped today, today's plan stands as it is.
 * 3. The pending meals are scaled by remaining ÷ their planned kcal, unless
 *    they already fit (at most what is left, and not more than 5 % under it).
 *    Protein-rich foods keep as much of the protein still needed today as they
 *    can; the other foods take the rest. Portions stay in 0.25-serving steps,
 *    rounded down where needed so the pending meals NEVER plan more than what
 *    is left (v1.1.0).
 * 4. A pending meal that would fall below 150 kcal becomes a lighter dish of
 *    the catalogue for its slot (Dominican dishes, country DO), when one fits;
 *    otherwise it is marked optional. The other pending meals pay for the
 *    swap; a swap that does not fit in what is left is not made (v1.1.0).
 * 5. remaining ≤ 0: every pending meal says the day is covered and offers one
 *    light option of at most 100 kcal, or skipping it.
 *
 * Deleting a logged food lowers "consumed", so the overlay recomputes to the
 * plan as it was: nothing is stored. Pure and deterministic: identical inputs
 * give deep-equal outputs. Wellness wording only.
 */
export const MEAL_REBALANCE_RULE_VERSION = 'meal-rebalance@1.2.0';

/** Pending meals at most 5 % under what is left (never over it) are kept as planned. */
export const REBALANCE_TOLERANCE = 0.05;
/** The smallest meal the plan serves after rebalancing. */
export const MIN_MEAL_KCAL = 150;
/** A light option when the day is covered: one serving of at most this. */
export const LIGHT_OPTION_MAX_KCAL = 100;
/** A food is protein-rich when protein carries at least this share of its kcal (meal-portions). */
const PROTEIN_SHARE = 0.35;
/** A lighter dish may exceed the meal's new budget by at most this factor. */
const SWAP_HEADROOM = 1.25;
/** Portions move in quarter servings. */
const QUARTER = 0.25;
/** Float guard for the quarter-step arithmetic. */
const EPS = 1e-9;

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
  /** The day's calorie target including today's activity bonus and carry-over. */
  targetCalories: number;
  /**
   * v1.2.0 (Addendum v11-B): today's target carries a positive carry-over, so a
   * plan that fits it within 5 % is still portioned up when that plans more.
   */
  carryOverUp?: boolean;
  proteinTargetG: number;
  /** Everything logged today, from the plan and outside it. */
  consumed: MealMacros;
  /** Lighter catalogue dishes for a slot, lightest first (DO plans); [] elsewhere. */
  lighterDishes: (slot: MealSlot) => readonly LighterDish[];
  food: (id: FoodId) => FoodItem | undefined;
  isBlocked: (id: FoodId) => boolean;
}

/**
 * `fitted`: today's plan portioned to today's target, with nothing logged to
 * explain a change (no label). The others follow something logged or skipped
 * today and are labelled.
 */
export type RebalancedMealStatus = 'fitted' | 'scaled' | 'swapped' | 'optional' | 'covered';

export interface RebalancedMeal extends RebalanceMeal {
  status: RebalancedMealStatus;
  /** Today's planned kcal for the meal before the rebalance (for "antes X kcal"). */
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
  /**
   * Pending meals after the rebalance, in slot order. When unchanged: the
   * `fitted` meals if today's plan was portioned to today's target, else empty.
   */
  meals: readonly RebalancedMeal[];
  /**
   * v1.1.0: today's plan at today's target for every slot (open or closed),
   * when the saved day was planned for another total; empty when it already fits.
   */
  fittedPlan: readonly RebalanceMeal[];
  /**
   * The day's planned total: consumed + what the pending meals now plan,
   * never above the target. What was eaten beyond the target is consumption,
   * not plan, so a covered day plans exactly its target.
   */
  plannedTotalCalories: number;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

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

const kcalOf = (meals: readonly { totals: MealMacros }[]): number =>
  meals.reduce((sum, meal) => sum + meal.totals.calories, 0);

function isProteinRich(food: MealPlanFood): boolean {
  return food.macros.proteinG * 4 >= PROTEIN_SHARE * Math.max(1, food.macros.calories);
}

/** The kcal a plan line has at `servings`, rounded as the line rounds it. */
function kcalAt(food: MealPlanFood, servings: number): number {
  return Math.round((food.macros.calories * servings) / food.servings);
}

/** A plan line at exactly `servings`. */
function atServings(food: MealPlanFood, servings: number): MealPlanFood {
  const ratio = servings / food.servings;
  return {
    ...food,
    servings,
    serving: { amount: r1(food.serving.amount * ratio), unit: food.serving.unit },
    macros: {
      calories: kcalAt(food, servings),
      proteinG: r1(food.macros.proteinG * ratio),
      carbsG: r1(food.macros.carbsG * ratio),
      fatG: r1(food.macros.fatG * ratio),
    },
  };
}

/**
 * Quarter-serving portions for foods scaled by `factors`, never above `cap`
 * kcal (v1.1.0): every food rounds down to its quarter step, then the steps
 * with the largest remainders are given back while the meal still fits. A food
 * that rounds to nothing leaves the meal.
 */
function quantize(
  foods: readonly MealPlanFood[],
  factors: readonly number[],
  cap: number,
): MealPlanFood[] {
  const exact = foods.map((food, i) => Math.max(0, food.servings * factors[i]));
  const servings = exact.map((x) => Math.floor(x / QUARTER + EPS) * QUARTER);
  let total = foods.reduce((sum, food, i) => sum + kcalAt(food, servings[i]), 0);
  const byRemainder = foods
    .map((_, i) => i)
    .sort((a, b) => exact[b] - servings[b] - (exact[a] - servings[a]) || a - b);
  for (const i of byRemainder) {
    if (exact[i] - servings[i] <= EPS) continue;
    const next = total - kcalAt(foods[i], servings[i]) + kcalAt(foods[i], servings[i] + QUARTER);
    if (next <= cap) {
      total = next;
      servings[i] += QUARTER;
    }
  }
  // Each line rounds its own kcal, so the floors alone can still sum above
  // the cap: take back the largest steps until the meal fits.
  while (total > cap) {
    let pick = -1;
    let step = 0;
    foods.forEach((food, i) => {
      if (servings[i] <= 0) return;
      const drop = kcalAt(food, servings[i]) - kcalAt(food, servings[i] - QUARTER);
      if (drop > step) {
        step = drop;
        pick = i;
      }
    });
    if (pick < 0) break;
    total -= step;
    servings[pick] -= QUARTER;
  }
  return foods.flatMap((food, i) => (servings[i] > 0 ? [atServings(food, servings[i])] : []));
}

/**
 * One meal portioned to at most `budget` kcal: protein-rich foods by
 * `proteinFactor`, the others by what keeps the meal on budget (never below
 * zero), in quarter steps that never exceed the budget.
 */
function portioned(meal: RebalanceMeal, budget: number, proteinFactor: number): RebalanceMeal {
  const proteinKcal = meal.foods.filter(isProteinRich).reduce((s, f) => s + f.macros.calories, 0);
  const otherKcal = meal.totals.calories - proteinKcal;
  let pFactor = proteinFactor;
  let oFactor = otherKcal > 0 ? (budget - pFactor * proteinKcal) / otherKcal : 0;
  if (otherKcal <= 0 || oFactor < 0) {
    // Only protein foods (or they alone exceed the budget): they take it all.
    oFactor = 0;
    pFactor = proteinKcal > 0 ? budget / proteinKcal : 0;
  }
  const foods = quantize(
    meal.foods,
    meal.foods.map((food) => (isProteinRich(food) ? pFactor : oFactor)),
    Math.floor(budget + EPS),
  );
  return { ...meal, foods, totals: sumMacros(foods) };
}

/** Planned kcal that may stand: never above `available`, and at most 5 % under it. */
function fits(planned: number, available: number): boolean {
  return planned <= available && planned >= available * (1 - REBALANCE_TOLERANCE);
}

/** Between the calorie scale and no change: the factor that keeps the protein still needed. */
function proteinFactorFor(scale: number, proteinNeeded: number, pendingProtein: number): number {
  const ratio = pendingProtein > 0 ? proteinNeeded / pendingProtein : scale;
  return scale < 1 ? Math.min(1, Math.max(scale, ratio)) : Math.max(1, Math.min(scale, ratio));
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

/**
 * 0. Today's plan at today's target (v1.1.0). A saved day planned for another
 * target (a week kept "until Monday" after the evaluation changed it, or an
 * activity bonus) is portioned to today's target first, without a label:
 * nothing logged today explains a change.
 */
function todaysPlan(
  meals: readonly RebalanceMeal[],
  target: number,
  carryOverUp: boolean,
): { meals: RebalanceMeal[]; fitted: boolean } {
  const ordered = MEAL_SLOTS.flatMap((slot) => meals.filter((meal) => meal.slot === slot));
  const planned = kcalOf(ordered);
  if (planned <= 0 || target <= 0) return { meals: ordered, fitted: false };
  const alreadyFits = fits(planned, target);
  if (alreadyFits && !(carryOverUp && planned < target)) return { meals: ordered, fitted: false };
  const scale = target / planned;
  const fitted = ordered.map((meal) => portioned(meal, meal.totals.calories * scale, scale));
  // v1.2.0: portioning up by a few % can round below the plan; keep the plan then.
  if (alreadyFits && kcalOf(fitted) <= planned) return { meals: ordered, fitted: false };
  return { meals: fitted, fitted: true };
}

export function rebalanceDay(input: RebalanceInput): DayRebalance {
  const consumed = Math.round(input.consumed.calories);
  const target = Math.round(input.targetCalories);
  const remaining = target - consumed;
  const today = todaysPlan(input.meals, target, input.carryOverUp === true);
  const pending = today.meals.filter((meal) => !input.closedSlots.has(meal.slot));
  const planned = kcalOf(pending);
  const base = {
    ruleVersion: MEAL_REBALANCE_RULE_VERSION,
    targetCalories: target,
    consumedCalories: consumed,
    remainingCalories: remaining,
    fittedPlan: today.fitted ? today.meals : [],
  } as const;
  const asPlanned = (): RebalancedMeal[] =>
    today.fitted
      ? pending.map((meal) => ({
          ...meal,
          status: 'fitted' as const,
          plannedCalories: meal.totals.calories,
        }))
      : [];

  if (pending.length === 0 || planned <= 0) {
    return {
      ...base,
      status: 'unchanged',
      scale: 1,
      meals: [],
      plannedTotalCalories: Math.min(target, consumed),
    };
  }

  // 2. Nothing logged or skipped today: today's plan stands, with no label.
  if (consumed === 0 && input.closedSlots.size === 0) {
    return {
      ...base,
      status: 'unchanged',
      scale: 1,
      meals: asPlanned(),
      plannedTotalCalories: Math.min(target, planned),
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

  if (fits(planned, remaining)) {
    return {
      ...base,
      status: 'unchanged',
      scale: 1,
      meals: asPlanned(),
      plannedTotalCalories: Math.min(target, consumed + planned),
    };
  }

  // 4. A meal too small to serve becomes a lighter dish of its slot. The other
  // pending meals pay for it, so a swap that does not fit in what is left is
  // not made (the largest first) and that meal is portioned instead.
  const scale = remaining / planned;
  const swaps = new Map<MealSlot, LighterDish>();
  for (const meal of pending) {
    const budget = meal.totals.calories * scale;
    if (budget >= MIN_MEAL_KCAL) continue;
    const lighter = input
      .lighterDishes(meal.slot)
      .find(
        (dish) =>
          dish.dishId !== meal.dishId &&
          dish.totals.calories <= Math.max(budget, MIN_MEAL_KCAL) * SWAP_HEADROOM,
      );
    if (lighter) swaps.set(meal.slot, lighter);
  }
  while (kcalOf([...swaps.values()]) > remaining) {
    const [largest] = [...swaps.entries()].sort(
      ([slotA, a], [slotB, b]) =>
        b.totals.calories - a.totals.calories ||
        MEAL_SLOTS.indexOf(slotB) - MEAL_SLOTS.indexOf(slotA),
    );
    swaps.delete(largest[0]);
  }

  // 3. The other pending meals share what is left after the swaps, protein first.
  const swapped = [...swaps.values()];
  const rest = pending.filter((meal) => !swaps.has(meal.slot));
  const restPlanned = kcalOf(rest);
  const restScale = restPlanned > 0 ? (remaining - kcalOf(swapped)) / restPlanned : 0;
  const proteinNeeded = Math.max(
    0,
    input.proteinTargetG -
      input.consumed.proteinG -
      swapped.reduce((sum, dish) => sum + dish.totals.proteinG, 0),
  );
  const proteinFactor = proteinFactorFor(
    restScale,
    proteinNeeded,
    rest.reduce((sum, meal) => sum + meal.totals.proteinG, 0),
  );

  const meals = pending.map((meal): RebalancedMeal => {
    const plannedCalories = meal.totals.calories;
    const lighter = swaps.get(meal.slot);
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
    const budget = plannedCalories * restScale;
    return {
      ...portioned(meal, budget, proteinFactor),
      status: budget < MIN_MEAL_KCAL ? 'optional' : 'scaled',
      plannedCalories,
    };
  });

  return {
    ...base,
    status: 'adjusted',
    scale,
    meals,
    plannedTotalCalories: Math.min(target, consumed + kcalOf(meals)),
  };
}
