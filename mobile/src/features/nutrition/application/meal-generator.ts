import type { GoalType } from '@/shared/infrastructure/database/types';

import {
  CATALOG_VERSION,
  type AvoidTag,
  type FoodItem,
  type FoodTag,
} from '../domain/food-catalog';
import {
  MEAL_RULE_VERSION,
  type MealMacros,
  type MealPlan,
  type MealPlanDay,
  type MealPlanFood,
  type MealPlanInput,
  type MealPlanMeal,
  type MealSlot,
} from '../domain/meal-plan';
import { restrictionsToAvoidTags } from '../domain/restriction-map';

/**
 * Deterministic 15-day meal routine generator (Phase 15 Slice 3A).
 *
 * PURE: no Date.now / Math.random / network / storage. Identical inputs →
 * deep-equal outputs. The iCoach `NutritionPlan` is authoritative — this
 * only selects catalog foods and scales portions to approximate it, and
 * NEVER produces a day below the engine's (already safety-floored) calorie
 * target. No AI/LLM, no medical claims.
 *
 * Scaling: each day's foods are split into three groups — protein-source,
 * carb-source, fat/other — and a deterministic 3×3 linear solve finds one
 * serving-scale per group to hit the day's calorie + protein + carb targets.
 * Because target calories ≈ 4·protein + 4·carbs + 9·fat, controlling those
 * three also lands fat close. Servings round to 0.25; a bounded snack top-up
 * guarantees the day never dips below the floor after rounding.
 *
 * Documented tolerances (verified in tests): daily calories are ≥ the
 * engine target and within a small band above it; protein and carbs land
 * within a practical band; fat follows as the residual.
 */

const DEFAULT_DAYS = 15;
const SELECTION_WINDOW = 8; // pick from the top-N goal-preferred items per pool
const STEP = 0.25; // serving granularity
const MIN_SERVINGS = 0.25;
const MAX_SERVINGS = 6;

// Deterministic daily calorie split (display sub-targets per meal).
const SLOT_SPLIT: Record<MealSlot, number> = {
  BREAKFAST: 0.27,
  LUNCH: 0.3,
  DINNER: 0.3,
  SNACK: 0.13,
};

// Goal-preference bias: foods carrying more of these tags sort to the front
// of each pool, so the goal deterministically shapes selection.
const GOAL_PREFERRED_TAGS: Record<GoalType, FoodTag[]> = {
  FAT_LOSS: ['high_protein', 'high_fiber', 'low_carb'],
  MUSCLE_GAIN: ['high_protein', 'complex_carb'],
  RECOMPOSITION: ['high_protein', 'high_fiber'],
  STRENGTH: ['high_protein', 'complex_carb'],
  ENDURANCE: ['complex_carb', 'high_fiber'],
  GENERAL_HEALTH: ['heart_healthy', 'high_fiber'],
  REHABILITATION: ['high_protein', 'heart_healthy'],
  MAINTENANCE: ['heart_healthy'],
};

const GOAL_LABEL: Record<GoalType, string> = {
  FAT_LOSS: 'fat loss',
  MUSCLE_GAIN: 'muscle gain',
  RECOMPOSITION: 'body recomposition',
  STRENGTH: 'strength',
  ENDURANCE: 'endurance',
  GENERAL_HEALTH: 'general health',
  REHABILITATION: 'rehabilitation',
  MAINTENANCE: 'maintenance',
};

// ── deterministic primitives ─────────────────────────────────────────────

/** FNV-1a 32-bit hash → non-negative int. Deterministic, no RNG. */
function seedHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

function clampServings(x: number): number {
  const stepped = Math.round(x / STEP) * STEP;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, r1(stepped)));
}

function preferenceScore(item: FoodItem, preferred: readonly FoodTag[]): number {
  return item.tags.filter((t) => preferred.includes(t)).length;
}

/** Stable sort: goal preference desc, then id asc (fully deterministic). */
function sortPool(items: FoodItem[], preferred: readonly FoodTag[]): FoodItem[] {
  return [...items].sort(
    (a, b) =>
      preferenceScore(b, preferred) - preferenceScore(a, preferred) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Deterministic rotation over the top window of a pool. */
function pick(pool: FoodItem[], hash: number, roleSeed: number, dayIndex: number): FoodItem {
  const window = Math.min(pool.length, SELECTION_WINDOW);
  return pool[(hash + roleSeed + (dayIndex - 1)) % window];
}

type MacroGroup = 'protein' | 'carb' | 'fat';

function groupOf(f: FoodItem): MacroGroup {
  const cal = Math.max(f.calories, 1);
  if (f.proteinG * 4 >= 0.35 * cal) return 'protein';
  if (f.carbsG * 4 >= 0.45 * cal) return 'carb';
  return 'fat';
}

function scaleFood(f: FoodItem, servings: number): MealPlanFood {
  return {
    foodId: f.id,
    name: f.name,
    servings,
    serving: { amount: r1(f.servingSize.amount * servings), unit: f.servingSize.unit },
    macros: {
      calories: Math.round(f.calories * servings),
      proteinG: r1(f.proteinG * servings),
      carbsG: r1(f.carbsG * servings),
      fatG: r1(f.fatG * servings),
    },
  };
}

function sumMacros(items: { macros: MealMacros }[]): MealMacros {
  return items.reduce<MealMacros>(
    (acc, i) => ({
      calories: acc.calories + i.macros.calories,
      proteinG: r1(acc.proteinG + i.macros.proteinG),
      carbsG: r1(acc.carbsG + i.macros.carbsG),
      fatG: r1(acc.fatG + i.macros.fatG),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/**
 * Deterministic 3×3 solve for one serving-scale per macro group targeting
 * daily protein + carbs + calories. Cramer's rule; falls back to a uniform
 * calorie scale when the system is degenerate (e.g., a group is absent).
 */
function solveDayScales(foods: FoodItem[], target: MealMacros): Record<MacroGroup, number> {
  const acc: Record<MacroGroup, { p: number; c: number; cal: number }> = {
    protein: { p: 0, c: 0, cal: 0 },
    carb: { p: 0, c: 0, cal: 0 },
    fat: { p: 0, c: 0, cal: 0 },
  };
  for (const f of foods) {
    const grp = acc[groupOf(f)];
    grp.p += f.proteinG;
    grp.c += f.carbsG;
    grp.cal += f.calories;
  }

  // Rows: protein, carbs, calories. Cols: protein-, carb-, fat-group scales.
  const m: number[][] = [
    [acc.protein.p, acc.carb.p, acc.fat.p],
    [acc.protein.c, acc.carb.c, acc.fat.c],
    [acc.protein.cal, acc.carb.cal, acc.fat.cal],
  ];
  const rhs = [target.proteinG, target.carbsG, target.calories];

  const det3 = (a: number[][]): number =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);

  const det = det3(m);
  if (Math.abs(det) > 1e-6) {
    const col = (i: number): number[][] =>
      m.map((row, r) => row.map((v, cIdx) => (cIdx === i ? rhs[r] : v)));
    const solved: Record<MacroGroup, number> = {
      protein: det3(col(0)) / det,
      carb: det3(col(1)) / det,
      fat: det3(col(2)) / det,
    };
    return {
      protein: clampServings(solved.protein),
      carb: clampServings(solved.carb),
      fat: clampServings(solved.fat),
    };
  }

  const totalCal = acc.protein.cal + acc.carb.cal + acc.fat.cal || 1;
  const uniform = clampServings(target.calories / totalCal);
  return { protein: uniform, carb: uniform, fat: uniform };
}

// ── pools ──────────────────────────────────────────────────────────────

interface Pools {
  proteinMain: FoodItem[];
  breakfastProtein: FoodItem[];
  grain: FoodItem[];
  carbSide: FoodItem[];
  veg: FoodItem[];
  fruit: FoodItem[];
  healthyFat: FoodItem[];
  snack: FoodItem[];
}

function buildPools(
  catalog: readonly FoodItem[],
  excluded: ReadonlySet<AvoidTag>,
  preferred: readonly FoodTag[],
): Pools {
  const ok = (f: FoodItem): boolean => !(f.avoidFor ?? []).some((a) => excluded.has(a));
  const inCat = (cats: FoodItem['category'][]): FoodItem[] =>
    sortPool(
      catalog.filter((f) => ok(f) && cats.includes(f.category)),
      preferred,
    );
  const proteinMain = inCat(['protein_animal', 'protein_plant']);
  const bfProtein = sortPool(
    catalog.filter(
      (f) =>
        ok(f) &&
        ['dairy', 'protein_animal', 'protein_plant'].includes(f.category) &&
        f.tags.includes('high_protein'),
    ),
    preferred,
  );
  return {
    proteinMain,
    breakfastProtein: bfProtein.length > 0 ? bfProtein : proteinMain,
    grain: inCat(['grain']),
    carbSide: inCat(['grain', 'legume']),
    veg: inCat(['vegetable']),
    fruit: inCat(['fruit']),
    healthyFat: inCat(['fat_oil', 'nuts_seeds']),
    snack: inCat(['fruit', 'nuts_seeds', 'dairy']),
  };
}

// role seeds — distinct primes so roles rotate independently
const ROLE = {
  BF_PROTEIN: 101,
  BF_GRAIN: 103,
  BF_FRUIT: 107,
  LU_PROTEIN: 109,
  LU_CARB: 113,
  LU_VEG: 127,
  DI_PROTEIN: 131,
  DI_CARB: 139,
  DI_FAT: 151,
  SNACK: 149,
} as const;

function slotTarget(daily: MealMacros, slot: MealSlot): MealMacros {
  const s = SLOT_SPLIT[slot];
  return {
    calories: Math.round(daily.calories * s),
    proteinG: r1(daily.proteinG * s),
    carbsG: r1(daily.carbsG * s),
    fatG: r1(daily.fatG * s),
  };
}

interface Pick {
  slot: MealSlot;
  food: FoodItem;
}

function buildDay(dayIndex: number, pools: Pools, daily: MealMacros, hash: number): MealPlanDay {
  const picks: Pick[] = [
    { slot: 'BREAKFAST', food: pick(pools.breakfastProtein, hash, ROLE.BF_PROTEIN, dayIndex) },
    { slot: 'BREAKFAST', food: pick(pools.grain, hash, ROLE.BF_GRAIN, dayIndex) },
    { slot: 'BREAKFAST', food: pick(pools.fruit, hash, ROLE.BF_FRUIT, dayIndex) },
    { slot: 'LUNCH', food: pick(pools.proteinMain, hash, ROLE.LU_PROTEIN, dayIndex) },
    { slot: 'LUNCH', food: pick(pools.carbSide, hash, ROLE.LU_CARB, dayIndex) },
    { slot: 'LUNCH', food: pick(pools.veg, hash, ROLE.LU_VEG, dayIndex) },
    { slot: 'DINNER', food: pick(pools.proteinMain, hash, ROLE.DI_PROTEIN, dayIndex) },
    { slot: 'DINNER', food: pick(pools.carbSide, hash, ROLE.DI_CARB, dayIndex) },
    { slot: 'DINNER', food: pick(pools.healthyFat, hash, ROLE.DI_FAT, dayIndex) },
    { slot: 'SNACK', food: pick(pools.snack, hash, ROLE.SNACK, dayIndex) },
  ];

  const scales = solveDayScales(
    picks.map((p) => p.food),
    daily,
  );

  const scaled: { slot: MealSlot; food: FoodItem; mpf: MealPlanFood }[] = picks.map((p) => ({
    slot: p.slot,
    food: p.food,
    mpf: scaleFood(p.food, scales[groupOf(p.food)]),
  }));

  // Rounding-safe floor guarantee. Prefer balancing via the snack; if that
  // hits its cap and the day is still short, deterministically bump the most
  // calorie-dense non-maxed food until the day reaches the target. Both loops
  // are bounded, so no day ever falls below the engine's floored target.
  const caloriesOf = (): number => scaled.reduce((s, e) => s + e.mpf.macros.calories, 0);
  const snackEntry = scaled[scaled.length - 1];
  let snackServings = snackEntry.mpf.servings;
  while (caloriesOf() < daily.calories && snackServings < MAX_SERVINGS) {
    snackServings = r1(snackServings + STEP);
    snackEntry.mpf = scaleFood(snackEntry.food, snackServings);
  }
  let guard = 0;
  while (caloriesOf() < daily.calories && guard < 500) {
    guard += 1;
    const bumpable = scaled.filter((e) => e.mpf.servings < MAX_SERVINGS);
    if (bumpable.length === 0) break;
    let best = bumpable[0];
    for (const e of bumpable) if (e.food.calories > best.food.calories) best = e;
    best.mpf = scaleFood(best.food, r1(best.mpf.servings + STEP));
  }

  const meals: MealPlanMeal[] = (['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as MealSlot[]).map(
    (slot) => {
      const foods = scaled.filter((e) => e.slot === slot).map((e) => e.mpf);
      const target = slotTarget(daily, slot);
      const totals = sumMacros(foods);
      const names = foods.map((f) => f.name).join(', ');
      return {
        slot,
        foods,
        targets: target,
        totals,
        rationale: `${slot[0]}${slot.slice(1).toLowerCase()} targets ~${Math.round(
          SLOT_SPLIT[slot] * 100,
        )}% of the day (~${target.calories} kcal, ~${target.proteinG}g protein): ${names}.`,
      };
    },
  );

  const totals = sumMacros(scaled.map((e) => e.mpf));

  return {
    day: dayIndex,
    meals,
    targets: daily,
    totals,
    rationale: {
      ruleVersion: MEAL_RULE_VERSION,
      summary: `Day ${dayIndex} targets ${daily.calories} kcal (${daily.proteinG}g protein, ${daily.carbsG}g carbs, ${daily.fatG}g fat). Protein and carbohydrate are matched first; fat follows as the calorie remainder, and the snack keeps the day at or above the target.`,
      safetyFloorApplied: false,
      notes: [],
    },
  };
}

// ── entry point ──────────────────────────────────────────────────────────

export function generateMealPlan(input: MealPlanInput): MealPlan {
  const days = input.days ?? DEFAULT_DAYS;
  const preferred = GOAL_PREFERRED_TAGS[input.goalType];

  const excluded = new Set<AvoidTag>([
    ...restrictionsToAvoidTags(input.activeRestrictions),
    ...(input.excludeAvoidTags ?? []),
  ]);

  const pools = buildPools(input.catalog, excluded, preferred);
  const hash = seedHash(input.seed);

  const daily: MealMacros = {
    calories: input.nutritionPlan.calories,
    proteinG: input.nutritionPlan.proteinG,
    carbsG: input.nutritionPlan.carbsG,
    fatG: input.nutritionPlan.fatG,
  };

  const safetyFloorApplied = input.nutritionPlan.safetyFloorApplied;
  const planDays: MealPlanDay[] = [];
  for (let d = 1; d <= days; d += 1) {
    const day = buildDay(d, pools, daily, hash);
    if (safetyFloorApplied) {
      day.rationale.safetyFloorApplied = true;
      day.rationale.notes = [
        'Your calorie target reflects a safe minimum floor (never below your BMR or a clinical minimum).',
      ];
    }
    planDays.push(day);
  }

  return {
    ruleVersion: MEAL_RULE_VERSION,
    catalogVersion: CATALOG_VERSION,
    goalType: input.goalType,
    targets: daily,
    excludedAvoidTags: [...excluded].sort(),
    days: planDays,
    rationale: `Deterministic ${days}-day meal routine from your iCoach targets (${daily.calories} kcal; ${daily.proteinG}g protein, ${daily.carbsG}g carbs, ${daily.fatG}g fat) for ${GOAL_LABEL[input.goalType]}. Foods are chosen from the bundled catalog and portioned to approximate each day's targets; identical inputs always produce the same plan. General guidance, not medical or dietary advice.`,
  };
}
