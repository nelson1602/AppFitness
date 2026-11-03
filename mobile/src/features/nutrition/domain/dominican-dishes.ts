import type { AvoidTag, FoodId, FoodItem } from './food-catalog';
import type { MealAdjustment, MealSlot } from './meal-plan';

/**
 * The Dominican dish catalogue (v8.1, meal-rules@1.6.0; ADR-P040 D2/D3).
 *
 * A dish is a versioned recipe of bundled-catalog foods in common household
 * portions — "Mangú con huevo y aguacate" is 200 g of boiled green plantain,
 * two eggs, half an avocado and a little onion. Nothing here is authored
 * nutrition: a dish's calories and macros are always COMPUTED from the food
 * catalog (`dishMacros`), and its allergen / avoid tags are DERIVED from its
 * foods (`dishAvoidTags`), so the catalog stays the single source of truth and
 * the ADR-P013 A1 "no synthesized foods" rule holds (a dish is a plan grouping,
 * not a catalog food).
 *
 * It starts from the design prototype's `MEALS` (docs/design) and reuses the
 * Dominican foods seeded by ADR-P040 D10 (plantain, cassava, yam, yautía,
 * pigeon peas, conch, clams, lobster) and the everyday staples added in
 * food-catalog@1.15.0 (casabe, queso blanco, cinnamon). Prototype ingredients
 * the catalog still does not carry are represented by the closest catalog food
 * and the dish is named for what it really contains (see the notes on each
 * dish). Fried foods, added sugar and alcohol never appear (NEVER_PLANNED_TAGS).
 *
 * `everyday` marks the dishes a Dominican table eats most days — mangú, moro,
 * la bandera, sancocho, locrio, yuca, casabe, queso blanco, avena con canela,
 * habichuelas guisadas (owner fix list, v8.1 round 2). The plan serves them on
 * three days out of four; the rest of the slot fills the fourth day for
 * variety. Display names are i18n keys `nutrition.dish.<id>` (ES/EN); food
 * names come from the catalog's own localization. PURE data and functions.
 */

/** Bump on ANY change to a dish, a line, a portion, a pool or the order. */
export const DISH_CATALOG_VERSION = 'do-dishes@1.1.0';

/** The country whose plan is built from these dishes. */
export const DISH_PLAN_COUNTRY = 'DO';

/** ADR-P040 D2 — the role an ingredient plays, which decides its substitutes. */
export type DishRole = 'protein' | 'carb' | 'fruit' | 'dairy' | 'fat' | 'vegetable';

export interface DishLine {
  food: FoodId;
  /** Household portion in catalog servings (e.g. egg 2 = two eggs, plantain 2 = 200 g). */
  servings: number;
  role: DishRole;
  /** Preferred same-role substitutes, tried before the role's pool (e.g. yogurt → soy yogurt). */
  alternatives?: readonly FoodId[];
  /**
   * A seasoning (lemon juice, garlic): a fixed amount that is never scaled to
   * the target and never substituted — left out when excluded.
   */
  seasoning?: true;
}

export interface Dish {
  /** Stable id; also the i18n key suffix (`nutrition.dish.<id>`). */
  id: string;
  slot: MealSlot;
  lines: readonly DishLine[];
  /** An everyday Dominican dish, served three days out of four (see the header). */
  everyday?: true;
}

export const dishNameKey = (dishId: string): string => `nutrition.dish.${dishId}`;

const line = (
  food: string,
  servings: number,
  role: DishRole,
  extra: Pick<DishLine, 'alternatives' | 'seasoning'> = {},
): DishLine => ({ food: `food.${food}`, servings, role, ...extra });

const seasoning = (food: string, servings: number): DishLine =>
  line(food, servings, 'vegetable', { seasoning: true });

// Preferred substitutes shared by several dishes.
const YOGURT_ALTERNATIVES = ['food.soy_yogurt_plain'] as const;
const MILK_ALTERNATIVES = ['food.soy_milk_unsweet', 'food.oat_milk_unsweet'] as const;
const NUT_ALTERNATIVES = ['food.pumpkin_seeds', 'food.sunflower_seeds'] as const;
const NUT_BUTTER_ALTERNATIVES = ['food.sunflower_butter'] as const;
const BREAD_ALTERNATIVES = ['food.corn_tortilla'] as const;
const BEAN_ALTERNATIVES = ['food.pigeon_peas', 'food.black_beans', 'food.lentils_brown'] as const;
// Mozzarella keeps a cheese in a low-sodium plan; tofu covers lactose.
const QUESO_ALTERNATIVES = ['food.mozzarella_part_skim', 'food.tofu_firm'] as const;
// Casabe is cassava bread: boiled cassava is the same root without the salt.
const CASABE_ALTERNATIVES = ['food.cassava_cooked'] as const;

/**
 * ADR-P040 D3 — the versioned same-role pools: an excluded ingredient becomes
 * the first food here that is not excluded and not already in the dish (after
 * the line's own `alternatives`). None left → the ingredient is left out.
 */
export const DISH_SWAP_POOLS: Readonly<Record<DishRole, readonly FoodId[]>> = {
  protein: [
    'food.chicken_breast',
    'food.turkey_breast',
    'food.cod',
    'food.egg_whole',
    'food.tuna_canned_water',
    'food.tofu_firm',
  ],
  carb: [
    'food.white_rice',
    'food.sweet_potato',
    'food.cassava_cooked',
    'food.plantain_boiled',
    'food.yam_cooked',
    'food.potato_baked',
    'food.quinoa',
  ],
  fruit: [
    'food.banana',
    'food.apple',
    'food.pineapple',
    'food.papaya',
    'food.mango',
    'food.strawberries',
  ],
  dairy: ['food.soy_milk_unsweet', 'food.oat_milk_unsweet', 'food.coconut_milk_beverage'],
  fat: ['food.olive_oil', 'food.avocado_half', 'food.canola_oil', 'food.chia_seeds'],
  vegetable: [
    'food.lettuce_romaine',
    'food.tomato',
    'food.cucumber',
    'food.broccoli',
    'food.carrots',
    'food.spinach',
  ],
};

/** The catalogue, in rotation order per slot. */
export const DOMINICAN_DISHES: readonly Dish[] = [
  // ── Desayuno ────────────────────────────────────────────────────────────
  {
    id: 'mangu_huevo_aguacate',
    slot: 'BREAKFAST',
    everyday: true,
    lines: [
      line('plantain_boiled', 2, 'carb'),
      line('egg_whole', 2, 'protein'),
      line('avocado_half', 0.75, 'fat'),
      line('onion', 0.25, 'vegetable'),
    ],
  },
  {
    // Prototype "Avena con guineo y canela"; its honey is left out (added
    // sugar is never planned).
    id: 'avena_guineo_canela',
    slot: 'BREAKFAST',
    everyday: true,
    lines: [
      line('oats_rolled', 1.25, 'carb', { alternatives: ['food.quinoa'] }),
      line('milk_skim', 0.5, 'dairy', { alternatives: MILK_ALTERNATIVES }),
      line('banana', 1, 'fruit'),
      line('chia_seeds', 0.5, 'fat'),
      seasoning('cinnamon_ground', 1),
    ],
  },
  {
    id: 'pan_queso_blanco_tomate',
    slot: 'BREAKFAST',
    everyday: true,
    lines: [
      line('whole_wheat_bread', 2, 'carb', { alternatives: BREAD_ALTERNATIVES }),
      line('queso_blanco', 0.4, 'protein', { alternatives: QUESO_ALTERNATIVES }),
      line('tomato', 0.5, 'vegetable'),
      line('avocado_half', 0.25, 'fat'),
    ],
  },
  {
    id: 'batata_huevos_revueltos',
    slot: 'BREAKFAST',
    lines: [
      line('sweet_potato', 1, 'carb'),
      line('egg_whole', 2, 'protein'),
      line('egg_white', 2, 'protein'),
      line('bell_pepper_green', 0.33, 'vegetable'),
      line('avocado_half', 0.33, 'fat'),
    ],
  },
  {
    // Prototype honey left out (added sugar is never planned).
    id: 'yogur_fresas_almendras',
    slot: 'BREAKFAST',
    lines: [
      line('greek_yogurt_nonfat', 1, 'dairy', { alternatives: YOGURT_ALTERNATIVES }),
      line('strawberries', 0.75, 'fruit'),
      line('oats_rolled', 0.5, 'carb', { alternatives: ['food.quinoa'] }),
      line('almonds', 0.5, 'fat', { alternatives: NUT_ALTERNATIVES }),
    ],
  },
  {
    id: 'yuca_huevo_aguacate',
    slot: 'BREAKFAST',
    everyday: true,
    lines: [
      line('cassava_cooked', 1.25, 'carb'),
      line('egg_whole', 2, 'protein'),
      line('avocado_half', 0.5, 'fat'),
      line('onion', 0.25, 'vegetable'),
    ],
  },
  {
    // Queso blanco is mostly fat (24 g against 20 g protein per 100 g): where an
    // egg carries the protein, the cheese takes the fat role, so the protein
    // top-up grows the egg and not the cheese.
    id: 'mangu_huevo_queso_blanco',
    slot: 'BREAKFAST',
    everyday: true,
    lines: [
      line('plantain_boiled', 2, 'carb'),
      line('egg_whole', 1, 'protein'),
      line('queso_blanco', 0.5, 'fat', { alternatives: QUESO_ALTERNATIVES }),
      line('onion', 0.25, 'vegetable'),
    ],
  },
  {
    id: 'tortilla_espinaca_pan',
    slot: 'BREAKFAST',
    lines: [
      line('egg_whole', 2, 'protein'),
      line('egg_white', 2, 'protein'),
      line('spinach', 0.5, 'vegetable'),
      line('whole_wheat_bread', 2, 'carb', { alternatives: BREAD_ALTERNATIVES }),
      line('olive_oil', 0.25, 'fat'),
    ],
  },
  {
    id: 'name_huevo_tomate',
    slot: 'BREAKFAST',
    lines: [
      line('yam_cooked', 2, 'carb'),
      line('egg_whole', 2, 'protein'),
      line('tomato', 0.5, 'vegetable'),
      line('avocado_half', 0.5, 'fat'),
    ],
  },
  {
    id: 'yautia_huevo_cebolla',
    slot: 'BREAKFAST',
    lines: [
      line('yautia_raw', 2, 'carb'),
      line('egg_whole', 2, 'protein'),
      line('onion', 0.25, 'vegetable'),
      line('olive_oil', 0.25, 'fat'),
    ],
  },
  {
    id: 'pan_huevo_aguacate',
    slot: 'BREAKFAST',
    lines: [
      line('whole_wheat_bread', 2, 'carb', { alternatives: BREAD_ALTERNATIVES }),
      line('egg_whole', 2, 'protein'),
      line('avocado_half', 0.5, 'fat'),
      line('tomato', 0.33, 'vegetable'),
    ],
  },
  {
    id: 'yogur_lechosa_avena',
    slot: 'BREAKFAST',
    lines: [
      line('greek_yogurt_nonfat', 1, 'dairy', { alternatives: YOGURT_ALTERNATIVES }),
      line('papaya', 1, 'fruit'),
      line('oats_rolled', 0.75, 'carb', { alternatives: ['food.quinoa'] }),
      line('chia_seeds', 0.25, 'fat'),
    ],
  },

  // ── Almuerzo ────────────────────────────────────────────────────────────
  {
    id: 'locrio_pollo_ensalada',
    slot: 'LUNCH',
    everyday: true,
    lines: [
      line('white_rice', 1, 'carb'),
      line('chicken_breast', 1.5, 'protein'),
      line('canola_oil', 0.5, 'fat'),
      line('avocado_half', 0.5, 'fat'),
      line('lettuce_romaine', 1, 'vegetable'),
    ],
  },
  {
    id: 'moro_habichuelas_pechuga',
    slot: 'LUNCH',
    everyday: true,
    lines: [
      line('white_rice', 0.75, 'carb'),
      line('kidney_beans', 0.5, 'carb', { alternatives: BEAN_ALTERNATIVES }),
      line('chicken_breast', 1.5, 'protein'),
      line('canola_oil', 0.5, 'fat'),
      line('lettuce_romaine', 1, 'vegetable'),
    ],
  },
  {
    id: 'arroz_camarones_vegetales',
    slot: 'LUNCH',
    lines: [
      line('white_rice', 1, 'carb'),
      line('shrimp', 1.5, 'protein'),
      line('olive_oil', 0.75, 'fat'),
      line('corn', 0.5, 'vegetable'),
      line('bell_pepper_red', 0.5, 'vegetable'),
    ],
  },
  {
    // Prototype "tostones al horno": the catalog's tostones are fried (never
    // planned), so the dish is grilled fish with boiled green plantain.
    id: 'pescado_platano_ensalada',
    slot: 'LUNCH',
    lines: [
      line('tilapia', 1.75, 'protein'),
      line('plantain_boiled', 2, 'carb'),
      line('olive_oil', 0.75, 'fat'),
      line('lettuce_romaine', 1, 'vegetable'),
      seasoning('lemon_juice', 1),
    ],
  },
  {
    id: 'sancocho_ligero_pollo',
    slot: 'LUNCH',
    everyday: true,
    lines: [
      line('chicken_breast', 1.5, 'protein'),
      line('cassava_cooked', 0.75, 'carb'),
      line('yam_cooked', 0.75, 'carb'),
      line('corn', 0.5, 'vegetable'),
      line('pumpkin', 0.25, 'vegetable'),
    ],
  },
  {
    id: 'moro_guandules_pollo',
    slot: 'LUNCH',
    everyday: true,
    lines: [
      line('white_rice', 0.75, 'carb'),
      line('pigeon_peas', 1, 'carb', { alternatives: BEAN_ALTERNATIVES }),
      line('chicken_drumstick', 1.25, 'protein'),
      line('canola_oil', 0.5, 'fat'),
      line('tomato', 0.5, 'vegetable'),
    ],
  },
  {
    id: 'la_bandera',
    slot: 'LUNCH',
    everyday: true,
    lines: [
      line('white_rice', 1, 'carb'),
      line('kidney_beans', 0.5, 'carb', { alternatives: BEAN_ALTERNATIVES }),
      line('beef_sirloin', 1.25, 'protein'),
      line('canola_oil', 0.5, 'fat'),
      line('lettuce_romaine', 1, 'vegetable'),
    ],
  },
  {
    id: 'lambi_guisado_arroz',
    slot: 'LUNCH',
    lines: [
      line('conch', 1.5, 'protein'),
      line('white_rice', 1, 'carb'),
      line('olive_oil', 0.5, 'fat'),
      line('bell_pepper_green', 0.5, 'vegetable'),
      line('onion', 0.25, 'vegetable'),
    ],
  },
  {
    id: 'pollo_horno_batata_repollo',
    slot: 'LUNCH',
    lines: [
      line('roast_chicken', 1.5, 'protein'),
      line('sweet_potato', 1, 'carb'),
      line('olive_oil', 0.5, 'fat'),
      line('cabbage', 0.75, 'vegetable'),
    ],
  },
  {
    id: 'arroz_integral_habichuelas_aguacate',
    slot: 'LUNCH',
    lines: [
      line('brown_rice', 1, 'carb'),
      line('black_beans', 0.75, 'carb', { alternatives: BEAN_ALTERNATIVES }),
      line('egg_whole', 1, 'protein'),
      line('avocado_half', 0.5, 'fat'),
      line('tomato', 0.5, 'vegetable'),
    ],
  },
  {
    id: 'bacalao_guisado_yuca',
    slot: 'LUNCH',
    everyday: true,
    lines: [
      line('cod', 1.75, 'protein'),
      line('cassava_cooked', 1, 'carb'),
      line('olive_oil', 0.5, 'fat'),
      line('tomato', 0.5, 'vegetable'),
      line('onion', 0.25, 'vegetable'),
    ],
  },
  {
    id: 'chuleta_moro_negro',
    slot: 'LUNCH',
    everyday: true,
    lines: [
      line('pork_loin_chop', 1.25, 'protein'),
      line('white_rice', 0.75, 'carb'),
      line('black_beans', 0.5, 'carb', { alternatives: BEAN_ALTERNATIVES }),
      line('olive_oil', 0.25, 'fat'),
      line('lettuce_romaine', 1, 'vegetable'),
    ],
  },

  // ── Cena ────────────────────────────────────────────────────────────────
  {
    id: 'pechuga_pure_yuca',
    slot: 'DINNER',
    everyday: true,
    lines: [
      line('chicken_breast', 1.5, 'protein'),
      line('cassava_cooked', 1.25, 'carb'),
      line('olive_oil', 0.25, 'fat'),
      line('lettuce_romaine', 0.5, 'vegetable'),
    ],
  },
  {
    id: 'ensalada_atun_aguacate',
    slot: 'DINNER',
    lines: [
      line('tuna_canned_water', 1.25, 'protein'),
      line('avocado_half', 1, 'fat'),
      line('egg_whole', 1, 'protein'),
      line('lettuce_romaine', 1, 'vegetable'),
      line('tomato', 0.5, 'vegetable'),
      line('olive_oil', 0.25, 'fat'),
    ],
  },
  {
    id: 'camarones_ajillo_arroz_integral',
    slot: 'DINNER',
    lines: [
      line('shrimp', 1.75, 'protein'),
      line('brown_rice', 1, 'carb'),
      line('olive_oil', 0.75, 'fat'),
      line('broccoli', 0.75, 'vegetable'),
      seasoning('garlic', 1),
    ],
  },
  {
    id: 'tortilla_vegetales_casabe',
    slot: 'DINNER',
    everyday: true,
    lines: [
      line('egg_whole', 3, 'protein'),
      line('casabe', 0.5, 'carb', { alternatives: CASABE_ALTERNATIVES }),
      line('bell_pepper_red', 0.5, 'vegetable'),
      line('spinach', 0.5, 'vegetable'),
      line('olive_oil', 0.25, 'fat'),
    ],
  },
  {
    // Cheese in the fat role, as in mangu_huevo_queso_blanco.
    id: 'yuca_huevo_queso_blanco',
    slot: 'DINNER',
    everyday: true,
    lines: [
      line('cassava_cooked', 1.25, 'carb'),
      line('egg_whole', 2, 'protein'),
      line('queso_blanco', 0.25, 'fat', { alternatives: QUESO_ALTERNATIVES }),
      line('onion', 0.5, 'vegetable'),
    ],
  },
  {
    id: 'salmon_batata_vegetales',
    slot: 'DINNER',
    lines: [
      line('salmon_atlantic', 1.5, 'protein'),
      line('sweet_potato', 0.5, 'carb'),
      line('broccoli', 1, 'vegetable'),
      line('carrots', 0.5, 'vegetable'),
      line('olive_oil', 0.5, 'fat'),
      seasoning('lemon_juice', 1),
    ],
  },
  {
    id: 'pavo_pure_batata',
    slot: 'DINNER',
    lines: [
      line('turkey_breast', 1.5, 'protein'),
      line('sweet_potato', 1, 'carb'),
      line('green_beans', 1, 'vegetable'),
      line('olive_oil', 0.25, 'fat'),
    ],
  },
  {
    id: 'pescado_horno_name',
    slot: 'DINNER',
    lines: [
      line('tilapia', 1.5, 'protein'),
      line('yam_cooked', 1.5, 'carb'),
      line('lettuce_romaine', 1, 'vegetable'),
      line('olive_oil', 0.5, 'fat'),
    ],
  },
  {
    id: 'wrap_pollo_vegetales',
    slot: 'DINNER',
    lines: [
      line('whole_wheat_tortilla', 1, 'carb', { alternatives: BREAD_ALTERNATIVES }),
      line('chicken_breast', 1.25, 'protein'),
      line('lettuce_romaine', 1, 'vegetable'),
      line('tomato', 0.5, 'vegetable'),
      line('avocado_half', 0.33, 'fat'),
    ],
  },
  {
    id: 'res_salteada_arroz_integral',
    slot: 'DINNER',
    lines: [
      line('beef_sirloin', 1.25, 'protein'),
      line('brown_rice', 0.75, 'carb'),
      line('bell_pepper_red', 0.5, 'vegetable'),
      line('onion', 0.25, 'vegetable'),
      line('olive_oil', 0.5, 'fat'),
    ],
  },
  {
    id: 'crema_auyama_pollo',
    slot: 'DINNER',
    lines: [
      line('pumpkin', 1.5, 'vegetable'),
      line('chicken_breast', 1.25, 'protein'),
      line('whole_wheat_bread', 1, 'carb', { alternatives: BREAD_ALTERNATIVES }),
      line('olive_oil', 0.25, 'fat'),
    ],
  },
  {
    id: 'langosta_batata_ensalada',
    slot: 'DINNER',
    lines: [
      line('lobster', 1.5, 'protein'),
      line('sweet_potato', 1, 'carb'),
      line('lettuce_romaine', 1, 'vegetable'),
      line('olive_oil', 0.5, 'fat'),
    ],
  },
  {
    id: 'almejas_guisadas_arroz',
    slot: 'DINNER',
    lines: [
      line('clams', 1.25, 'protein'),
      line('white_rice', 0.75, 'carb'),
      line('tomato', 0.5, 'vegetable'),
      line('olive_oil', 0.5, 'fat'),
    ],
  },

  // ── Merienda ────────────────────────────────────────────────────────────
  {
    id: 'pina_chia',
    slot: 'SNACK',
    lines: [
      line('pineapple', 1, 'fruit'),
      line('chia_seeds', 0.5, 'fat'),
      seasoning('lemon_juice', 1),
    ],
  },
  {
    // Prototype honey left out (added sugar is never planned).
    id: 'batida_lechosa_leche',
    slot: 'SNACK',
    lines: [
      line('papaya', 1, 'fruit'),
      line('milk_skim', 0.75, 'dairy', { alternatives: MILK_ALTERNATIVES }),
      line('oats_rolled', 0.25, 'carb', { alternatives: ['food.quinoa'] }),
    ],
  },
  {
    id: 'guineo_mantequilla_mani',
    slot: 'SNACK',
    lines: [
      line('banana', 1, 'fruit'),
      line('peanut_butter', 0.5, 'fat', { alternatives: NUT_BUTTER_ALTERNATIVES }),
    ],
  },
  {
    id: 'casabe_aguacate',
    slot: 'SNACK',
    everyday: true,
    lines: [
      line('casabe', 0.5, 'carb', { alternatives: CASABE_ALTERNATIVES }),
      line('avocado_half', 0.5, 'fat'),
    ],
  },
  {
    // Avena con canela, the everyday oat drink; no added sugar.
    id: 'batida_avena_canela',
    slot: 'SNACK',
    everyday: true,
    lines: [
      line('oats_rolled', 0.5, 'carb', { alternatives: ['food.quinoa'] }),
      line('milk_skim', 0.75, 'dairy', { alternatives: MILK_ALTERNATIVES }),
      seasoning('cinnamon_ground', 1),
    ],
  },
  {
    id: 'nueces_pasas',
    slot: 'SNACK',
    lines: [
      line('walnuts', 0.75, 'fat', { alternatives: NUT_ALTERNATIVES }),
      line('raisins', 0.5, 'fruit'),
    ],
  },
  {
    id: 'yogur_mango',
    slot: 'SNACK',
    lines: [
      line('greek_yogurt_nonfat', 1, 'dairy', { alternatives: YOGURT_ALTERNATIVES }),
      line('mango', 0.5, 'fruit'),
    ],
  },
  {
    id: 'manzana_mantequilla_mani',
    slot: 'SNACK',
    lines: [
      line('apple', 1, 'fruit'),
      line('peanut_butter', 0.5, 'fat', { alternatives: NUT_BUTTER_ALTERNATIVES }),
    ],
  },
  {
    id: 'naranja_mani',
    slot: 'SNACK',
    lines: [
      line('orange', 1, 'fruit'),
      line('peanuts', 0.5, 'fat', { alternatives: NUT_ALTERNATIVES }),
    ],
  },
  {
    id: 'batida_guineo_avena',
    slot: 'SNACK',
    lines: [
      line('banana', 1, 'fruit'),
      line('milk_skim', 0.75, 'dairy', { alternatives: MILK_ALTERNATIVES }),
      line('oats_rolled', 0.25, 'carb', { alternatives: ['food.quinoa'] }),
    ],
  },
];

export function dishesForSlot(slot: MealSlot): readonly Dish[] {
  return DOMINICAN_DISHES.filter((dish) => dish.slot === slot);
}

export interface DishNutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

type FoodLookup = (id: FoodId) => FoodItem | undefined;

/** A dish's household-portion nutrition, computed from the catalog (never authored). */
export function dishMacros(dish: Dish, food: FoodLookup): DishNutrition {
  return dish.lines.reduce<DishNutrition>(
    (sum, entry) => {
      const item = food(entry.food);
      if (!item) return sum;
      return {
        calories: sum.calories + item.calories * entry.servings,
        proteinG: sum.proteinG + item.proteinG * entry.servings,
        carbsG: sum.carbsG + item.carbsG * entry.servings,
        fatG: sum.fatG + item.fatG * entry.servings,
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** The dish's allergen / avoid tags, derived from its foods (sorted, unique). */
export function dishAvoidTags(dish: Dish, food: FoodLookup): AvoidTag[] {
  return [...new Set(dish.lines.flatMap((entry) => food(entry.food)?.avoidFor ?? []))].sort();
}

/** One line of a dish after the person's exclusions. */
export interface AdaptedLine extends DishLine {
  /** The dish's own food this line replaced, when it was swapped. */
  swappedFrom?: FoodId;
}

export interface AdaptedDish {
  dish: Dish;
  lines: AdaptedLine[];
  adjustments: MealAdjustment[];
}

/**
 * ADR-P040 D3 / the prototype's `adaptDish`: only the excluded ingredient
 * changes, never the whole dish. It becomes the first non-excluded food of the
 * same role (the line's alternatives, then the role pool) that is not already
 * in the dish, in the same calories; with none, it is left out. A seasoning
 * is never substituted. Matching is by catalog key and avoid tag only (the
 * caller's `isBlocked`), never by substring. Deterministic.
 */
export function adaptDish(
  dish: Dish,
  isBlocked: (id: FoodId) => boolean,
  food: FoodLookup,
): AdaptedDish {
  const inDish = new Set(dish.lines.map((entry) => entry.food));
  const lines: AdaptedLine[] = [];
  const adjustments: MealAdjustment[] = [];
  for (const entry of dish.lines) {
    const original = food(entry.food);
    if (original && !isBlocked(entry.food)) {
      lines.push(entry);
      continue;
    }
    const candidates = entry.seasoning
      ? []
      : [...(entry.alternatives ?? []), ...DISH_SWAP_POOLS[entry.role]];
    const replacement = candidates
      .map((id) => food(id))
      .find(
        (item): item is FoodItem =>
          item !== undefined && !isBlocked(item.id) && !inDish.has(item.id),
      );
    adjustments.push({ from: entry.food, to: replacement?.id ?? null });
    if (!replacement) continue;
    inDish.add(replacement.id);
    // Same energy as the line it replaces, in the 0.25-serving steps the plan uses.
    const kcal = (original?.calories ?? 0) * entry.servings;
    const servings = Math.max(0.25, Math.round((kcal / Math.max(1, replacement.calories)) * 4) / 4);
    lines.push({
      food: replacement.id,
      servings,
      role: entry.role,
      swappedFrom: entry.food,
    });
  }
  return { dish, lines, adjustments };
}
