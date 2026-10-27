import type { GoalType } from '@/shared/infrastructure/database/types';

import {
  CATALOG_VERSION,
  type AvoidTag,
  type FoodId,
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
  excludedKeys: ReadonlySet<FoodId>,
  preferred: readonly FoodTag[],
): Pools {
  const ok = (f: FoodItem): boolean =>
    !excludedKeys.has(f.id) && !(f.avoidFor ?? []).some((a) => excluded.has(a));
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
  // meal-rules@1.2.0: a fourth food in lunch and dinner, so no single food
  // has to carry more than 40 % of the meal.
  LU_FAT: 157,
  DI_VEG: 163,
  SNACK: 149,
} as const;

function slotTarget(daily: MealMacros, s: number): MealMacros {
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

interface ScaledEntry {
  slot: MealSlot;
  food: FoodItem;
  mpf: MealPlanFood;
}

// ── realistic portions (meal-rules@1.2.0) ───────────────────────────────

/**
 * Energy-dense foods (oils, nuts, seeds, nut butters) never go above one
 * catalog serving — a standard portion such as 1 tbsp of oil, 28 g of nuts or
 * 2 tbsp of chia.
 */
export const ENERGY_DENSE_CATEGORIES: ReadonlySet<FoodItem['category']> = new Set([
  'fat_oil',
  'nuts_seeds',
]);
export const ENERGY_DENSE_MAX_SERVINGS = 1;
/** The snack is one food: at most two servings of it. */
export const SNACK_MAX_SERVINGS = 2;
/** In breakfast, lunch and dinner no single food carries more than this share of the meal's kcal. */
export const MEAL_SHARE_CAP = 0.4;
/** meal-rules@1.3.0: a snack smaller than this is raised to it, or dropped when the day has no room. */
export const SNACK_MIN_KCAL = 100;
/** The day's ceiling, as a multiple of its calorie target, when making room for the snack. */
export const DAY_KCAL_CEILING = 1.05;
/**
 * meal-rules@1.4.0: a vegetable never goes above three servings (about three
 * cups), in any pass — vegetables are never the day's filler.
 */
export const VEGETABLE_MAX_SERVINGS = 3;
const SHARED_SLOTS: readonly MealSlot[] = ['BREAKFAST', 'LUNCH', 'DINNER'];

/** The most servings any pass may give a food, whatever its meal. */
function foodCeiling(entry: ScaledEntry): number {
  return entry.food.category === 'vegetable' ? VEGETABLE_MAX_SERVINGS : MAX_SERVINGS;
}

function capOf(entry: ScaledEntry): number {
  const food = ENERGY_DENSE_CATEGORIES.has(entry.food.category)
    ? ENERGY_DENSE_MAX_SERVINGS
    : foodCeiling(entry);
  return entry.slot === 'SNACK' ? Math.min(food, SNACK_MAX_SERVINGS) : food;
}

const kcalOf = (entries: readonly ScaledEntry[]): number =>
  entries.reduce((sum, entry) => sum + entry.mpf.macros.calories, 0);

/**
 * Turns the day's scaled foods into realistic portions without ever leaving
 * the day below the engine's (safety-floored) calorie target:
 * 1. cap energy-dense foods and the snack;
 * 2. trim the food that carries more than 40 % of a main meal;
 * 3. top the day back up, first keeping every cap and share, then keeping
 *    only the caps, and as a last resort (a day that cannot reach its floor
 *    otherwise) the generic six-serving ceiling.
 * Every loop is bounded and every choice is by a fixed order: deterministic.
 */
function realisticPortions(scaled: ScaledEntry[], daily: MealMacros): void {
  const target = daily.calories;
  const set = (entry: ScaledEntry, servings: number) => {
    entry.mpf = scaleFood(entry.food, servings);
  };
  const meal = (slot: MealSlot) => scaled.filter((entry) => entry.slot === slot);

  for (const entry of scaled) if (entry.mpf.servings > capOf(entry)) set(entry, capOf(entry));

  const bumpTo = (entry: ScaledEntry, ceiling: number) =>
    Math.min(ceiling, r1(entry.mpf.servings + STEP));
  const shareAfterBump = (entry: ScaledEntry): number => {
    const bumped = Math.round(entry.food.calories * bumpTo(entry, capOf(entry)));
    const total = kcalOf(meal(entry.slot)) - entry.mpf.macros.calories + bumped;
    return total > 0 ? bumped / total : 1;
  };
  const share = (entry: ScaledEntry) =>
    entry.mpf.macros.calories / Math.max(1, kcalOf(meal(entry.slot)));

  // Rebalance each main meal at about its size: one step off the food over
  // 40 %, one step onto the smallest food that can take it, never below the
  // minimum serving.
  for (const slot of SHARED_SLOTS) {
    for (let guard = 0; guard < 400; guard += 1) {
      const entries = meal(slot);
      const dominant = entries.reduce((a, b) =>
        b.mpf.macros.calories > a.mpf.macros.calories ? b : a,
      );
      if (share(dominant) <= MEAL_SHARE_CAP) break;
      const grow = entries
        .filter(
          (entry) =>
            entry !== dominant &&
            entry.mpf.servings < capOf(entry) &&
            shareAfterBump(entry) <= MEAL_SHARE_CAP,
        )
        .reduce<ScaledEntry | null>((a, b) => (a === null || share(b) < share(a) ? b : a), null);
      const trimmed = r1(dominant.mpf.servings - STEP);
      const canTrim = trimmed >= MIN_SERVINGS;
      if (!grow && !canTrim) break;
      if (canTrim) set(dominant, trimmed);
      if (grow) set(grow, bumpTo(grow, capOf(grow)));
    }
  }

  // Every later step keeps the caps and the 40 % rule.
  const canBump = (entry: ScaledEntry) =>
    entry.mpf.servings < capOf(entry) &&
    (entry.slot === 'SNACK' || shareAfterBump(entry) <= MEAL_SHARE_CAP);
  const trimTo = (entry: ScaledEntry) => r1(entry.mpf.servings - STEP);
  const canTrim = (entry: ScaledEntry) => {
    const servings = trimTo(entry);
    if (servings < MIN_SERVINGS) return false;
    if (entry.slot === 'SNACK') return true;
    const trimmed = Math.round(entry.food.calories * servings);
    const entries = meal(entry.slot);
    const total = kcalOf(entries) - entry.mpf.macros.calories + trimmed;
    if (total <= 0) return false;
    return entries.every(
      (other) => (other === entry ? trimmed : other.mpf.macros.calories) / total <= MEAL_SHARE_CAP,
    );
  };
  const macroDeviation = (): Record<MacroGroup, number> => {
    const totals = sumMacros(scaled.map((entry) => entry.mpf));
    return {
      protein: (totals.proteinG - daily.proteinG) / Math.max(1, daily.proteinG),
      carb: (totals.carbsG - daily.carbsG) / Math.max(1, daily.carbsG),
      fat: (totals.fatG - daily.fatG) / Math.max(1, daily.fatG),
    };
  };
  const GROUPS: readonly MacroGroup[] = ['protein', 'carb', 'fat'];
  const MACRO_BAND = 0.05;

  // Macro balance: one step up on the macro furthest below its target, one
  // step down on the one furthest above, so the trims above do not leave the
  // day short of protein or long on carbohydrate.
  for (let guard = 0; guard < 400; guard += 1) {
    const deviation = macroDeviation();
    const low = GROUPS.reduce((a, b) => (deviation[b] < deviation[a] ? b : a));
    const high = GROUPS.reduce((a, b) => (deviation[b] > deviation[a] ? b : a));
    const raise =
      deviation[low] < -MACRO_BAND
        ? scaled
            .filter((entry) => groupOf(entry.food) === low && canBump(entry))
            .reduce<ScaledEntry | null>((a, b) => (a === null || share(b) < share(a) ? b : a), null)
        : null;
    const lower =
      deviation[high] > MACRO_BAND
        ? scaled
            .filter((entry) => groupOf(entry.food) === high && canTrim(entry))
            .reduce<ScaledEntry | null>((a, b) => (a === null || share(b) > share(a) ? b : a), null)
        : null;
    if (!raise && !lower) break;
    if (raise) set(raise, bumpTo(raise, capOf(raise)));
    if (lower) set(lower, trimTo(lower));
  }

  // Overshoot: trim back toward the target (never below it), from the meal
  // furthest above its part of the day. A held food (the snack once its
  // minimum is set) is never trimmed.
  const surplus = (slot: MealSlot) => {
    const goal = target * SLOT_SPLIT[slot];
    return (kcalOf(meal(slot)) - goal) / Math.max(1, goal);
  };
  const trimOvershoot = (held: ScaledEntry | null) => {
    for (let guard = 0; guard < 2000 && kcalOf(scaled) > target * 1.03; guard += 1) {
      const day = kcalOf(scaled);
      const candidates = scaled.filter(
        (entry) =>
          entry !== held &&
          canTrim(entry) &&
          day - entry.mpf.macros.calories + Math.round(entry.food.calories * trimTo(entry)) >=
            target,
      );
      if (candidates.length === 0) break;
      const next = candidates.reduce((a, b) => {
        const bySlot = surplus(b.slot) - surplus(a.slot);
        if (Math.abs(bySlot) > 1e-9) return bySlot > 0 ? b : a;
        return share(b) > share(a) ? b : a;
      });
      set(next, trimTo(next));
    }
  };
  const topUp = () => {
    const passes: { ceiling: (entry: ScaledEntry) => number; keepShare: boolean }[] = [
      { ceiling: capOf, keepShare: true },
      { ceiling: capOf, keepShare: false },
      { ceiling: foodCeiling, keepShare: false },
    ];
    for (const pass of passes) {
      for (let guard = 0; guard < 2000 && kcalOf(scaled) < target; guard += 1) {
        const candidates = scaled.filter(
          (entry) =>
            entry.mpf.servings < pass.ceiling(entry) &&
            (!pass.keepShare || entry.slot === 'SNACK' || shareAfterBump(entry) <= MEAL_SHARE_CAP),
        );
        if (candidates.length === 0) break;
        // 1. the meal furthest below its part of the day; 2. the macro furthest
        // below its target, so trimming never leaves the day short of protein;
        // 3. the food with the smallest share of its meal; 4. the pick order.
        const totals = sumMacros(scaled.map((entry) => entry.mpf));
        const deficit: Record<MacroGroup, number> = {
          protein: (daily.proteinG - totals.proteinG) / Math.max(1, daily.proteinG),
          carb: (daily.carbsG - totals.carbsG) / Math.max(1, daily.carbsG),
          fat: (daily.fatG - totals.fatG) / Math.max(1, daily.fatG),
        };
        const shortfall = (slot: MealSlot) => {
          const goal = target * SLOT_SPLIT[slot];
          return (goal - kcalOf(meal(slot))) / Math.max(1, goal);
        };
        // A macro clearly short of its target leads; otherwise the meal sizes do.
        const macroFirst = Math.max(deficit.protein, deficit.carb, deficit.fat) > MACRO_BAND;
        const next = candidates.reduce((a, b) => {
          const bySlot = shortfall(b.slot) - shortfall(a.slot);
          const byDeficit = deficit[groupOf(b.food)] - deficit[groupOf(a.food)];
          for (const difference of macroFirst ? [byDeficit, bySlot] : [bySlot, byDeficit]) {
            if (Math.abs(difference) > 1e-9) return difference > 0 ? b : a;
          }
          return share(b) < share(a) ? b : a;
        });
        set(next, bumpTo(next, pass.ceiling(next)));
      }
    }
  };

  trimOvershoot(null);
  topUp();

  // meal-rules@1.3.0: a snack is at least SNACK_MIN_KCAL. The snack is raised
  // to the smallest serving that reaches it and the main meals are trimmed
  // back toward the target around it. If the day still ends above its
  // ceiling (or the snack's cap cannot reach the minimum), the portions go
  // back to what they were, the snack is dropped and the main meals take its
  // calories.
  const snack = scaled.find((entry) => entry.slot === 'SNACK');
  if (snack && snack.mpf.macros.calories < SNACK_MIN_KCAL) {
    const servings = snackServingsFor(snack);
    const before = scaled.map((entry) => entry.mpf);
    if (servings !== null) {
      set(snack, servings);
      trimOvershoot(snack);
    }
    if (servings === null || kcalOf(scaled) > target * DAY_KCAL_CEILING) {
      scaled.forEach((entry, index) => {
        entry.mpf = before[index];
      });
      scaled.splice(scaled.indexOf(snack), 1);
      topUp();
    }
  }
}

/** The smallest serving (in steps, within the snack's cap) that reaches the snack minimum. */
function snackServingsFor(snack: ScaledEntry): number | null {
  const cap = capOf(snack);
  const reaches = (servings: number) =>
    Math.round(snack.food.calories * servings) >= SNACK_MIN_KCAL;
  // Same steps as every other bump (0.25, one decimal), then the cap itself.
  for (let servings = MIN_SERVINGS; servings < cap; servings = r1(servings + STEP)) {
    if (reaches(servings)) return servings;
  }
  return reaches(cap) ? cap : null;
}

function buildDay(dayIndex: number, pools: Pools, daily: MealMacros, hash: number): MealPlanDay {
  const picks: Pick[] = [
    { slot: 'BREAKFAST', food: pick(pools.breakfastProtein, hash, ROLE.BF_PROTEIN, dayIndex) },
    { slot: 'BREAKFAST', food: pick(pools.grain, hash, ROLE.BF_GRAIN, dayIndex) },
    { slot: 'BREAKFAST', food: pick(pools.fruit, hash, ROLE.BF_FRUIT, dayIndex) },
    { slot: 'LUNCH', food: pick(pools.proteinMain, hash, ROLE.LU_PROTEIN, dayIndex) },
    { slot: 'LUNCH', food: pick(pools.carbSide, hash, ROLE.LU_CARB, dayIndex) },
    { slot: 'LUNCH', food: pick(pools.veg, hash, ROLE.LU_VEG, dayIndex) },
    { slot: 'LUNCH', food: pick(pools.healthyFat, hash, ROLE.LU_FAT, dayIndex) },
    { slot: 'DINNER', food: pick(pools.proteinMain, hash, ROLE.DI_PROTEIN, dayIndex) },
    { slot: 'DINNER', food: pick(pools.carbSide, hash, ROLE.DI_CARB, dayIndex) },
    { slot: 'DINNER', food: pick(pools.veg, hash, ROLE.DI_VEG, dayIndex) },
    { slot: 'DINNER', food: pick(pools.healthyFat, hash, ROLE.DI_FAT, dayIndex) },
    { slot: 'SNACK', food: pick(pools.snack, hash, ROLE.SNACK, dayIndex) },
  ];

  const scales = solveDayScales(
    picks.map((p) => p.food),
    daily,
  );

  const scaled: ScaledEntry[] = picks.map((p) => ({
    slot: p.slot,
    food: p.food,
    mpf: scaleFood(p.food, scales[groupOf(p.food)]),
  }));

  realisticPortions(scaled, daily);

  // A dropped snack's share of the day goes to the main meals, in proportion.
  const slots = (['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as MealSlot[]).filter((slot) =>
    scaled.some((e) => e.slot === slot),
  );
  const planned = slots.reduce((sum, slot) => sum + SLOT_SPLIT[slot], 0);
  const meals: MealPlanMeal[] = slots.map((slot) => {
    const foods = scaled.filter((e) => e.slot === slot).map((e) => e.mpf);
    const split = SLOT_SPLIT[slot] / planned;
    const target = slotTarget(daily, split);
    const totals = sumMacros(foods);
    const names = foods.map((f) => f.name).join(', ');
    return {
      slot,
      foods,
      targets: target,
      totals,
      rationale: `${slot[0]}${slot.slice(1).toLowerCase()} targets ~${Math.round(
        split * 100,
      )}% of the day (~${target.calories} kcal, ~${target.proteinG}g protein): ${names}.`,
    };
  });

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

/**
 * meal-rules@1.1.0 (v8 Block 2, ADR-P040 D4): foods tagged with added sugar,
 * alcohol or frying stay loggable but are never proposed in a plan, whatever
 * the person excluded.
 */
export const NEVER_PLANNED_TAGS: readonly AvoidTag[] = ['added_sugar', 'alcohol', 'fried'];

export function generateMealPlan(input: MealPlanInput): MealPlan {
  const days = input.days ?? DEFAULT_DAYS;
  const preferred = GOAL_PREFERRED_TAGS[input.goalType];

  const excluded = new Set<AvoidTag>([
    ...restrictionsToAvoidTags(input.activeRestrictions),
    ...(input.excludeAvoidTags ?? []),
  ]);
  const excludedKeys = new Set<FoodId>(input.excludeCatalogKeys ?? []);

  // The person's exclusions are reported; the never-planned tags only filter.
  const pools = buildPools(
    input.catalog,
    new Set([...excluded, ...NEVER_PLANNED_TAGS]),
    excludedKeys,
    preferred,
  );
  const hash = seedHash(input.seed);

  const daily: MealMacros = {
    calories: input.nutritionPlan.calories,
    proteinG: input.nutritionPlan.proteinG,
    carbsG: input.nutritionPlan.carbsG,
    fatG: input.nutritionPlan.fatG,
  };

  const excludedAvoidTags = [...excluded].sort();
  const excludedCatalogKeys = [...excludedKeys].sort();

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

  // Only when exclusions are present is the exclusion clause appended, so a
  // plan with no dietary preferences keeps its exact pre-Slice-3 rationale.
  const hasExclusions = excludedAvoidTags.length > 0 || excludedCatalogKeys.length > 0;
  const exclusionClause = hasExclusions
    ? ` Your dietary preferences and allergies shape this deterministic plan: ${
        excludedAvoidTags.length > 0 ? `avoided categories [${excludedAvoidTags.join(', ')}]` : ''
      }${excludedAvoidTags.length > 0 && excludedCatalogKeys.length > 0 ? ' and ' : ''}${
        excludedCatalogKeys.length > 0 ? `excluded foods [${excludedCatalogKeys.join(', ')}]` : ''
      } were removed before selection.`
    : '';

  return {
    ruleVersion: MEAL_RULE_VERSION,
    catalogVersion: CATALOG_VERSION,
    goalType: input.goalType,
    targets: daily,
    excludedAvoidTags,
    excludedCatalogKeys,
    days: planDays,
    rationale: `Deterministic ${days}-day meal routine from your iCoach targets (${daily.calories} kcal; ${daily.proteinG}g protein, ${daily.carbsG}g carbs, ${daily.fatG}g fat) for ${GOAL_LABEL[input.goalType]}. Foods are chosen from the bundled catalog and portioned to approximate each day's targets; identical inputs always produce the same plan.${exclusionClause} General guidance, not medical or dietary advice.`,
  };
}
