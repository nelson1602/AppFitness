import type { MealMacros, MealSlot } from '../domain/meal-plan';
import {
  DAY_KCAL_CEILING,
  MEAL_SHARE_CAP,
  MIN_SERVINGS,
  SLOT_SPLIT,
  SNACK_MIN_KCAL,
  STEP,
  capOf,
  foodCeiling,
  groupOf,
  kcalOf,
  r1,
  scaleFood,
  sumMacros,
  type ScaledEntry,
} from './meal-portions';

/**
 * Portions for the Dominican dish plan (v8.1, meal-rules@1.5.0).
 *
 * The same rules as the food-based plan — energy-dense foods and the snack's
 * foods capped (1 and 2 servings), a vegetable never above 3 servings, no food
 * above 40 % of a main meal, a snack of at least 100 kcal (raised, or dropped
 * when the day has no room), the day never below the engine's target and
 * trimmed back toward it — but every choice keeps the DISH recognisable: when
 * a portion must grow or shrink, the food furthest from its share of the
 * recipe moves first, so a mangú stays mostly plantain and never turns into a
 * plate of onion. The food plan's macro-balancing pass is deliberately not
 * applied: a dish's macros are the dish's. Only a day clearly short of protein
 * (> 10 %) lets protein lead the top-up.
 *
 * Every loop is bounded and every tie falls back to dish order: deterministic.
 */

export interface DishPortionEntry extends ScaledEntry {
  /** This food's share of its dish's calories at the recipe's household portions (0–1). */
  share: number;
  /** True for the dish's protein line(s) (ADR-P040 D2 role `protein`). */
  proteinRole: boolean;
}

const PROTEIN_SHORT = 0.1;
/** The protein nudge never takes a food past twice its share of the recipe. */
const PROTEIN_NUDGE_MAX = 2;

export function dishPortions(entries: DishPortionEntry[], daily: MealMacros): void {
  const target = daily.calories;
  const set = (entry: DishPortionEntry, servings: number) => {
    entry.mpf = scaleFood(entry.food, servings);
  };
  const meal = (slot: MealSlot) => entries.filter((entry) => entry.slot === slot);
  const goal = (slot: MealSlot) => target * SLOT_SPLIT[slot];
  const isMain = (entry: DishPortionEntry) => entry.slot !== 'SNACK';
  const up = (entry: DishPortionEntry, ceiling: number) =>
    Math.min(ceiling, r1(entry.mpf.servings + STEP));
  const down = (entry: DishPortionEntry) => r1(entry.mpf.servings - STEP);
  const kcalAt = (entry: DishPortionEntry, servings: number) =>
    Math.round(entry.food.calories * servings);
  /** How far below its recipe share of the meal this food is (kcal); negative = above. */
  const deficit = (entry: DishPortionEntry) =>
    entry.share * kcalOf(meal(entry.slot)) - entry.mpf.macros.calories;
  const shareOf = (entry: DishPortionEntry) =>
    entry.mpf.macros.calories / Math.max(1, kcalOf(meal(entry.slot)));
  /** The food's share of its meal if it had `servings`. */
  const shareAt = (entry: DishPortionEntry, servings: number) => {
    const kcal = kcalAt(entry, servings);
    const total = kcalOf(meal(entry.slot)) - entry.mpf.macros.calories + kcal;
    return total > 0 ? kcal / total : 1;
  };
  /** After a trim the other foods' shares grow: every food must stay within the cap. */
  const sharesHoldAfterTrim = (entry: DishPortionEntry, servings: number) => {
    if (!isMain(entry)) return true;
    const kcal = kcalAt(entry, servings);
    const foods = meal(entry.slot);
    const total = kcalOf(foods) - entry.mpf.macros.calories + kcal;
    if (total <= 0) return false;
    return foods.every(
      (other) => (other === entry ? kcal : other.mpf.macros.calories) / total <= MEAL_SHARE_CAP,
    );
  };
  const best = (
    candidates: readonly DishPortionEntry[],
    keys: readonly ((entry: DishPortionEntry) => number)[],
  ): DishPortionEntry | null =>
    candidates.reduce<DishPortionEntry | null>((a, b) => {
      if (a === null) return b;
      for (const key of keys) {
        const difference = key(b) - key(a);
        if (Math.abs(difference) > 1e-9) return difference > 0 ? b : a;
      }
      return a;
    }, null);

  const proteinIsShort = () => {
    const totals = sumMacros(entries.map((entry) => entry.mpf));
    return (daily.proteinG - totals.proteinG) / Math.max(1, daily.proteinG) > PROTEIN_SHORT;
  };

  // 1. Caps: energy-dense foods, the snack's foods, vegetables.
  for (const entry of entries) if (entry.mpf.servings > capOf(entry)) set(entry, capOf(entry));

  // 2. No food above 40 % of a main meal: a step off the dominant food, a step
  //    onto the food furthest below its recipe share that can take it.
  for (const slot of ['BREAKFAST', 'LUNCH', 'DINNER'] as const) {
    for (let guard = 0; guard < 400; guard += 1) {
      const foods = meal(slot);
      if (foods.length === 0) break;
      const dominant = foods.reduce((a, b) =>
        b.mpf.macros.calories > a.mpf.macros.calories ? b : a,
      );
      if (shareOf(dominant) <= MEAL_SHARE_CAP) break;
      const grow = best(
        foods.filter(
          (entry) =>
            entry !== dominant &&
            entry.mpf.servings < capOf(entry) &&
            shareAt(entry, up(entry, capOf(entry))) <= MEAL_SHARE_CAP,
        ),
        [deficit],
      );
      const trimmed = down(dominant);
      const canTrim = trimmed >= MIN_SERVINGS;
      if (!grow && !canTrim) break;
      if (canTrim) set(dominant, trimmed);
      if (grow) set(grow, up(grow, capOf(grow)));
    }
  }

  // 2b. A day clearly short of protein (> 10 %): a step onto the dish protein
  //     furthest below its recipe share (never past twice that share), a step
  //     off the largest non-protein food of that same meal — within every cap
  //     and the 40 % rule.
  for (let guard = 0; guard < 400; guard += 1) {
    if (!proteinIsShort()) break;
    const raise = best(
      entries.filter(
        (entry) =>
          entry.proteinRole &&
          entry.mpf.servings < capOf(entry) &&
          kcalAt(entry, up(entry, capOf(entry))) <=
            PROTEIN_NUDGE_MAX * entry.share * kcalOf(meal(entry.slot)) &&
          (!isMain(entry) || shareAt(entry, up(entry, capOf(entry))) <= MEAL_SHARE_CAP),
      ),
      [deficit],
    );
    if (!raise) break;
    set(raise, up(raise, capOf(raise)));
    const lower = best(
      meal(raise.slot).filter(
        (entry) =>
          groupOf(entry.food) !== 'protein' &&
          down(entry) >= MIN_SERVINGS &&
          sharesHoldAfterTrim(entry, down(entry)),
      ),
      [shareOf],
    );
    if (lower) set(lower, down(lower));
  }

  // 3. Overshoot: back toward the target, never below it, from the meal
  //    furthest above its part of the day and the food most above its share.
  const surplus = (entry: DishPortionEntry) =>
    (kcalOf(meal(entry.slot)) - goal(entry.slot)) / Math.max(1, goal(entry.slot));
  const trimOvershoot = (held: ReadonlySet<DishPortionEntry>) => {
    for (let guard = 0; guard < 2000 && kcalOf(entries) > target * 1.03; guard += 1) {
      const day = kcalOf(entries);
      const keepProtein = proteinIsShort();
      const next = best(
        entries.filter((entry) => {
          const servings = down(entry);
          return (
            !held.has(entry) &&
            servings >= MIN_SERVINGS &&
            sharesHoldAfterTrim(entry, servings) &&
            day - entry.mpf.macros.calories + kcalAt(entry, servings) >= target
          );
        }),
        // A day short of protein trims a protein line only when nothing else can go.
        [
          (entry) => (keepProtein && entry.proteinRole ? -1 : 0),
          surplus,
          (entry) => -deficit(entry),
        ],
      );
      if (!next) break;
      set(next, down(next));
    }
  };

  // 4. Top-up to the target: first within every cap and the 40 % rule, then
  //    within the caps only, and as a last resort the generic ceiling.
  const topUp = () => {
    const passes: { ceiling: (entry: DishPortionEntry) => number; keepShare: boolean }[] = [
      { ceiling: capOf, keepShare: true },
      { ceiling: capOf, keepShare: false },
      { ceiling: foodCeiling, keepShare: false },
    ];
    for (const pass of passes) {
      for (let guard = 0; guard < 2000 && kcalOf(entries) < target; guard += 1) {
        const proteinShort = proteinIsShort();
        const next = best(
          entries.filter(
            (entry) =>
              entry.mpf.servings < pass.ceiling(entry) &&
              (!pass.keepShare ||
                !isMain(entry) ||
                shareAt(entry, up(entry, pass.ceiling(entry))) <= MEAL_SHARE_CAP),
          ),
          [
            (entry) => (proteinShort && entry.proteinRole ? 1 : 0),
            (entry) => -surplus(entry),
            deficit,
          ],
        );
        if (!next) break;
        set(next, up(next, pass.ceiling(next)));
      }
    }
  };

  trimOvershoot(new Set());
  topUp();

  // 5. The snack minimum (meal-rules@1.3.0), for a snack of one or more foods:
  //    raised to the minimum within its caps, the main meals trimmed back
  //    around it; if it cannot get there, or the day ends above its ceiling,
  //    the portions are restored, the snack is dropped and the main meals take
  //    its calories.
  const snacks = entries.filter((entry) => entry.slot === 'SNACK');
  if (snacks.length > 0 && kcalOf(snacks) < SNACK_MIN_KCAL) {
    const before = entries.map((entry) => entry.mpf);
    let reached = false;
    for (let guard = 0; guard < 200; guard += 1) {
      if (kcalOf(snacks) >= SNACK_MIN_KCAL) {
        reached = true;
        break;
      }
      const grow = best(
        snacks.filter((entry) => entry.mpf.servings < capOf(entry)),
        [deficit],
      );
      if (!grow) break;
      set(grow, up(grow, capOf(grow)));
    }
    if (reached) trimOvershoot(new Set(snacks));
    if (!reached || kcalOf(entries) > target * DAY_KCAL_CEILING) {
      entries.forEach((entry, index) => {
        entry.mpf = before[index];
      });
      for (const snack of snacks) entries.splice(entries.indexOf(snack), 1);
      topUp();
    }
  }
}
