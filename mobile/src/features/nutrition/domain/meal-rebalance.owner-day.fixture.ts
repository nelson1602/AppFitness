import type { MealMacros, MealPlanFood, MealSlot } from './meal-plan';
import type { RebalanceMeal } from './meal-rebalance';

/**
 * The v11 smoke-test day (2026-11-12, Play internal build 11), exactly as the
 * saved plan held it: a week generated for a 2.430 kcal target, kept "until
 * Monday" after the evaluation raised the target to 2.711 kcal (protein 128 g).
 * Catalogue lines only (no personal data). meal-rebalance@1.0.0 planned
 * 739 + 865 + 433 + 740 = 2.777 kcal here with nothing logged, and
 * 628 + 755 + 325 + 648 = 2.356 after Galleta de Soda (403 kcal): both above
 * what was left.
 */
const line = (
  foodId: string,
  name: string,
  servings: number,
  serving: MealPlanFood['serving'],
  macros: MealMacros,
): MealPlanFood => ({ foodId, name, servings, serving, macros });

const meal = (slot: MealSlot, dishId: string, foods: MealPlanFood[], totals: MealMacros) => ({
  slot,
  dishId,
  dishNameKey: `nutrition.dish.${dishId}`,
  foods,
  totals,
});

export const OWNER_DAY_TARGET_KCAL = 2711;
export const OWNER_DAY_PROTEIN_G = 128;
/** Galleta de Soda, one 100 g serving, logged in the Merienda outside the plan. */
export const GALLETA_DE_SODA: MealMacros = { calories: 403, proteinG: 8, carbsG: 75, fatG: 8 };

export const OWNER_DAY: readonly RebalanceMeal[] = [
  meal(
    'BREAKFAST',
    'mangu_huevo_aguacate',
    [
      line(
        'food.plantain_boiled',
        'Green plantain, boiled',
        2.2,
        { unit: 'g', amount: 220 },
        { calories: 264, proteinG: 2.2, carbsG: 63.8, fatG: 0 },
      ),
      line(
        'food.egg_whole',
        'Egg, whole',
        3.1,
        { unit: 'piece', amount: 3.1 },
        { calories: 220, proteinG: 18.6, carbsG: 1.6, fatG: 15.5 },
      ),
      line(
        'food.avocado_half',
        'Avocado, half',
        1,
        { unit: 'piece', amount: 1 },
        { calories: 127, proteinG: 1, carbsG: 6, fatG: 11 },
      ),
      line(
        'food.onion',
        'Onion, raw',
        0.9,
        { unit: 'cup', amount: 0.9 },
        { calories: 58, proteinG: 1.8, carbsG: 12.6, fatG: 0 },
      ),
    ],
    { calories: 669, proteinG: 23.6, carbsG: 84, fatG: 26.5 },
  ),
  meal(
    'LUNCH',
    'la_bandera',
    [
      line(
        'food.white_rice',
        'White rice, cooked',
        1.3,
        { unit: 'cup', amount: 1.3 },
        { calories: 255, proteinG: 5.2, carbsG: 58.5, fatG: 0 },
      ),
      line(
        'food.kidney_beans',
        'Kidney beans, cooked',
        0.8,
        { unit: 'cup', amount: 0.8 },
        { calories: 183, proteinG: 12, carbsG: 32, fatG: 0.8 },
      ),
      line(
        'food.beef_sirloin',
        'Beef sirloin, lean, cooked',
        1.5,
        { unit: 'g', amount: 150 },
        { calories: 255, proteinG: 43.5, carbsG: 0, fatG: 9 },
      ),
      line(
        'food.canola_oil',
        'Canola oil',
        0.5,
        { unit: 'tbsp', amount: 0.5 },
        { calories: 63, proteinG: 0, carbsG: 0, fatG: 7 },
      ),
      line(
        'food.lettuce_romaine',
        'Romaine lettuce',
        1.3,
        { unit: 'cup', amount: 2.6 },
        { calories: 21, proteinG: 1.3, carbsG: 3.9, fatG: 0 },
      ),
    ],
    { calories: 777, proteinG: 62, carbsG: 94.4, fatG: 16.8 },
  ),
  meal(
    'SNACK',
    'casabe_aguacate',
    [
      line(
        'food.casabe',
        'Cassava bread (casabe)',
        0.8,
        { unit: 'g', amount: 80 },
        { calories: 244, proteinG: 2.4, carbsG: 56.8, fatG: 0.8 },
      ),
      line(
        'food.avocado_half',
        'Avocado, half',
        0.8,
        { unit: 'piece', amount: 0.8 },
        { calories: 102, proteinG: 0.8, carbsG: 4.8, fatG: 8.8 },
      ),
    ],
    { calories: 346, proteinG: 3.2, carbsG: 61.6, fatG: 9.6 },
  ),
  meal(
    'DINNER',
    'pechuga_pure_yuca',
    [
      line(
        'food.chicken_breast',
        'Chicken breast, cooked',
        1.5,
        { unit: 'g', amount: 150 },
        { calories: 240, proteinG: 46.5, carbsG: 0, fatG: 6 },
      ),
      line(
        'food.cassava_cooked',
        'Cassava (yuca), cooked',
        1.3,
        { unit: 'g', amount: 130 },
        { calories: 248, proteinG: 1.3, carbsG: 52, fatG: 3.9 },
      ),
      line(
        'food.olive_oil',
        'Extra virgin olive oil',
        1,
        { unit: 'tbsp', amount: 1 },
        { calories: 126, proteinG: 0, carbsG: 0, fatG: 14 },
      ),
      line(
        'food.lettuce_romaine',
        'Romaine lettuce',
        3,
        { unit: 'cup', amount: 6 },
        { calories: 48, proteinG: 3, carbsG: 9, fatG: 0 },
      ),
    ],
    { calories: 662, proteinG: 50.8, carbsG: 61, fatG: 23.9 },
  ),
];
