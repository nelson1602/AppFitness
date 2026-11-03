import {
  adaptDish,
  dishesForSlot,
  dishNameKey,
  type AdaptedDish,
  type AdaptedLine,
} from '../domain/dominican-dishes';
import { CATALOG_VERSION, type AvoidTag, type FoodId, type FoodItem } from '../domain/food-catalog';
import {
  MEAL_RULE_VERSION,
  MEAL_SLOTS,
  type MealMacros,
  type MealPlan,
  type MealPlanDay,
  type MealPlanFood,
  type MealPlanInput,
  type MealPlanMeal,
  type MealSlot,
} from '../domain/meal-plan';
import { restrictionsToAvoidTags } from '../domain/restriction-map';
import { dishPortions, type DishPortionEntry } from './dish-portions';
import {
  NEVER_PLANNED_TAGS,
  SLOT_SPLIT,
  clampServings,
  scaleFood,
  seedHash,
  slotTarget,
  sumMacros,
} from './meal-portions';

/**
 * The Dominican dish plan (v8.1, meal-rules@1.6.0).
 *
 * For each day and meal a dish is taken from the Dominican catalogue by a
 * fixed rotation (the seed only chooses where each slot's rotation starts).
 * The rotation serves the slot's everyday dishes on three days out of four
 * and one of its other dishes on the fourth (meal-rules@1.6.0), so any 15
 * days carry at least 11 everyday dishes per meal, and the same dish never
 * falls on two days in a row. The person's exclusions
 * never change WHICH dish is served — only the excluded ingredient is swapped
 * or left out (ADR-P040 D3, `adaptDish`), which is what lets the plan say
 * "Ajustado por iCoach: X → Y".
 *
 * The dish's household portions are scaled to its meal's share of the day and
 * then go through the plan's portion rules (`dish-portions`): energy-dense
 * caps, ≤ 40 % of a main meal from one food, the vegetable ceiling, the snack
 * minimum and drop rule, and the day never below the engine's target — always
 * moving the food furthest from its share of the recipe first, so the dish
 * stays recognisable. Seasonings keep their small fixed amount.
 *
 * PURE: no clock, no randomness, no I/O. Returns null when a slot has no dish
 * left with enough ingredients, and the caller falls back to the food plan.
 */

const DEFAULT_DAYS = 15;

/** Distinct primes so each slot's rotation starts somewhere else. */
const SLOT_SEED: Record<MealSlot, number> = {
  BREAKFAST: 211,
  LUNCH: 223,
  DINNER: 227,
  SNACK: 229,
};

/** A dish still worth serving after its exclusions: main meals keep 2+ foods, the snack 1+. */
function isViable(adapted: AdaptedDish): boolean {
  const scalable = adapted.lines.filter((entry) => !entry.seasoning).length;
  return adapted.dish.slot === 'SNACK' ? scalable >= 1 : scalable >= 2;
}

interface PlannedDish {
  slot: MealSlot;
  adapted: AdaptedDish;
}

interface DishEntry extends DishPortionEntry {
  line: AdaptedLine;
}

/** Of every four days, this many serve an everyday dish (meal-rules@1.6.0). */
const EVERYDAY_RUN = 3;

/**
 * A slot's rotation: three everyday dishes in catalogue order, then one other
 * dish, repeated. Its length is a whole number of both cycles, so wrapping
 * around continues the same pattern (no dish twice in a row at the seam).
 */
export function slotRotation<T extends { dish: { everyday?: true } }>(
  options: readonly T[],
): T[] {
  const everyday = options.filter((option) => option.dish.everyday);
  const other = options.filter((option) => !option.dish.everyday);
  if (everyday.length === 0 || other.length === 0) return [...options];
  const rotation: T[] = [];
  for (let block = 0; block < everyday.length * other.length; block += 1) {
    for (let run = 0; run < EVERYDAY_RUN; run += 1) {
      rotation.push(everyday[(block * EVERYDAY_RUN + run) % everyday.length]);
    }
    rotation.push(other[block % other.length]);
  }
  return rotation;
}

function pickDish(
  slot: MealSlot,
  dayIndex: number,
  hash: number,
  rotation: readonly AdaptedDish[],
): AdaptedDish | null {
  const count = rotation.length;
  const start = (hash + SLOT_SEED[slot] + (dayIndex - 1)) % count;
  // The rotation's dish, or the next one that is still viable.
  for (let step = 0; step < count; step += 1) {
    const adapted = rotation[(start + step) % count];
    if (isViable(adapted)) return adapted;
  }
  return null;
}

function buildDay(
  dayIndex: number,
  dishes: readonly PlannedDish[],
  daily: MealMacros,
  food: (id: FoodId) => FoodItem,
): MealPlanDay {
  // Each dish scaled to its meal's share of the day, seasonings aside.
  const scaled: DishEntry[] = [];
  for (const { slot, adapted } of dishes) {
    const lines = adapted.lines.filter((entry) => !entry.seasoning);
    const base = lines.reduce((sum, entry) => sum + food(entry.food).calories * entry.servings, 0);
    const factor = (daily.calories * SLOT_SPLIT[slot]) / Math.max(1, base);
    for (const entry of lines) {
      const item = food(entry.food);
      scaled.push({
        slot,
        food: item,
        mpf: scaleFood(item, clampServings(entry.servings * factor)),
        share: (item.calories * entry.servings) / Math.max(1, base),
        // Milk and yogurt carry a dish's protein too (avena con leche, yogur).
        proteinRole: entry.role === 'protein' || entry.role === 'dairy',
        line: entry,
      });
    }
  }

  dishPortions(scaled, daily);

  // A dropped snack's share of the day goes to the main meals, in proportion.
  const kept = dishes.filter(({ slot }) => scaled.some((entry) => entry.slot === slot));
  const planned = kept.reduce((sum, { slot }) => sum + SLOT_SPLIT[slot], 0);
  const meals: MealPlanMeal[] = kept.map(({ slot, adapted }) => {
    const foods: MealPlanFood[] = adapted.lines.flatMap((entry): MealPlanFood[] => {
      const mpf = entry.seasoning
        ? scaleFood(food(entry.food), entry.servings)
        : scaled.find((candidate) => candidate.slot === slot && candidate.line === entry)?.mpf;
      if (!mpf) return [];
      return [entry.swappedFrom ? { ...mpf, swappedFrom: entry.swappedFrom } : mpf];
    });
    const split = SLOT_SPLIT[slot] / planned;
    const target = slotTarget(daily, split);
    return {
      slot,
      dishId: adapted.dish.id,
      dishNameKey: dishNameKey(adapted.dish.id),
      ...(adapted.adjustments.length > 0 ? { adjustments: adapted.adjustments } : {}),
      foods,
      targets: target,
      totals: sumMacros(foods),
      rationale: `${slot[0]}${slot.slice(1).toLowerCase()} targets ~${Math.round(
        split * 100,
      )}% of the day (~${target.calories} kcal, ~${target.proteinG}g protein): the Dominican dish ${
        adapted.dish.id
      }, portioned to the target.`,
    };
  });

  return {
    day: dayIndex,
    meals,
    targets: daily,
    totals: sumMacros(meals.flatMap((meal) => meal.foods)),
    rationale: {
      ruleVersion: MEAL_RULE_VERSION,
      summary: `Day ${dayIndex} targets ${daily.calories} kcal (${daily.proteinG}g protein, ${daily.carbsG}g carbs, ${daily.fatG}g fat) with Dominican dishes. Each dish keeps its ingredients and is portioned to its meal's share of the day; the day never falls below the target.`,
      safetyFloorApplied: false,
      notes: [],
    },
  };
}

export function generateDominicanMealPlan(input: MealPlanInput): MealPlan | null {
  const days = input.days ?? DEFAULT_DAYS;
  const excluded = new Set<AvoidTag>([
    ...restrictionsToAvoidTags(input.activeRestrictions),
    ...(input.excludeAvoidTags ?? []),
  ]);
  const excludedKeys = new Set<FoodId>(input.excludeCatalogKeys ?? []);
  const blockedTags = new Set<AvoidTag>([...excluded, ...NEVER_PLANNED_TAGS]);

  const byId = new Map(input.catalog.map((item) => [item.id, item]));
  const lookup = (id: FoodId): FoodItem | undefined => byId.get(id);
  const food = (id: FoodId): FoodItem => {
    const item = byId.get(id);
    if (!item) throw new Error('dish food missing from the catalog');
    return item;
  };
  const isBlocked = (id: FoodId): boolean => {
    const item = byId.get(id);
    return (
      item === undefined ||
      excludedKeys.has(id) ||
      (item.avoidFor ?? []).some((tag) => blockedTags.has(tag))
    );
  };

  // Each dish is adapted once: the exclusions are the same every day.
  const rotationBySlot = new Map<MealSlot, AdaptedDish[]>(
    MEAL_SLOTS.map((slot) => [
      slot,
      slotRotation(dishesForSlot(slot).map((dish) => adaptDish(dish, isBlocked, lookup))),
    ]),
  );

  const hash = seedHash(input.seed);
  const daily: MealMacros = {
    calories: input.nutritionPlan.calories,
    proteinG: input.nutritionPlan.proteinG,
    carbsG: input.nutritionPlan.carbsG,
    fatG: input.nutritionPlan.fatG,
  };

  const planDays: MealPlanDay[] = [];
  for (let d = 1; d <= days; d += 1) {
    const dishes: PlannedDish[] = [];
    for (const slot of MEAL_SLOTS) {
      const rotation = rotationBySlot.get(slot) ?? [];
      if (rotation.length === 0) return null;
      const adapted = pickDish(slot, d, hash, rotation);
      if (!adapted) return null;
      dishes.push({ slot, adapted });
    }
    const day = buildDay(d, dishes, daily, food);
    if (input.nutritionPlan.safetyFloorApplied) {
      day.rationale.safetyFloorApplied = true;
      day.rationale.notes = [
        'Your calorie target reflects a safe minimum floor (never below your BMR or a clinical minimum).',
      ];
    }
    planDays.push(day);
  }

  const excludedAvoidTags = [...excluded].sort();
  const excludedCatalogKeys = [...excludedKeys].sort();
  const hasExclusions = excludedAvoidTags.length > 0 || excludedCatalogKeys.length > 0;
  const exclusionClause = hasExclusions
    ? ' Your dietary preferences and allergies shape this plan: an excluded ingredient is swapped for one of the same kind, or left out when there is none.'
    : '';

  return {
    ruleVersion: MEAL_RULE_VERSION,
    catalogVersion: CATALOG_VERSION,
    goalType: input.goalType,
    targets: daily,
    excludedAvoidTags,
    excludedCatalogKeys,
    days: planDays,
    rationale: `Deterministic ${days}-day Dominican meal routine from your iCoach targets (${daily.calories} kcal; ${daily.proteinG}g protein, ${daily.carbsG}g carbs, ${daily.fatG}g fat). Each meal is a Dominican dish built from the bundled food catalog and portioned to the day's targets; identical inputs always produce the same plan.${exclusionClause} General guidance, not medical or dietary advice.`,
  };
}
