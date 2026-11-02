import type { AvoidTag, FoodItem } from '../domain/food-catalog';
import type { MealMacros, MealPlanFood, MealSlot } from '../domain/meal-plan';

/**
 * Shared portion rules of the deterministic meal plans (v8 meal-rules), used
 * by the generic food-based generator and by the Dominican dish generator
 * (v8.1, meal-rules@1.5.0). Moved verbatim from meal-generator.ts so both
 * plans keep exactly the same caps, the 40 % share, the snack minimum and the
 * vegetable ceiling. PURE: no clock, no randomness, no I/O.
 */

export const STEP = 0.25; // serving granularity
export const MIN_SERVINGS = 0.25;
export const MAX_SERVINGS = 6;

// Deterministic daily calorie split (display sub-targets per meal).
export const SLOT_SPLIT: Record<MealSlot, number> = {
  BREAKFAST: 0.27,
  LUNCH: 0.3,
  DINNER: 0.3,
  SNACK: 0.13,
};

// ── deterministic primitives ─────────────────────────────────────────────

/** FNV-1a 32-bit hash → non-negative int. Deterministic, no RNG. */
export function seedHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const r1 = (n: number): number => Math.round(n * 10) / 10;

export function clampServings(x: number): number {
  const stepped = Math.round(x / STEP) * STEP;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, r1(stepped)));
}

export type MacroGroup = 'protein' | 'carb' | 'fat';

export function groupOf(f: FoodItem): MacroGroup {
  const cal = Math.max(f.calories, 1);
  if (f.proteinG * 4 >= 0.35 * cal) return 'protein';
  if (f.carbsG * 4 >= 0.45 * cal) return 'carb';
  return 'fat';
}

export function scaleFood(f: FoodItem, servings: number): MealPlanFood {
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

export function sumMacros(items: { macros: MealMacros }[]): MealMacros {
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

export function slotTarget(daily: MealMacros, s: number): MealMacros {
  return {
    calories: Math.round(daily.calories * s),
    proteinG: r1(daily.proteinG * s),
    carbsG: r1(daily.carbsG * s),
    fatG: r1(daily.fatG * s),
  };
}

export interface ScaledEntry {
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
export function foodCeiling(entry: ScaledEntry): number {
  return entry.food.category === 'vegetable' ? VEGETABLE_MAX_SERVINGS : MAX_SERVINGS;
}

export function capOf(entry: ScaledEntry): number {
  const food = ENERGY_DENSE_CATEGORIES.has(entry.food.category)
    ? ENERGY_DENSE_MAX_SERVINGS
    : foodCeiling(entry);
  return entry.slot === 'SNACK' ? Math.min(food, SNACK_MAX_SERVINGS) : food;
}

export const kcalOf = (entries: readonly ScaledEntry[]): number =>
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
export function realisticPortions(scaled: ScaledEntry[], daily: MealMacros): void {
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

/**
 * meal-rules@1.1.0 (v8 Block 2, ADR-P040 D4): foods tagged with added sugar,
 * alcohol or frying stay loggable but are never proposed in a plan, whatever
 * the person excluded.
 */
export const NEVER_PLANNED_TAGS: readonly AvoidTag[] = ['added_sugar', 'alcohol', 'fried'];
