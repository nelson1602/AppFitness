import type { AvoidTag, FoodId } from '@/features/nutrition/domain/food-catalog';

/**
 * "Alimentación" in the Evaluación física (design README step 3, ADR-P040 D3/D4).
 *
 * Each item the person can mark names the catalog foods it removes. Matching
 * is by catalog key, never by substring (ADR-P040 D3): an item lists every
 * catalog food that is or contains it, including mixed dishes, so marking
 * "Huevo" as an allergy also blocks logging an omelette. "Otras restricciones"
 * are product-level avoid tags (ADR-P040 D4) and exclude whole products.
 *
 * `food-groups.spec.ts` proves every key exists in the bundled catalog, so a
 * catalog change cannot silently strand an item.
 */
export type FoodGroupId =
  | 'fruits'
  | 'vegetables'
  | 'meat'
  | 'seafood'
  | 'dairy'
  | 'grains'
  | 'legumes'
  | 'nuts'
  | 'roots'
  | 'other';

export type FoodItemTarget =
  { kind: 'catalog'; keys: readonly FoodId[] } | { kind: 'tag'; tag: AvoidTag };

export interface FoodGroupItem {
  /** Stable, language-neutral id; copy lives at `evaluation.food.item.<id>`. */
  id: string;
  target: FoodItemTarget;
}

export interface FoodGroup {
  id: FoodGroupId;
  items: readonly FoodGroupItem[];
}

const keys = (...ids: string[]): FoodItemTarget => ({ kind: 'catalog', keys: ids as FoodId[] });
const tag = (value: AvoidTag): FoodItemTarget => ({ kind: 'tag', tag: value });

export const FOOD_GROUPS: readonly FoodGroup[] = [
  {
    id: 'fruits',
    items: [
      { id: 'banana', target: keys('food.banana') },
      { id: 'apple', target: keys('food.apple') },
      {
        id: 'strawberries',
        target: keys('food.strawberries', 'food.greek_yogurt_berry_bowl'),
      },
      {
        id: 'blueberries',
        target: keys('food.blueberries', 'food.cranberries_dried', 'food.greek_yogurt_berry_bowl'),
      },
      { id: 'pineapple', target: keys('food.pineapple') },
      { id: 'papaya', target: keys('food.papaya') },
      { id: 'mango', target: keys('food.mango') },
      { id: 'orange', target: keys('food.orange', 'food.orange_juice') },
      { id: 'watermelon', target: keys('food.watermelon') },
      { id: 'kiwi', target: keys('food.kiwi') },
      { id: 'grapes', target: keys('food.grapes', 'food.raisins') },
      { id: 'passion_fruit', target: keys('food.passion_fruit') },
    ],
  },
  {
    id: 'vegetables',
    items: [
      { id: 'broccoli', target: keys('food.broccoli', 'food.broccolini') },
      { id: 'spinach', target: keys('food.spinach', 'food.spinach_raw') },
      { id: 'lettuce', target: keys('food.lettuce_romaine', 'food.mixed_greens') },
      {
        id: 'tomato',
        target: keys(
          'food.tomato',
          'food.cherry_tomatoes',
          'food.tomato_paste',
          'food.tomato_juice_lowsodium',
          'food.vegetable_juice_lowsodium',
          'food.salsa',
        ),
      },
      { id: 'peppers', target: keys('food.bell_pepper_red', 'food.bell_pepper_green') },
      { id: 'carrot', target: keys('food.carrots') },
      { id: 'cucumber', target: keys('food.cucumber', 'food.tzatziki') },
      { id: 'cauliflower', target: keys('food.cauliflower') },
      { id: 'eggplant', target: keys('food.eggplant') },
      { id: 'onion', target: keys('food.onion', 'food.salsa') },
      { id: 'pumpkin', target: keys('food.pumpkin', 'food.butternut_squash') },
    ],
  },
  {
    id: 'meat',
    items: [
      {
        id: 'chicken',
        target: keys(
          'food.chicken_breast',
          'food.chicken_thigh',
          'food.chicken_drumstick',
          'food.chicken_deli',
          'food.chicken_liver',
          'food.roast_chicken',
          'food.chicken_rice_veg_bowl',
        ),
      },
      {
        id: 'turkey',
        target: keys(
          'food.turkey_breast',
          'food.ground_turkey_lean',
          'food.turkey_deli',
          'food.turkey_chili',
        ),
      },
      {
        id: 'beef',
        target: keys(
          'food.beef_flank',
          'food.beef_sirloin',
          'food.beef_tenderloin',
          'food.ground_beef_lean',
        ),
      },
      {
        id: 'pork',
        target: keys(
          'food.pork_loin_chop',
          'food.pork_shoulder_lean',
          'food.pork_tenderloin',
          'food.canadian_bacon',
        ),
      },
      {
        id: 'fish',
        target: keys(
          'food.cod',
          'food.haddock',
          'food.halibut',
          'food.mackerel',
          'food.pollock',
          'food.rainbow_trout',
          'food.sardines_canned',
          'food.tilapia',
        ),
      },
      {
        id: 'tuna',
        target: keys(
          'food.ahi_tuna_seared',
          'food.tuna_canned_water',
          'food.tuna_yellowfin',
          'food.tuna_salad_greens',
        ),
      },
      {
        id: 'salmon',
        target: keys('food.salmon_atlantic', 'food.salmon_sockeye', 'food.salmon_quinoa_bowl'),
      },
      {
        id: 'egg',
        target: keys(
          'food.egg_whole',
          'food.egg_white',
          'food.eggs_two_large',
          'food.egg_omelette_plain',
          'food.egg_veggie_scramble',
        ),
      },
    ],
  },
  {
    id: 'seafood',
    items: [
      { id: 'shrimp', target: keys('food.shrimp') },
      { id: 'lobster', target: keys('food.lobster') },
      { id: 'crab', target: keys('food.crab') },
      { id: 'octopus', target: keys('food.octopus') },
      { id: 'conch', target: keys('food.conch') },
      { id: 'clams_mussels', target: keys('food.clams', 'food.mussels') },
    ],
  },
  {
    id: 'dairy',
    items: [
      {
        id: 'milk',
        target: keys(
          'food.milk_1pct',
          'food.milk_2pct',
          'food.milk_skim',
          'food.buttermilk_lowfat',
          'food.kefir_plain',
        ),
      },
      {
        id: 'yogurt',
        target: keys(
          'food.yogurt_plain_lowfat',
          'food.greek_yogurt_2pct',
          'food.greek_yogurt_nonfat',
          'food.greek_yogurt_whole',
          'food.greek_yogurt_berry_bowl',
          'food.greek_yogurt_dressing',
          'food.skyr',
          'food.tzatziki',
        ),
      },
      {
        id: 'cheese',
        target: keys(
          'food.cheddar',
          'food.cottage_cheese_lowfat',
          'food.cottage_cheese_nonfat',
          'food.cream_cheese_light',
          'food.feta',
          'food.goat_cheese',
          'food.mozzarella_part_skim',
          'food.parmesan',
          'food.provolone',
          'food.ricotta_part_skim',
          'food.string_cheese',
          'food.swiss_cheese',
          'food.pesto',
        ),
      },
      { id: 'whey', target: keys('food.protein_shake_water') },
      { id: 'butter', target: keys('food.butter', 'food.ghee') },
    ],
  },
  {
    id: 'grains',
    items: [
      {
        id: 'wheat',
        target: keys(
          'food.whole_wheat_bread',
          'food.sourdough_bread',
          'food.ezekiel_bread',
          'food.whole_wheat_pasta',
          'food.whole_wheat_tortilla',
          'food.couscous_whole',
          'food.bulgur',
          'food.farro',
          'food.seitan',
          'food.shredded_wheat',
          'food.muesli',
        ),
      },
      {
        id: 'pasta',
        target: keys(
          'food.whole_wheat_pasta',
          'food.brown_rice_pasta',
          'food.chickpea_pasta',
          'food.lentil_pasta',
        ),
      },
      {
        id: 'oats',
        target: keys(
          'food.oats_rolled',
          'food.steel_cut_oats',
          'food.oat_bran',
          'food.overnight_oats',
          'food.muesli',
          'food.oat_milk_unsweet',
        ),
      },
      { id: 'barley', target: keys('food.barley') },
      { id: 'rye', target: keys('food.rye_bread') },
      {
        id: 'rice',
        target: keys(
          'food.white_rice',
          'food.brown_rice',
          'food.basmati_rice',
          'food.jasmine_rice',
          'food.rice_cakes',
          'food.brown_rice_pasta',
          'food.chicken_rice_veg_bowl',
          'food.veggie_burrito_bowl',
        ),
      },
      { id: 'quinoa', target: keys('food.quinoa', 'food.salmon_quinoa_bowl') },
      {
        id: 'corn',
        target: keys('food.corn', 'food.corn_tortilla', 'food.polenta', 'food.popcorn_air'),
      },
    ],
  },
  {
    id: 'legumes',
    items: [
      {
        id: 'beans',
        target: keys(
          'food.black_beans',
          'food.kidney_beans',
          'food.pinto_beans',
          'food.navy_beans',
          'food.cannellini_beans',
          'food.great_northern_beans',
          'food.refried_beans_nonfat',
          'food.adzuki_beans',
          'food.mung_beans',
          'food.lima_beans',
          'food.fava_beans',
          'food.black_bean_burger',
          'food.turkey_chili',
          'food.veggie_burrito_bowl',
        ),
      },
      {
        id: 'lentils',
        target: keys(
          'food.lentils_brown',
          'food.lentils_green',
          'food.lentils_red',
          'food.lentil_pasta',
          'food.lentil_soup',
        ),
      },
      {
        id: 'chickpeas',
        target: keys(
          'food.chickpeas',
          'food.roasted_chickpeas',
          'food.hummus',
          'food.falafel',
          'food.chickpea_pasta',
        ),
      },
      { id: 'pigeon_peas', target: keys('food.pigeon_peas') },
      {
        id: 'soy',
        target: keys(
          'food.soybeans',
          'food.edamame',
          'food.roasted_edamame',
          'food.tofu_firm',
          'food.tofu_silken',
          'food.tofu_stir_fry',
          'food.tempeh',
          'food.natto',
          'food.soy_milk_unsweet',
          'food.soy_yogurt_plain',
          'food.soy_protein_isolate',
          'food.soy_curls',
          'food.textured_vegetable_protein',
          'food.veggie_ground_soy',
          'food.soy_sauce_low_sodium',
        ),
      },
      { id: 'peanut', target: keys('food.peanuts', 'food.peanut_butter') },
    ],
  },
  {
    id: 'nuts',
    items: [
      {
        id: 'almonds',
        target: keys(
          'food.almonds',
          'food.almond_butter',
          'food.almond_milk_unsweet',
          'food.mixed_nuts',
        ),
      },
      {
        id: 'walnuts',
        target: keys('food.walnuts', 'food.walnut_oil', 'food.pecans', 'food.mixed_nuts'),
      },
      {
        id: 'cashews',
        target: keys(
          'food.cashews',
          'food.cashew_butter',
          'food.cashew_milk_unsweet',
          'food.mixed_nuts',
        ),
      },
      { id: 'pistachios', target: keys('food.pistachios', 'food.mixed_nuts') },
      {
        id: 'sesame',
        target: keys('food.sesame_seeds', 'food.sesame_oil', 'food.tahini', 'food.hummus'),
      },
      { id: 'chia', target: keys('food.chia_seeds') },
      { id: 'flax', target: keys('food.flax_seeds', 'food.flaxseed_oil') },
    ],
  },
  {
    id: 'roots',
    items: [
      { id: 'plantain', target: keys('food.plantain_boiled', 'food.tostones') },
      { id: 'cassava', target: keys('food.cassava_cooked') },
      { id: 'sweet_potato', target: keys('food.sweet_potato') },
      { id: 'potato', target: keys('food.potato_baked') },
      { id: 'yam', target: keys('food.yam_cooked') },
      { id: 'yautia', target: keys('food.yautia_raw') },
    ],
  },
  {
    id: 'other',
    items: [
      { id: 'high_sodium', target: tag('high_sodium_sensitive') },
      { id: 'high_purine', target: tag('high_purine') },
      { id: 'added_sugar', target: tag('added_sugar') },
      { id: 'alcohol', target: tag('alcohol') },
      { id: 'caffeine', target: tag('caffeine') },
      { id: 'fried', target: tag('fried') },
    ],
  },
];

export const FOOD_ITEMS: ReadonlyMap<string, FoodGroupItem> = new Map(
  FOOD_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item] as const)),
);

/** Every catalog key the wizard can write; rows outside it are left alone. */
export const WIZARD_CATALOG_KEYS: ReadonlySet<string> = new Set(
  FOOD_GROUPS.flatMap((group) =>
    group.items.flatMap((item) => (item.target.kind === 'catalog' ? item.target.keys : [])),
  ),
);

/** Every avoid tag the wizard can write. */
export const WIZARD_AVOID_TAGS: ReadonlySet<string> = new Set(
  FOOD_GROUPS.flatMap((group) =>
    group.items.flatMap((item) => (item.target.kind === 'tag' ? [item.target.tag] : [])),
  ),
);
