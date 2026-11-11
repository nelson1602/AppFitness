import type { DietaryPreference } from '../domain/dietary-preference';
import {
  adaptDish,
  DISH_PLAN_COUNTRY,
  dishesForSlot,
  dishNameKey,
} from '../domain/dominican-dishes';
import type { AvoidTag, FoodId, FoodItem } from '../domain/food-catalog';
import type { MealMacros, MealSlot } from '../domain/meal-plan';
import {
  type DayRebalance,
  type LighterDish,
  rebalanceDay,
  type RebalanceMeal,
} from '../domain/meal-rebalance';
import { getById } from './food-catalog.service';
import { toMealExclusions } from './meal-plan.service';
import { NEVER_PLANNED_TAGS, scaleFood, sumMacros } from './meal-portions';

/**
 * Wires today's data into the rebalance rule (ADR-P040 Addendum v10-B). The
 * rule itself is pure (`domain/meal-rebalance.ts`); this service supplies the
 * catalogue, the person's exclusions and the lighter dishes.
 */

/** What the plan may serve: not excluded by the person, not a never-planned tag. */
export function plannedFoodFilter(
  preferences: readonly DietaryPreference[],
): (id: FoodId) => boolean {
  const { avoidTags, catalogKeys } = toMealExclusions(preferences);
  const blockedTags = new Set<AvoidTag>([...avoidTags, ...NEVER_PLANNED_TAGS]);
  const excluded = new Set<FoodId>(catalogKeys);
  return (id) => {
    const item = getById(id);
    return (
      item === undefined ||
      excluded.has(id) ||
      (item.avoidFor ?? []).some((tag) => blockedTags.has(tag))
    );
  };
}

/**
 * The slot's Dominican dishes at their household portion, adapted to the
 * person's exclusions, lightest first. Only Dominican dish plans swap dishes;
 * every other plan marks a too-small meal optional instead.
 */
export function lighterDishesFor(
  country: string | undefined,
  isBlocked: (id: FoodId) => boolean,
): (slot: MealSlot) => readonly LighterDish[] {
  if (country !== DISH_PLAN_COUNTRY) return () => [];
  const cache = new Map<MealSlot, LighterDish[]>();
  return (slot) => {
    const cached = cache.get(slot);
    if (cached) return cached;
    const dishes = dishesForSlot(slot).flatMap((dish): LighterDish[] => {
      const adapted = adaptDish(dish, isBlocked, getById);
      const foods = adapted.lines.flatMap((line) => {
        const item: FoodItem | undefined = getById(line.food);
        return item ? [scaleFood(item, line.servings)] : [];
      });
      if (foods.length === 0) return [];
      return [
        { dishId: dish.id, dishNameKey: dishNameKey(dish.id), foods, totals: sumMacros(foods) },
      ];
    });
    dishes.sort(
      (a, b) => a.totals.calories - b.totals.calories || a.dishId.localeCompare(b.dishId),
    );
    cache.set(slot, dishes);
    return dishes;
  };
}

export interface TodayRebalanceInput {
  meals: readonly RebalanceMeal[];
  closedSlots: ReadonlySet<MealSlot>;
  targetCalories: number;
  proteinTargetG: number;
  consumed: MealMacros;
  country: string | undefined;
  preferences: readonly DietaryPreference[];
}

export function rebalanceToday(input: TodayRebalanceInput): DayRebalance {
  const isBlocked = plannedFoodFilter(input.preferences);
  return rebalanceDay({
    meals: input.meals,
    closedSlots: input.closedSlots,
    targetCalories: input.targetCalories,
    proteinTargetG: input.proteinTargetG,
    consumed: input.consumed,
    lighterDishes: lighterDishesFor(input.country, isBlocked),
    food: getById,
    isBlocked,
  });
}
