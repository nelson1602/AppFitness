import type {
  AvoidTag,
  FoodCategory,
  FoodItem,
  FoodTag,
  ServingSize,
} from '../domain/food-catalog';

/**
 * Bundled 300-food healthy catalog (Phase 15 Slice 2). Static reference
 * data — no SQLite/sync/backend/network. See ../domain/food-catalog.ts for
 * the provenance/consistency policy: macros are standard reference values
 * (USDA FoodData Central based), rounded; `calories` is their Atwater
 * estimate (computed here so the catalog stays internally consistent and
 * free of transcription errors). Descriptive tags only — no medical/diet
 * claims.
 */

interface Extra {
  fiber?: number;
  tags: FoodTag[];
  avoid?: AvoidTag[];
  caution?: string;
  srcNote?: string;
}

const DEFAULT_SRC_NOTE =
  'Standard reference macros (USDA-based), rounded; calories via Atwater factors (4/4/9).';

function food(
  id: string,
  name: string,
  category: FoodCategory,
  servingSize: ServingSize,
  proteinG: number,
  carbsG: number,
  fatG: number,
  extra: Extra,
): FoodItem {
  return {
    id,
    name,
    category,
    servingSize,
    calories: Math.round(4 * proteinG + 4 * carbsG + 9 * fatG),
    proteinG,
    carbsG,
    fatG,
    ...(extra.fiber != null ? { fiberG: extra.fiber } : {}),
    tags: extra.tags,
    ...(extra.avoid ? { avoidFor: extra.avoid } : {}),
    ...(extra.caution ? { caution: extra.caution } : {}),
    source: { ref: 'USDA FoodData Central', note: extra.srcNote ?? DEFAULT_SRC_NOTE },
  };
}

const g = (amount: number): ServingSize => ({ amount, unit: 'g' });
const ml = (amount: number): ServingSize => ({ amount, unit: 'ml' });
// One `piece` weighing `grams` (ADR-P012 / TECHDEBT-004 risk 3): the authored
// argument is the known one-piece gram weight, recorded as `grams` (not the
// nonsensical "N piece" the amount used to hold). Revision bump lives in
// FOOD_REVISIONS (domain/catalog-identity.ts).
const piece1 = (grams: number): ServingSize => ({ amount: 1, unit: 'piece', grams });
const cup = (amount: number): ServingSize => ({ amount, unit: 'cup' });
const tbsp = (amount: number): ServingSize => ({ amount, unit: 'tbsp' });
// A slice serving whose full-serving gram weight is sourced from the pinned
// USDA-FDC archive (ADR-P013 Batch 1; see catalog/fdc-portion-manifest.json for
// per-food fdcId/portion provenance). `grams` covers the WHOLE serving (e.g.
// canadian_bacon's 2-slice serving = 57 g total). Revision bumps live in
// FOOD_REVISIONS (domain/catalog-identity.ts).
const sliceFdc = (amount: number, grams: number): ServingSize => ({ amount, unit: 'slice', grams });
// A tablespoon serving whose full-serving gram weight is sourced from the pinned
// USDA-FDC archive (ADR-P013 Batch 2; see catalog/fdc-portion-manifest.json for
// per-food fdcId/portion provenance). `grams` covers the WHOLE authored serving
// (e.g. hummus' 2-tbsp serving = 30 g total). Revision bumps live in
// FOOD_REVISIONS (domain/catalog-identity.ts).
const tbspFdc = (amount: number, grams: number): ServingSize => ({ amount, unit: 'tbsp', grams });
// A teaspoon serving whose full-serving gram weight is sourced from the pinned
// USDA-FDC archive (ADR-P013 tsp semantics mini-slice; see
// catalog/fdc-portion-manifest.json for per-food fdcId/portion provenance).
const tspFdc = (amount: number, grams: number): ServingSize => ({ amount, unit: 'tsp', grams });
// A cup serving whose full-serving gram weight is sourced from the pinned
// USDA-FDC archive (ADR-P013 Batch 3A; see catalog/fdc-portion-manifest.json for
// per-food fdcId/portion provenance). `grams` covers the WHOLE authored serving
// (e.g. popcorn's 3-cup serving = 24 g total). Never derive by assumed density.
const cupFdc = (amount: number, grams: number): ServingSize => ({ amount, unit: 'cup', grams });
// A millilitre serving whose full-serving gram weight is DENSITY-derived from a
// volume-paired portion row in the pinned USDA-FDC archive (ADR-P013 Batch 5;
// see catalog/fdc-portion-manifest.json for each food's density = gramWeight /
// sourceVolumeMl and derivation). Never an assumed 1 g/ml.
const mlFdc = (amount: number, grams: number): ServingSize => ({ amount, unit: 'ml', grams });

export const FOOD_CATALOG: readonly FoodItem[] = [
  // ── protein_animal (42) ──────────────────────────────────────────────
  food('food.chicken_breast', 'Chicken breast, cooked', 'protein_animal', g(100), 31, 0, 4, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food(
    'food.chicken_thigh',
    'Chicken thigh, skinless, cooked',
    'protein_animal',
    g(100),
    26,
    0,
    11,
    { tags: ['high_protein', 'gluten_free', 'dairy_free'] },
  ),
  food('food.turkey_breast', 'Turkey breast, cooked', 'protein_animal', g(100), 29, 0, 2, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
  }),
  food(
    'food.ground_turkey_lean',
    'Lean ground turkey, cooked',
    'protein_animal',
    g(100),
    27,
    0,
    8,
    { tags: ['high_protein', 'gluten_free', 'dairy_free', 'budget_friendly'] },
  ),
  food('food.beef_sirloin', 'Beef sirloin, lean, cooked', 'protein_animal', g(100), 29, 0, 6, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
  }),
  food(
    'food.ground_beef_lean',
    'Lean ground beef (93%), cooked',
    'protein_animal',
    g(100),
    26,
    0,
    11,
    { tags: ['high_protein', 'gluten_free', 'dairy_free', 'budget_friendly'] },
  ),
  food('food.beef_tenderloin', 'Beef tenderloin, cooked', 'protein_animal', g(100), 26, 0, 9, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
  }),
  food('food.beef_flank', 'Beef flank steak, cooked', 'protein_animal', g(100), 28, 0, 8, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
  }),
  food('food.pork_tenderloin', 'Pork tenderloin, cooked', 'protein_animal', g(100), 26, 0, 4, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
  }),
  food('food.pork_loin_chop', 'Pork loin chop, cooked', 'protein_animal', g(100), 27, 0, 7, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
  }),
  food(
    'food.pork_shoulder_lean',
    'Pork shoulder, lean, cooked',
    'protein_animal',
    g(100),
    24,
    0,
    10,
    { tags: ['high_protein', 'gluten_free', 'dairy_free', 'budget_friendly'] },
  ),
  food('food.lamb_loin', 'Lamb loin, lean, cooked', 'protein_animal', g(100), 25, 0, 8, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
  }),
  food('food.venison', 'Venison, cooked', 'protein_animal', g(100), 30, 0, 3, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
  }),
  food('food.bison', 'Bison, cooked', 'protein_animal', g(100), 28, 0, 7, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
  }),
  food('food.egg_whole', 'Egg, whole', 'protein_animal', piece1(50), 6, 0.5, 5, {
    tags: ['vegetarian', 'gluten_free', 'quick_prep', 'budget_friendly'],
  }),
  food('food.egg_white', 'Egg white', 'protein_animal', piece1(33), 4, 0.2, 0, {
    tags: ['high_protein', 'low_carb', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food(
    'food.egg_omelette_plain',
    'Plain egg omelette (2 eggs)',
    'protein_animal',
    piece1(120),
    13,
    2,
    11,
    { tags: ['vegetarian', 'gluten_free', 'quick_prep'] },
  ),
  food('food.salmon_atlantic', 'Salmon, Atlantic, cooked', 'protein_animal', g(100), 25, 0, 13, {
    tags: ['high_protein', 'healthy_fat', 'heart_healthy', 'gluten_free', 'dairy_free'],
  }),
  food('food.salmon_sockeye', 'Salmon, sockeye, cooked', 'protein_animal', g(100), 27, 0, 9, {
    tags: ['high_protein', 'healthy_fat', 'heart_healthy', 'gluten_free', 'dairy_free'],
  }),
  food('food.tuna_canned_water', 'Tuna, canned in water', 'protein_animal', g(100), 26, 0, 1, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free', 'budget_friendly'],
    avoid: ['high_purine'],
  }),
  food('food.tuna_yellowfin', 'Tuna, yellowfin, cooked', 'protein_animal', g(100), 29, 0, 1, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
    avoid: ['high_purine'],
  }),
  food('food.cod', 'Cod, cooked', 'protein_animal', g(100), 23, 0, 1, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food('food.haddock', 'Haddock, cooked', 'protein_animal', g(100), 24, 0, 1, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
  }),
  food('food.pollock', 'Pollock, cooked', 'protein_animal', g(100), 23, 0, 1, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free', 'budget_friendly'],
  }),
  food('food.tilapia', 'Tilapia, cooked', 'protein_animal', g(100), 26, 0, 3, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
  }),
  food('food.halibut', 'Halibut, cooked', 'protein_animal', g(100), 27, 0, 3, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
  }),
  food('food.rainbow_trout', 'Rainbow trout, cooked', 'protein_animal', g(100), 24, 0, 8, {
    tags: ['high_protein', 'healthy_fat', 'gluten_free', 'dairy_free'],
  }),
  food('food.mackerel', 'Mackerel, cooked', 'protein_animal', g(100), 24, 0, 14, {
    tags: ['high_protein', 'healthy_fat', 'heart_healthy', 'gluten_free', 'dairy_free'],
    avoid: ['high_purine'],
  }),
  food('food.sardines_canned', 'Sardines, canned in water', 'protein_animal', g(100), 25, 0, 11, {
    tags: ['high_protein', 'healthy_fat', 'heart_healthy', 'gluten_free', 'dairy_free'],
    avoid: ['high_purine'],
  }),
  food('food.shrimp', 'Shrimp, cooked', 'protein_animal', g(100), 24, 0, 1, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
    avoid: ['shellfish_allergy', 'high_purine'],
  }),
  food('food.crab', 'Crab, cooked', 'protein_animal', g(100), 19, 0, 1, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
    avoid: ['shellfish_allergy', 'high_purine'],
  }),
  food('food.scallops', 'Scallops, cooked', 'protein_animal', g(100), 21, 3, 1, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
    avoid: ['shellfish_allergy'],
  }),
  food('food.mussels', 'Mussels, cooked', 'protein_animal', g(100), 24, 7, 4, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
    avoid: ['shellfish_allergy', 'high_purine'],
  }),
  food('food.octopus', 'Octopus, cooked', 'protein_animal', g(100), 25, 4, 2, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
    avoid: ['shellfish_allergy'],
  }),
  food(
    'food.chicken_drumstick',
    'Chicken drumstick, skinless, cooked',
    'protein_animal',
    g(100),
    28,
    0,
    6,
    { tags: ['high_protein', 'gluten_free', 'dairy_free', 'budget_friendly'] },
  ),
  food('food.chicken_deli', 'Chicken breast, deli slices', 'protein_animal', g(50), 10, 1, 1, {
    tags: ['high_protein', 'gluten_free', 'quick_prep'],
    avoid: ['high_sodium_sensitive'],
    caution: 'Processed — higher sodium.',
  }),
  food('food.turkey_deli', 'Turkey breast, deli slices', 'protein_animal', g(50), 9, 1, 1, {
    tags: ['high_protein', 'quick_prep'],
    avoid: ['high_sodium_sensitive'],
    caution: 'Processed — higher sodium.',
  }),
  food('food.canadian_bacon', 'Canadian bacon', 'protein_animal', sliceFdc(2, 57), 11, 1, 3, {
    tags: ['high_protein'],
    avoid: ['high_sodium_sensitive'],
    caution: 'Processed — higher sodium.',
  }),
  food('food.roast_chicken', 'Roast chicken, meat only', 'protein_animal', g(100), 25, 0, 7, {
    tags: ['high_protein', 'gluten_free', 'dairy_free'],
  }),
  food('food.ahi_tuna_seared', 'Ahi tuna steak, seared', 'protein_animal', g(100), 28, 0, 1, {
    tags: ['high_protein', 'low_carb', 'gluten_free', 'dairy_free'],
    avoid: ['high_purine'],
  }),
  food('food.chicken_liver', 'Chicken liver, cooked', 'protein_animal', g(100), 24, 1, 6, {
    tags: ['high_protein', 'gluten_free', 'dairy_free', 'budget_friendly'],
    avoid: ['high_purine'],
    caution: 'Very high vitamin A — moderate intake.',
  }),
  food('food.eggs_two_large', 'Eggs, two large', 'protein_animal', piece1(100), 12, 1, 10, {
    tags: ['vegetarian', 'gluten_free', 'quick_prep', 'budget_friendly'],
  }),

  // ── protein_plant (22) ───────────────────────────────────────────────
  food('food.tofu_firm', 'Tofu, firm', 'protein_plant', g(100), 15, 3, 9, {
    fiber: 2,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'heart_healthy'],
  }),
  food('food.tofu_silken', 'Tofu, silken', 'protein_plant', g(100), 6, 2, 3, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food('food.tempeh', 'Tempeh', 'protein_plant', g(100), 19, 9, 11, {
    fiber: 5,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.seitan', 'Seitan', 'protein_plant', g(100), 25, 6, 2, {
    tags: ['high_protein', 'vegan', 'vegetarian', 'dairy_free'],
    avoid: ['gluten_sensitive'],
    caution: 'Wheat gluten — not gluten-free.',
  }),
  food('food.edamame', 'Edamame, shelled, cooked', 'protein_plant', cupFdc(1, 155), 18, 14, 8, {
    fiber: 8,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.soy_curls', 'Soy curls, rehydrated', 'protein_plant', g(100), 18, 12, 5, {
    fiber: 6,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food(
    'food.textured_vegetable_protein',
    'Textured vegetable protein',
    'protein_plant',
    g(50),
    25,
    15,
    1,
    {
      fiber: 8,
      tags: [
        'high_protein',
        'vegan',
        'vegetarian',
        'gluten_free',
        'dairy_free',
        'high_fiber',
        'budget_friendly',
      ],
    },
  ),
  food(
    'food.black_bean_burger',
    'Black bean veggie burger',
    'protein_plant',
    piece1(85),
    11,
    15,
    4,
    {
      fiber: 5,
      tags: ['vegan', 'vegetarian', 'dairy_free', 'high_fiber', 'quick_prep'],
      avoid: ['gluten_sensitive'],
      caution: 'Some brands contain wheat.',
    },
  ),
  food('food.pea_protein_isolate', 'Pea protein isolate', 'protein_plant', g(30), 24, 1, 2, {
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.soy_protein_isolate', 'Soy protein isolate', 'protein_plant', g(30), 25, 1, 1, {
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.lentil_pasta', 'Red lentil pasta, cooked', 'protein_plant', g(100), 9, 25, 1, {
    fiber: 4,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.chickpea_pasta', 'Chickpea pasta, cooked', 'protein_plant', g(100), 8, 24, 2, {
    fiber: 5,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.soy_milk_unsweet', 'Soy milk, unsweetened', 'protein_plant', mlFdc(240, 246.5), 7, 4, 4, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'heart_healthy'],
  }),
  food('food.pea_milk_unsweet', 'Pea milk, unsweetened', 'protein_plant', ml(240), 8, 0, 5, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.natto', 'Natto', 'protein_plant', g(100), 19, 13, 11, {
    fiber: 5,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.veggie_ground_soy', 'Meatless soy crumbles', 'protein_plant', g(85), 13, 6, 3, {
    fiber: 3,
    tags: ['high_protein', 'vegan', 'vegetarian', 'dairy_free', 'quick_prep'],
  }),
  food('food.falafel', 'Falafel, baked', 'protein_plant', piece1(60), 8, 16, 6, {
    fiber: 4,
    tags: ['vegan', 'vegetarian', 'dairy_free', 'high_fiber'],
  }),
  food('food.hemp_tofu', 'Hemp tofu', 'protein_plant', g(100), 14, 4, 11, {
    fiber: 3,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'healthy_fat'],
  }),
  food('food.lupini_beans', 'Lupini beans, cooked', 'protein_plant', g(100), 16, 10, 3, {
    fiber: 3,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.mycoprotein', 'Mycoprotein pieces', 'protein_plant', g(100), 15, 10, 3, {
    fiber: 6,
    tags: ['high_protein', 'vegetarian', 'high_fiber'],
  }),
  food('food.soy_yogurt_plain', 'Soy yogurt, plain unsweetened', 'protein_plant', g(150), 6, 6, 4, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.roasted_edamame', 'Dry-roasted edamame', 'protein_plant', g(30), 13, 10, 3, {
    fiber: 4,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'quick_prep',
    ],
  }),

  // ── grain (30) ───────────────────────────────────────────────────────
  food('food.oats_rolled', 'Rolled oats, dry', 'grain', g(40), 5, 27, 3, {
    fiber: 4,
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
      'budget_friendly',
    ],
  }),
  food('food.steel_cut_oats', 'Steel-cut oats, dry', 'grain', g(40), 5, 27, 3, {
    fiber: 4,
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
      'budget_friendly',
    ],
  }),
  food('food.brown_rice', 'Brown rice, cooked', 'grain', cupFdc(1, 195), 5, 45, 2, {
    fiber: 4,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'budget_friendly'],
  }),
  food('food.white_rice', 'White rice, cooked', 'grain', cupFdc(1, 158), 4, 45, 0, {
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'budget_friendly',
      'quick_prep',
    ],
  }),
  food('food.basmati_rice', 'Basmati rice, cooked', 'grain', cup(1), 4, 46, 0, {
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.jasmine_rice', 'Jasmine rice, cooked', 'grain', cup(1), 4, 45, 0, {
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.wild_rice', 'Wild rice, cooked', 'grain', cupFdc(1, 164), 7, 35, 1, {
    fiber: 3,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.quinoa', 'Quinoa, cooked', 'grain', cupFdc(1, 185), 8, 39, 4, {
    fiber: 5,
    tags: [
      'high_protein',
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
    ],
  }),
  food('food.barley', 'Pearl barley, cooked', 'grain', cupFdc(1, 157), 4, 44, 1, {
    fiber: 6,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber', 'heart_healthy'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.bulgur', 'Bulgur, cooked', 'grain', cupFdc(1, 182), 6, 34, 0, {
    fiber: 8,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.farro', 'Farro, cooked', 'grain', cup(1), 8, 47, 1, {
    fiber: 5,
    tags: ['high_protein', 'complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.buckwheat', 'Buckwheat groats, cooked', 'grain', cupFdc(1, 168), 6, 33, 1, {
    fiber: 5,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.millet', 'Millet, cooked', 'grain', cupFdc(1, 174), 6, 41, 2, {
    fiber: 2,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.amaranth', 'Amaranth, cooked', 'grain', cupFdc(1, 246), 9, 46, 4, {
    fiber: 5,
    tags: [
      'high_protein',
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
    ],
  }),
  food('food.sorghum', 'Sorghum, cooked', 'grain', cup(1), 6, 46, 2, {
    fiber: 4,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.whole_wheat_bread', 'Whole wheat bread', 'grain', sliceFdc(1, 32), 4, 12, 1, {
    fiber: 2,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'budget_friendly', 'quick_prep'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.sourdough_bread', 'Sourdough bread', 'grain', sliceFdc(1, 31), 4, 18, 1, {
    fiber: 1,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'quick_prep'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.rye_bread', 'Rye bread', 'grain', sliceFdc(1, 32), 3, 15, 1, {
    fiber: 2,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.whole_wheat_pasta', 'Whole wheat pasta, cooked', 'grain', g(100), 6, 27, 1, {
    fiber: 4,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.brown_rice_pasta', 'Brown rice pasta, cooked', 'grain', g(100), 4, 30, 1, {
    fiber: 2,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.corn_tortilla', 'Corn tortilla', 'grain', piece1(24), 1, 11, 1, {
    fiber: 1,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'budget_friendly'],
  }),
  food('food.whole_wheat_tortilla', 'Whole wheat tortilla', 'grain', piece1(45), 4, 21, 3, {
    fiber: 3,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'quick_prep'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.oat_bran', 'Oat bran, dry', 'grain', g(30), 5, 18, 2, {
    fiber: 4,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber', 'heart_healthy'],
  }),
  food('food.polenta', 'Polenta, cooked', 'grain', cupFdc(1, 240), 3, 30, 1, {
    fiber: 2,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'budget_friendly'],
  }),
  food('food.couscous_whole', 'Whole wheat couscous, cooked', 'grain', cup(1), 6, 36, 0, {
    fiber: 5,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.rice_cakes', 'Brown rice cakes', 'grain', piece1(9), 1, 7, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food('food.shredded_wheat', 'Shredded wheat cereal', 'grain', g(40), 4, 30, 1, {
    fiber: 4,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber', 'heart_healthy'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.muesli', 'Whole-grain muesli, no sugar added', 'grain', g(45), 5, 30, 3, {
    fiber: 5,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber'],
    avoid: ['gluten_sensitive'],
  }),
  food('food.popcorn_air', 'Air-popped popcorn', 'grain', cupFdc(3, 24), 3, 19, 1, {
    fiber: 4,
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
      'quick_prep',
    ],
  }),
  food('food.ezekiel_bread', 'Sprouted grain bread', 'grain', sliceFdc(1, 38), 4, 15, 1, {
    fiber: 3,
    tags: ['complex_carb', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber', 'heart_healthy'],
    avoid: ['gluten_sensitive'],
  }),

  // ── legume (20) ──────────────────────────────────────────────────────
  food('food.lentils_brown', 'Brown lentils, cooked', 'legume', cupFdc(1, 198), 18, 40, 1, {
    fiber: 16,
    tags: [
      'high_protein',
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
      'budget_friendly',
    ],
  }),
  food('food.lentils_red', 'Red lentils, cooked', 'legume', cup(1), 18, 39, 1, {
    fiber: 15,
    tags: [
      'high_protein',
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
    ],
  }),
  food('food.lentils_green', 'Green lentils, cooked', 'legume', cup(1), 18, 40, 1, {
    fiber: 16,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
    ],
  }),
  food('food.chickpeas', 'Chickpeas, cooked', 'legume', cupFdc(1, 164), 15, 45, 4, {
    fiber: 12,
    tags: [
      'high_protein',
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
    ],
  }),
  food('food.black_beans', 'Black beans, cooked', 'legume', cupFdc(1, 172), 15, 41, 1, {
    fiber: 15,
    tags: [
      'high_protein',
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
      'budget_friendly',
    ],
  }),
  food('food.kidney_beans', 'Kidney beans, cooked', 'legume', cupFdc(1, 177), 15, 40, 1, {
    fiber: 13,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
    ],
  }),
  food('food.pinto_beans', 'Pinto beans, cooked', 'legume', cupFdc(1, 171), 15, 45, 1, {
    fiber: 15,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
    ],
  }),
  food('food.navy_beans', 'Navy beans, cooked', 'legume', cupFdc(1, 182), 15, 47, 1, {
    fiber: 19,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
      'budget_friendly',
    ],
  }),
  food('food.cannellini_beans', 'Cannellini beans, cooked', 'legume', cup(1), 17, 44, 1, {
    fiber: 11,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
    ],
  }),
  food(
    'food.great_northern_beans',
    'Great northern beans, cooked',
    'legume',
    cupFdc(1, 177),
    15,
    37,
    1,
    {
      fiber: 12,
      tags: [
        'high_protein',
        'vegan',
        'vegetarian',
        'gluten_free',
        'dairy_free',
        'high_fiber',
        'budget_friendly',
      ],
    },
  ),
  food('food.lima_beans', 'Lima beans, cooked', 'legume', cupFdc(1, 188), 15, 39, 1, {
    fiber: 13,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.split_peas', 'Split peas, cooked', 'legume', cupFdc(1, 196), 16, 41, 1, {
    fiber: 16,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
    ],
  }),
  food('food.green_peas', 'Green peas, cooked', 'legume', cupFdc(1, 160), 9, 25, 1, {
    fiber: 9,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
      'quick_prep',
    ],
  }),
  food('food.black_eyed_peas', 'Black-eyed peas, cooked', 'legume', cupFdc(1, 171), 13, 36, 1, {
    fiber: 11,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
    ],
  }),
  food('food.mung_beans', 'Mung beans, cooked', 'legume', cupFdc(1, 202), 14, 39, 1, {
    fiber: 15,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.adzuki_beans', 'Adzuki beans, cooked', 'legume', cupFdc(1, 230), 17, 57, 0, {
    fiber: 17,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.fava_beans', 'Fava beans, cooked', 'legume', cupFdc(1, 170), 13, 33, 1, {
    fiber: 9,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),
  food('food.hummus', 'Hummus', 'legume', tbspFdc(2, 30), 2, 5, 5, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'healthy_fat', 'quick_prep'],
  }),
  food('food.refried_beans_nonfat', 'Refried beans, nonfat', 'legume', g(120), 8, 20, 0, {
    fiber: 7,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'budget_friendly'],
  }),
  food('food.soybeans', 'Soybeans, cooked', 'legume', cupFdc(1, 172), 29, 17, 15, {
    fiber: 10,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
    ],
  }),

  // ── vegetable (50) ───────────────────────────────────────────────────
  food('food.broccoli', 'Broccoli, cooked', 'vegetable', cupFdc(1, 156), 4, 11, 1, {
    fiber: 5,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'budget_friendly',
    ],
  }),
  food('food.spinach', 'Spinach, cooked', 'vegetable', cupFdc(1, 180), 5, 7, 0, {
    fiber: 4,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'budget_friendly',
    ],
  }),
  food('food.kale', 'Kale, cooked', 'vegetable', cupFdc(1, 118), 3, 7, 1, {
    fiber: 3,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'heart_healthy',
    ],
  }),
  food('food.cauliflower', 'Cauliflower, cooked', 'vegetable', cupFdc(1, 124), 2, 5, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb', 'low_sodium'],
  }),
  food('food.brussels_sprouts', 'Brussels sprouts, cooked', 'vegetable', cupFdc(1, 156), 4, 11, 1, {
    fiber: 4,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'low_sodium'],
  }),
  food('food.asparagus', 'Asparagus, cooked', 'vegetable', cupFdc(1, 180), 4, 7, 0, {
    fiber: 4,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'low_carb'],
  }),
  food('food.green_beans', 'Green beans, cooked', 'vegetable', cupFdc(1, 125), 2, 10, 0, {
    fiber: 4,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'budget_friendly',
    ],
  }),
  food('food.zucchini', 'Zucchini, cooked', 'vegetable', cupFdc(1, 180), 1, 5, 0, {
    fiber: 2,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_carb',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.bell_pepper_red', 'Red bell pepper', 'vegetable', cupFdc(1, 149), 1, 9, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.carrots', 'Carrots, cooked', 'vegetable', cupFdc(1, 156), 1, 12, 0, {
    fiber: 5,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'budget_friendly',
    ],
  }),
  food('food.tomato', 'Tomato, raw', 'vegetable', cupFdc(1, 180), 1, 7, 0, {
    fiber: 2,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_sodium',
      'quick_prep',
      'budget_friendly',
    ],
  }),
  food('food.cucumber', 'Cucumber, raw', 'vegetable', cupFdc(1, 104), 1, 4, 0, {
    fiber: 1,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_carb',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.lettuce_romaine', 'Romaine lettuce', 'vegetable', cupFdc(2, 94), 1, 3, 0, {
    fiber: 2,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_carb',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.cabbage', 'Cabbage, cooked', 'vegetable', cupFdc(1, 150), 2, 8, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'budget_friendly'],
  }),
  food('food.mushrooms', 'White mushrooms, cooked', 'vegetable', cupFdc(1, 156), 4, 8, 1, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'budget_friendly'],
  }),
  food('food.onion', 'Onion, raw', 'vegetable', cupFdc(1, 160), 2, 14, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'budget_friendly'],
  }),
  food('food.sweet_potato', 'Sweet potato, baked', 'vegetable', cupFdc(1, 200), 4, 41, 0, {
    fiber: 7,
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'budget_friendly',
    ],
  }),
  food('food.potato_baked', 'Potato, baked with skin', 'vegetable', piece1(173), 5, 37, 0, {
    fiber: 4,
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'budget_friendly',
    ],
  }),
  food('food.butternut_squash', 'Butternut squash, cooked', 'vegetable', cupFdc(1, 205), 2, 22, 0, {
    fiber: 7,
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
    ],
  }),
  food('food.beets', 'Beets, cooked', 'vegetable', cupFdc(1, 170), 3, 17, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'budget_friendly'],
  }),
  food('food.eggplant', 'Eggplant, cooked', 'vegetable', cupFdc(1, 99), 1, 9, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'low_carb'],
  }),
  food('food.celery', 'Celery, raw', 'vegetable', cupFdc(1, 101), 1, 3, 0, {
    fiber: 2,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_carb',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.bok_choy', 'Bok choy, cooked', 'vegetable', cupFdc(1, 170), 3, 3, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb', 'low_sodium'],
  }),
  food('food.swiss_chard', 'Swiss chard, cooked', 'vegetable', cupFdc(1, 175), 3, 7, 0, {
    fiber: 4,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'low_sodium'],
  }),
  food('food.collard_greens', 'Collard greens, cooked', 'vegetable', cupFdc(1, 190), 4, 11, 1, {
    fiber: 8,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'heart_healthy',
    ],
  }),
  food('food.artichoke', 'Artichoke, cooked', 'vegetable', piece1(120), 4, 14, 0, {
    fiber: 7,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'low_sodium'],
  }),
  food('food.okra', 'Okra, cooked', 'vegetable', cupFdc(1, 160), 3, 7, 0, {
    fiber: 4,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'low_sodium'],
  }),
  food('food.snap_peas', 'Sugar snap peas', 'vegetable', cupFdc(1, 98), 3, 7, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.corn', 'Sweet corn, cooked', 'vegetable', cupFdc(1, 149), 5, 31, 2, {
    fiber: 4,
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'budget_friendly',
    ],
  }),
  food('food.snow_peas', 'Snow peas, raw', 'vegetable', cupFdc(1, 98), 3, 7, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.pumpkin', 'Pumpkin, cooked', 'vegetable', cupFdc(1, 245), 2, 12, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.spaghetti_squash', 'Spaghetti squash, cooked', 'vegetable', cupFdc(1, 155), 1, 10, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb', 'low_sodium'],
  }),
  food('food.turnip', 'Turnip, cooked', 'vegetable', cupFdc(1, 156), 1, 8, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'budget_friendly'],
  }),
  food('food.parsnip', 'Parsnip, cooked', 'vegetable', cupFdc(1, 156), 2, 27, 0, {
    fiber: 6,
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
    ],
  }),
  food('food.radish', 'Radish, raw', 'vegetable', cupFdc(1, 116), 1, 4, 0, {
    fiber: 2,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_carb',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.arugula', 'Arugula, raw', 'vegetable', cupFdc(2, 40), 1, 1, 0, {
    fiber: 1,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_carb',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.watercress', 'Watercress, raw', 'vegetable', cupFdc(2, 68), 2, 1, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb', 'low_sodium'],
  }),
  food('food.leeks', 'Leeks, raw', 'vegetable', cupFdc(1, 89), 1, 13, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.fennel', 'Fennel bulb, raw', 'vegetable', cupFdc(1, 87), 1, 6, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'low_carb'],
  }),
  food('food.kohlrabi', 'Kohlrabi, cooked', 'vegetable', cupFdc(1, 165), 3, 11, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.acorn_squash', 'Acorn squash, cooked', 'vegetable', cupFdc(1, 205), 2, 30, 0, {
    fiber: 9,
    tags: [
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
    ],
  }),
  food('food.bell_pepper_green', 'Green bell pepper', 'vegetable', cupFdc(1, 149), 1, 7, 0, {
    fiber: 3,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_sodium',
      'quick_prep',
      'budget_friendly',
    ],
  }),
  food('food.cherry_tomatoes', 'Cherry tomatoes', 'vegetable', cupFdc(1, 149), 1, 6, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.mixed_greens', 'Mixed salad greens', 'vegetable', cup(2), 1, 2, 0, {
    fiber: 1,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_carb',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.sauerkraut', 'Sauerkraut', 'vegetable', cupFdc(1, 142), 1, 6, 0, {
    fiber: 4,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
    avoid: ['high_sodium_sensitive'],
    caution: 'Fermented — higher sodium.',
  }),
  food('food.portobello', 'Portobello mushroom, grilled', 'vegetable', piece1(84), 3, 5, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.spinach_raw', 'Spinach, raw', 'vegetable', cupFdc(2, 60), 2, 2, 0, {
    fiber: 1,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_carb',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.broccolini', 'Broccolini, cooked', 'vegetable', cup(1), 3, 8, 1, {
    fiber: 4,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'low_sodium'],
  }),
  food('food.jicama', 'Jicama, raw', 'vegetable', cupFdc(1, 130), 1, 11, 0, {
    fiber: 6,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.tomatillo', 'Tomatillo, raw', 'vegetable', cupFdc(1, 132), 1, 8, 1, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),

  // ── fruit (34) ───────────────────────────────────────────────────────
  food('food.apple', 'Apple, with skin', 'fruit', piece1(182), 1, 25, 0, {
    fiber: 4,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'budget_friendly',
      'quick_prep',
    ],
  }),
  food('food.banana', 'Banana', 'fruit', piece1(118), 1, 27, 0, {
    fiber: 3,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_sodium',
      'budget_friendly',
      'quick_prep',
    ],
  }),
  food('food.orange', 'Orange', 'fruit', piece1(131), 1, 15, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.strawberries', 'Strawberries', 'fruit', cupFdc(1, 166), 1, 12, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.blueberries', 'Blueberries', 'fruit', cupFdc(1, 148), 1, 21, 0, {
    fiber: 4,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'heart_healthy',
      'quick_prep',
    ],
  }),
  food('food.raspberries', 'Raspberries', 'fruit', cupFdc(1, 123), 1, 15, 1, {
    fiber: 8,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'low_sodium'],
  }),
  food('food.blackberries', 'Blackberries', 'fruit', cupFdc(1, 144), 2, 14, 1, {
    fiber: 8,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'low_sodium'],
  }),
  food('food.grapes', 'Grapes', 'fruit', cupFdc(1, 151), 1, 27, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.pineapple', 'Pineapple', 'fruit', cupFdc(1, 165), 1, 22, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.mango', 'Mango', 'fruit', cupFdc(1, 165), 1, 25, 1, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.watermelon', 'Watermelon', 'fruit', cupFdc(1, 154), 1, 11, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.cantaloupe', 'Cantaloupe', 'fruit', cupFdc(1, 160), 1, 13, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.peach', 'Peach', 'fruit', piece1(150), 1, 14, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.pear', 'Pear, with skin', 'fruit', piece1(178), 1, 27, 0, {
    fiber: 6,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'quick_prep',
    ],
  }),
  food('food.plum', 'Plum', 'fruit', piece1(66), 1, 8, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.kiwi', 'Kiwifruit', 'fruit', piece1(69), 1, 10, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.cherries', 'Cherries', 'fruit', cupFdc(1, 154), 2, 25, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.grapefruit', 'Grapefruit', 'fruit', piece1(123), 1, 13, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
    caution: 'May interact with some medications.',
  }),
  food('food.pomegranate', 'Pomegranate arils', 'fruit', cup(1), 3, 26, 2, {
    fiber: 6,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'low_sodium',
      'heart_healthy',
    ],
  }),
  food('food.avocado_fruit', 'Avocado', 'fruit', piece1(150), 3, 13, 22, {
    fiber: 10,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'healthy_fat',
      'high_fiber',
      'low_sodium',
      'heart_healthy',
    ],
  }),
  food('food.dates', 'Medjool dates', 'fruit', piece1(24), 0.5, 18, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food('food.figs_dried', 'Dried figs', 'fruit', g(40), 1, 25, 0, {
    fiber: 4,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'low_sodium'],
  }),
  food('food.raisins', 'Raisins', 'fruit', g(43), 1, 33, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'budget_friendly', 'quick_prep'],
  }),
  food('food.apricot', 'Apricots', 'fruit', piece1(70), 1, 8, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.clementine', 'Clementine', 'fruit', piece1(74), 1, 9, 0, {
    fiber: 1,
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_sodium',
      'quick_prep',
      'budget_friendly',
    ],
  }),
  food('food.honeydew', 'Honeydew melon', 'fruit', cupFdc(1, 177), 1, 16, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.papaya', 'Papaya', 'fruit', cupFdc(1, 145), 1, 16, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.nectarine', 'Nectarine', 'fruit', piece1(142), 1, 15, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.cranberries_dried', 'Dried cranberries, unsweetened', 'fruit', g(40), 0, 33, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food('food.guava', 'Guava', 'fruit', cupFdc(1, 165), 4, 24, 2, {
    fiber: 9,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber', 'low_sodium'],
  }),
  food('food.passion_fruit', 'Passion fruit', 'fruit', piece1(18), 0.4, 4, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.lychee', 'Lychee', 'fruit', cupFdc(1, 190), 1, 29, 0, {
    fiber: 2,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.starfruit', 'Starfruit', 'fruit', piece1(91), 1, 6, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'low_carb'],
  }),
  food('food.dragon_fruit', 'Dragon fruit', 'fruit', cup(1), 1, 13, 0, {
    fiber: 3,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),

  // ── dairy (26) ───────────────────────────────────────────────────────
  food('food.greek_yogurt_nonfat', 'Greek yogurt, nonfat, plain', 'dairy', g(170), 17, 6, 0, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.greek_yogurt_2pct', 'Greek yogurt, 2%, plain', 'dairy', g(170), 17, 6, 4, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.skyr', 'Skyr, plain', 'dairy', g(170), 17, 6, 0, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.cottage_cheese_lowfat', 'Cottage cheese, low-fat', 'dairy', g(113), 12, 5, 2, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive', 'high_sodium_sensitive'],
  }),
  food('food.milk_skim', 'Milk, skim', 'dairy', mlFdc(240, 248.5), 8, 12, 0, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'budget_friendly'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.milk_1pct', 'Milk, 1%', 'dairy', mlFdc(240, 247.5), 8, 12, 2, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'budget_friendly'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.milk_2pct', 'Milk, 2%', 'dairy', mlFdc(240, 247.5), 8, 12, 5, {
    tags: ['vegetarian', 'gluten_free', 'budget_friendly'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.yogurt_plain_lowfat', 'Yogurt, plain, low-fat', 'dairy', g(170), 9, 12, 3, {
    tags: ['vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.kefir_plain', 'Kefir, plain low-fat', 'dairy', mlFdc(240, 246.5), 9, 12, 2, {
    tags: ['high_protein', 'vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.cheddar', 'Cheddar cheese', 'dairy', g(28), 7, 1, 9, {
    tags: ['high_protein', 'vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive', 'high_sodium_sensitive'],
  }),
  food('food.mozzarella_part_skim', 'Mozzarella, part-skim', 'dairy', g(28), 7, 1, 5, {
    tags: ['high_protein', 'vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.parmesan', 'Parmesan cheese', 'dairy', tbspFdc(1, 5), 2, 0, 1, {
    tags: ['vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive', 'high_sodium_sensitive'],
  }),
  food('food.feta', 'Feta cheese', 'dairy', g(28), 4, 1, 6, {
    tags: ['vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive', 'high_sodium_sensitive'],
  }),
  food('food.swiss_cheese', 'Swiss cheese', 'dairy', g(28), 8, 1, 8, {
    tags: ['high_protein', 'vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.ricotta_part_skim', 'Ricotta, part-skim', 'dairy', g(62), 7, 3, 5, {
    tags: ['high_protein', 'vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.string_cheese', 'String cheese, part-skim', 'dairy', piece1(28), 7, 1, 5, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.cream_cheese_light', 'Cream cheese, light', 'dairy', tbspFdc(1, 15), 1, 1, 3, {
    tags: ['vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.almond_milk_unsweet', 'Almond milk, unsweetened', 'dairy', mlFdc(240, 265.8), 1, 1, 3, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb'],
    avoid: ['nut_allergy'],
  }),
  food('food.oat_milk_unsweet', 'Oat milk, unsweetened', 'dairy', ml(240), 3, 9, 5, {
    tags: ['vegan', 'vegetarian', 'dairy_free', 'heart_healthy'],
    avoid: ['gluten_sensitive'],
  }),
  food(
    'food.coconut_milk_beverage',
    'Coconut milk beverage, unsweetened',
    'dairy',
    ml(240),
    0,
    1,
    5,
    { tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb'] },
  ),
  food('food.cashew_milk_unsweet', 'Cashew milk, unsweetened', 'dairy', ml(240), 1, 1, 2, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb'],
    avoid: ['nut_allergy'],
  }),
  food('food.greek_yogurt_whole', 'Greek yogurt, whole milk, plain', 'dairy', g(170), 15, 7, 7, {
    tags: ['high_protein', 'vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.buttermilk_lowfat', 'Buttermilk, low-fat', 'dairy', mlFdc(240, 248.5), 8, 12, 2, {
    tags: ['vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.goat_cheese', 'Goat cheese, soft', 'dairy', g(28), 5, 0, 6, {
    tags: ['vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.cottage_cheese_nonfat', 'Cottage cheese, nonfat', 'dairy', g(113), 13, 6, 0, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'low_carb', 'quick_prep'],
    avoid: ['lactose_sensitive', 'high_sodium_sensitive'],
  }),
  food('food.provolone', 'Provolone cheese', 'dairy', g(28), 7, 1, 8, {
    tags: ['high_protein', 'vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive', 'high_sodium_sensitive'],
  }),

  // ── nuts_seeds (26) ──────────────────────────────────────────────────
  food('food.almonds', 'Almonds', 'nuts_seeds', g(28), 6, 6, 14, {
    fiber: 4,
    tags: [
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'heart_healthy',
      'quick_prep',
    ],
    avoid: ['nut_allergy'],
  }),
  food('food.walnuts', 'Walnuts', 'nuts_seeds', g(28), 4, 4, 18, {
    fiber: 2,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'heart_healthy'],
    avoid: ['nut_allergy'],
  }),
  food('food.cashews', 'Cashews', 'nuts_seeds', g(28), 5, 9, 12, {
    fiber: 1,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    avoid: ['nut_allergy'],
  }),
  food('food.pistachios', 'Pistachios', 'nuts_seeds', g(28), 6, 8, 13, {
    fiber: 3,
    tags: [
      'high_protein',
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'heart_healthy',
    ],
    avoid: ['nut_allergy'],
  }),
  food('food.pecans', 'Pecans', 'nuts_seeds', g(28), 3, 4, 20, {
    fiber: 3,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    avoid: ['nut_allergy'],
  }),
  food('food.hazelnuts', 'Hazelnuts', 'nuts_seeds', g(28), 4, 5, 17, {
    fiber: 3,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'heart_healthy'],
    avoid: ['nut_allergy'],
  }),
  food('food.brazil_nuts', 'Brazil nuts', 'nuts_seeds', g(28), 4, 3, 19, {
    fiber: 2,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    avoid: ['nut_allergy'],
    caution: 'Very high selenium — limit to a few per day.',
  }),
  food('food.macadamia', 'Macadamia nuts', 'nuts_seeds', g(28), 2, 4, 21, {
    fiber: 2,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb'],
    avoid: ['nut_allergy'],
  }),
  food('food.peanuts', 'Peanuts, dry-roasted', 'nuts_seeds', g(28), 7, 6, 14, {
    fiber: 2,
    tags: [
      'high_protein',
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'budget_friendly',
    ],
    avoid: ['nut_allergy'],
  }),
  food('food.peanut_butter', 'Peanut butter, natural', 'nuts_seeds', tbspFdc(2, 32), 7, 7, 16, {
    fiber: 2,
    tags: [
      'high_protein',
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'budget_friendly',
      'quick_prep',
    ],
    avoid: ['nut_allergy'],
  }),
  food('food.almond_butter', 'Almond butter, natural', 'nuts_seeds', tbspFdc(2, 32), 7, 6, 18, {
    fiber: 3,
    tags: [
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'heart_healthy',
      'quick_prep',
    ],
    avoid: ['nut_allergy'],
  }),
  food('food.chia_seeds', 'Chia seeds', 'nuts_seeds', tbsp(2), 4, 10, 8, {
    fiber: 8,
    tags: [
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
    ],
  }),
  food('food.flax_seeds', 'Ground flaxseed', 'nuts_seeds', tbsp(2), 3, 6, 8, {
    fiber: 6,
    tags: [
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
    ],
  }),
  food('food.pumpkin_seeds', 'Pumpkin seeds', 'nuts_seeds', g(28), 9, 3, 14, {
    fiber: 2,
    tags: ['high_protein', 'healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.sunflower_seeds', 'Sunflower seeds', 'nuts_seeds', g(28), 6, 6, 14, {
    fiber: 3,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'budget_friendly'],
  }),
  food('food.sesame_seeds', 'Sesame seeds', 'nuts_seeds', tbspFdc(2, 18), 3, 4, 9, {
    fiber: 2,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.hemp_seeds', 'Hemp seeds', 'nuts_seeds', tbspFdc(2, 20), 6, 2, 9, {
    fiber: 1,
    tags: [
      'high_protein',
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'heart_healthy',
    ],
  }),
  food('food.tahini', 'Tahini', 'nuts_seeds', tbspFdc(2, 30), 5, 6, 16, {
    fiber: 3,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.cashew_butter', 'Cashew butter', 'nuts_seeds', tbspFdc(2, 32), 5, 9, 16, {
    fiber: 1,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
    avoid: ['nut_allergy'],
  }),
  food('food.pine_nuts', 'Pine nuts', 'nuts_seeds', g(28), 4, 4, 19, {
    fiber: 1,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    avoid: ['nut_allergy'],
  }),
  food('food.mixed_nuts', 'Mixed nuts, unsalted', 'nuts_seeds', g(28), 5, 6, 15, {
    fiber: 2,
    tags: [
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'heart_healthy',
      'quick_prep',
    ],
    avoid: ['nut_allergy'],
  }),
  food('food.sunflower_butter', 'Sunflower seed butter', 'nuts_seeds', tbspFdc(2, 32), 6, 7, 16, {
    fiber: 3,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food('food.roasted_chickpeas', 'Roasted chickpea snack', 'nuts_seeds', g(30), 5, 15, 3, {
    fiber: 4,
    tags: [
      'high_protein',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'quick_prep',
    ],
  }),
  food('food.pepitas', 'Pepitas (hulled pumpkin seeds)', 'nuts_seeds', g(28), 9, 4, 13, {
    fiber: 2,
    tags: ['high_protein', 'healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.poppy_seeds', 'Poppy seeds', 'nuts_seeds', tspFdc(1, 2.8), 1, 1, 1, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.coconut_flakes', 'Coconut flakes, unsweetened', 'nuts_seeds', g(28), 2, 7, 18, {
    fiber: 5,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'high_fiber'],
  }),

  // ── fat_oil (14) ─────────────────────────────────────────────────────
  food('food.olive_oil', 'Extra virgin olive oil', 'fat_oil', tbspFdc(1, 13.5), 0, 0, 14, {
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'heart_healthy'],
  }),
  food('food.avocado_oil', 'Avocado oil', 'fat_oil', tbspFdc(1, 14), 0, 0, 14, {
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'heart_healthy'],
  }),
  food('food.canola_oil', 'Canola oil', 'fat_oil', tbspFdc(1, 14), 0, 0, 14, {
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'budget_friendly'],
  }),
  food('food.flaxseed_oil', 'Flaxseed oil', 'fat_oil', tbspFdc(1, 13.6), 0, 0, 14, {
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'heart_healthy'],
  }),
  food('food.walnut_oil', 'Walnut oil', 'fat_oil', tbspFdc(1, 13.6), 0, 0, 14, {
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'heart_healthy'],
    avoid: ['nut_allergy'],
  }),
  food('food.sesame_oil', 'Sesame oil', 'fat_oil', tbspFdc(1, 13.6), 0, 0, 14, {
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.avocado_half', 'Avocado, half', 'fat_oil', piece1(75), 1, 6, 11, {
    fiber: 5,
    tags: [
      'healthy_fat',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
    ],
  }),
  food('food.olives_black', 'Black olives', 'fat_oil', g(30), 0, 2, 3, {
    fiber: 1,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    avoid: ['high_sodium_sensitive'],
    caution: 'Brined — higher sodium.',
  }),
  food('food.olives_green', 'Green olives', 'fat_oil', g(30), 0, 1, 4, {
    fiber: 1,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    avoid: ['high_sodium_sensitive'],
    caution: 'Brined — higher sodium.',
  }),
  food('food.guacamole', 'Guacamole', 'fat_oil', g(60), 1, 5, 8, {
    fiber: 4,
    tags: ['healthy_fat', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food('food.coconut_oil', 'Coconut oil', 'fat_oil', tbspFdc(1, 13.6), 0, 0, 14, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    caution: 'High in saturated fat — use in moderation.',
  }),
  food('food.butter', 'Butter', 'fat_oil', g(5), 0, 0, 4, {
    tags: ['vegetarian', 'gluten_free'],
    avoid: ['lactose_sensitive'],
    caution: 'High in saturated fat — use in moderation.',
  }),
  food('food.ghee', 'Ghee', 'fat_oil', g(5), 0, 0, 5, {
    tags: ['vegetarian', 'gluten_free'],
    caution: 'High in saturated fat — use in moderation.',
  }),
  food('food.mct_oil', 'MCT oil', 'fat_oil', tbsp(1), 0, 0, 14, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb'],
  }),

  // ── beverage (12) ────────────────────────────────────────────────────
  food('food.green_tea', 'Green tea, unsweetened', 'beverage', mlFdc(240, 240.2), 0, 0, 0, {
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_sodium',
      'heart_healthy',
      'quick_prep',
    ],
  }),
  food('food.black_coffee', 'Coffee, black', 'beverage', mlFdc(240, 240.2), 0, 0, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.herbal_tea', 'Herbal tea, unsweetened', 'beverage', mlFdc(240, 240.2), 0, 0, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.sparkling_water', 'Sparkling water, unsweetened', 'beverage', mlFdc(240, 240.2), 0, 0, 0, {
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_sodium',
      'quick_prep',
      'budget_friendly',
    ],
  }),
  food('food.tomato_juice_lowsodium', 'Tomato juice, low-sodium', 'beverage', mlFdc(240, 246.5), 2, 10, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.orange_juice', 'Orange juice, 100%', 'beverage', mlFdc(240, 251.6), 2, 26, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food(
    'food.vegetable_juice_lowsodium',
    'Vegetable juice, low-sodium',
    'beverage',
    mlFdc(240, 245.5),
    2,
    11,
    0,
    { fiber: 2, tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'] },
  ),
  food('food.coconut_water', 'Coconut water, unsweetened', 'beverage', mlFdc(240, 248.5), 2, 9, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
  }),
  food('food.protein_shake_water', 'Whey protein shake (water)', 'beverage', ml(300), 25, 3, 2, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.vegan_protein_shake', 'Plant protein shake (water)', 'beverage', ml(300), 24, 4, 2, {
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food('food.matcha_unsweet', 'Matcha, unsweetened', 'beverage', ml(240), 1, 1, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'heart_healthy'],
  }),
  food('food.kombucha_unsweet', 'Kombucha, low-sugar', 'beverage', ml(240), 0, 7, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),

  // ── condiment (14) ───────────────────────────────────────────────────
  food('food.mustard', 'Mustard, yellow', 'condiment', tspFdc(1, 5), 0, 0, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb', 'quick_prep'],
  }),
  food('food.salsa', 'Salsa, tomato', 'condiment', tbspFdc(2, 36), 0, 2, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb', 'quick_prep'],
  }),
  food('food.balsamic_vinegar', 'Balsamic vinegar', 'condiment', tbspFdc(1, 16), 0, 3, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.hot_sauce', 'Hot sauce', 'condiment', tspFdc(1, 4.7), 0, 0, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_carb', 'quick_prep'],
    avoid: ['high_sodium_sensitive'],
  }),
  food(
    'food.soy_sauce_low_sodium',
    'Soy sauce, low-sodium',
    'condiment',
    tbspFdc(1, 14.2),
    1,
    1,
    0,
    {
      tags: ['vegan', 'vegetarian', 'dairy_free', 'quick_prep'],
      avoid: ['gluten_sensitive', 'high_sodium_sensitive'],
      caution: 'Still high in sodium.',
    },
  ),
  food('food.pesto', 'Basil pesto', 'condiment', tbspFdc(1, 16), 1, 1, 8, {
    tags: ['vegetarian', 'gluten_free', 'healthy_fat'],
    avoid: ['nut_allergy', 'lactose_sensitive'],
  }),
  food('food.nutritional_yeast', 'Nutritional yeast', 'condiment', tbsp(1), 2, 1, 0, {
    fiber: 1,
    tags: ['high_protein', 'vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'quick_prep'],
  }),
  food('food.tomato_paste', 'Tomato paste, no salt added', 'condiment', tbspFdc(2, 32), 1, 6, 0, {
    fiber: 1,
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium'],
  }),
  food('food.apple_cider_vinegar', 'Apple cider vinegar', 'condiment', tbspFdc(1, 14.9), 0, 0, 0, {
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_sodium',
      'low_carb',
      'quick_prep',
    ],
  }),
  food('food.lemon_juice', 'Lemon juice, fresh', 'condiment', tbspFdc(1, 15.25), 0, 1, 0, {
    tags: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'low_sodium',
      'low_carb',
      'quick_prep',
    ],
  }),
  food('food.garlic', 'Garlic, raw', 'condiment', tspFdc(1, 2.8), 0, 1, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.ginger', 'Ginger, fresh grated', 'condiment', tspFdc(1, 2), 0, 0, 0, {
    tags: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'low_sodium', 'quick_prep'],
  }),
  food('food.greek_yogurt_dressing', 'Greek yogurt herb dressing', 'condiment', tbsp(2), 2, 2, 1, {
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
  }),
  food('food.tzatziki', 'Tzatziki', 'condiment', tbspFdc(2, 30), 1, 2, 1, {
    tags: ['vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
  }),

  // ── composite (10) ───────────────────────────────────────────────────
  food(
    'food.overnight_oats',
    'Overnight oats (oats, milk, berries)',
    'composite',
    g(250),
    12,
    40,
    8,
    {
      fiber: 7,
      tags: [
        'high_protein',
        'complex_carb',
        'vegetarian',
        'high_fiber',
        'heart_healthy',
        'quick_prep',
      ],
      avoid: ['lactose_sensitive', 'gluten_sensitive'],
      srcNote: 'Estimated from component USDA references (oats + milk + berries).',
    },
  ),
  food('food.greek_yogurt_berry_bowl', 'Greek yogurt berry bowl', 'composite', g(250), 20, 25, 4, {
    fiber: 4,
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'quick_prep'],
    avoid: ['lactose_sensitive'],
    srcNote: 'Estimated from component USDA references (yogurt + berries + honey).',
  }),
  food(
    'food.chicken_rice_veg_bowl',
    'Chicken, rice & vegetable bowl',
    'composite',
    g(400),
    35,
    45,
    10,
    {
      fiber: 6,
      tags: ['high_protein', 'complex_carb', 'gluten_free', 'dairy_free', 'high_fiber'],
      srcNote: 'Estimated from component USDA references (chicken + rice + vegetables + oil).',
    },
  ),
  food('food.tofu_stir_fry', 'Tofu vegetable stir-fry', 'composite', g(350), 20, 30, 14, {
    fiber: 7,
    tags: ['high_protein', 'vegan', 'vegetarian', 'dairy_free', 'high_fiber'],
    avoid: ['gluten_sensitive'],
    srcNote: 'Estimated from component USDA references (tofu + vegetables + soy sauce + oil).',
  }),
  food('food.lentil_soup', 'Lentil vegetable soup', 'composite', g(350), 15, 40, 4, {
    fiber: 12,
    tags: [
      'high_protein',
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'heart_healthy',
      'budget_friendly',
    ],
    srcNote: 'Estimated from component USDA references (lentils + vegetables + oil).',
  }),
  food('food.turkey_chili', 'Turkey & bean chili', 'composite', g(350), 28, 30, 10, {
    fiber: 10,
    tags: ['high_protein', 'gluten_free', 'dairy_free', 'high_fiber'],
    srcNote: 'Estimated from component USDA references (turkey + beans + tomato + vegetables).',
  }),
  food('food.salmon_quinoa_bowl', 'Salmon quinoa bowl', 'composite', g(400), 32, 40, 18, {
    fiber: 6,
    tags: [
      'high_protein',
      'complex_carb',
      'healthy_fat',
      'gluten_free',
      'dairy_free',
      'heart_healthy',
      'high_fiber',
    ],
    srcNote: 'Estimated from component USDA references (salmon + quinoa + vegetables + oil).',
  }),
  food('food.veggie_burrito_bowl', 'Bean & veggie burrito bowl', 'composite', g(400), 18, 55, 12, {
    fiber: 14,
    tags: [
      'high_protein',
      'complex_carb',
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'high_fiber',
      'budget_friendly',
    ],
    srcNote: 'Estimated from component USDA references (beans + rice + vegetables + avocado).',
  }),
  food('food.egg_veggie_scramble', 'Egg & vegetable scramble', 'composite', g(220), 18, 8, 14, {
    fiber: 3,
    tags: ['high_protein', 'vegetarian', 'gluten_free', 'quick_prep'],
    srcNote: 'Estimated from component USDA references (eggs + vegetables + oil).',
  }),
  food('food.tuna_salad_greens', 'Tuna salad over greens', 'composite', g(250), 26, 10, 12, {
    fiber: 4,
    tags: ['high_protein', 'gluten_free', 'dairy_free', 'quick_prep'],
    srcNote: 'Estimated from component USDA references (tuna + greens + olive oil).',
  }),
];
