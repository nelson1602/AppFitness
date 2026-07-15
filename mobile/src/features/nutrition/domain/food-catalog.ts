/**
 * Static healthy-food catalog types (Phase 15 Slice 2).
 *
 * The catalog is bundled, read-only reference data — NOT user data. It has
 * no SQLite/sync/backend and is never fetched at runtime. It feeds the
 * deterministic 15-day meal generator (Slice 3).
 *
 * Provenance: values are standard reference macros (USDA FoodData Central
 * based), rounded; per-item `calories` is the Atwater estimate
 * (4·protein + 4·carbs + 9·fat) of those macros so the catalog is
 * internally consistent for macro-summed meal planning. `source.note`
 * states this honestly — no fabricated database ids or false precision.
 *
 * Descriptive only: tags are factual attributes, never medical, cure,
 * prevention, or unsafe-diet claims.
 */

export type FoodId = string;

export type ServingUnit = 'g' | 'ml' | 'piece' | 'cup' | 'tbsp' | 'tsp' | 'slice';

export type FoodCategory =
  | 'protein_animal'
  | 'protein_plant'
  | 'grain'
  | 'legume'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'nuts_seeds'
  | 'fat_oil'
  | 'beverage'
  | 'condiment'
  | 'composite';

export type FoodTag =
  | 'high_protein'
  | 'low_carb'
  | 'complex_carb'
  | 'healthy_fat'
  | 'vegan'
  | 'vegetarian'
  | 'gluten_free'
  | 'dairy_free'
  | 'heart_healthy'
  | 'low_sodium'
  | 'high_fiber'
  | 'budget_friendly'
  | 'quick_prep';

export type AvoidTag =
  | 'nut_allergy'
  | 'shellfish_allergy'
  | 'gluten_sensitive'
  | 'lactose_sensitive'
  | 'high_sodium_sensitive'
  | 'high_purine';

export interface ServingSize {
  amount: number;
  unit: ServingUnit;
  /**
   * Gram weight of ONE FULL SERVING where a valid, authored conversion exists
   * for a NON-gram unit — e.g. one `piece` = N grams, or a 2-`slice` serving =
   * N grams total. Never fabricated: set only where the source weight is known
   * (part 1: the weight already authored in `amount`; ADR-P013 batches: the
   * pinned USDA-FDC portion in catalog/fdc-portion-manifest.json). For
   * `unit: 'g'` the amount is already grams, so this is omitted.
   */
  grams?: number;
}

export interface FoodSource {
  /** Reference source, e.g. 'USDA FoodData Central'. */
  ref: string;
  note?: string;
}

export interface FoodItem {
  id: FoodId;
  name: string;
  category: FoodCategory;
  servingSize: ServingSize;
  /** Per serving. Atwater estimate of the macros below (see file header). */
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  tags: FoodTag[];
  avoidFor?: AvoidTag[];
  caution?: string;
  /** Locale-ready: canonical English `name` above + optional i18n key. */
  display?: { nameKey?: string };
  source: FoodSource;
}

/**
 * Bump on ANY change to the catalog data or shape (traceability).
 * 1.1.0 (TECHDEBT-004 risk 3, split-risk part 1): normalized the 29 count-unit
 * `piece` foods whose authored amount was already a one-piece gram weight to
 * `{amount: 1, unit: 'piece', grams: <weight>}` as new immutable revisions (2).
 * 1.2.0 (ADR-P013 Batch 1): sourced full-serving gram weights for 4 `slice`
 * foods from the pinned USDA-FDC SR Legacy archive (see
 * infrastructure/catalog/fdc-portion-manifest.json); new immutable revisions
 * (2). `sourdough_bread` stays null/gated (no reconciling FDC portion).
 * 1.3.0 (ADR-P013 Batch 2): sourced full-serving gram weights for 13
 * tablespoon foods from the same pinned USDA-FDC SR Legacy archive; new
 * immutable revisions (2). Ambiguous tsp servings and non-reconciling tbsp/tsp
 * foods stay null/gated.
 * 1.3.1 (ADR-P013 tsp semantics mini-slice): corrected the six ambiguous
 * `tsp(N)` foods whose authored amount encoded grams, not teaspoon counts.
 * Butter/ghee become gram servings; mustard/hot sauce/garlic/ginger become
 * one-teaspoon servings with FDC-sourced gram weights.
 * 1.4.0 (ADR-P013 Batch 3A): sourced full-serving gram weights for 26
 * cup-served grains, legumes, and staple foods from the same pinned USDA-FDC
 * SR Legacy archive; varietals/preparations without exact reconciling SR rows
 * stay null/gated.
 * 1.5.0 (ADR-P013 Batch 3B): sourced full-serving gram weights for 42
 * cup-served vegetables from the same pinned USDA-FDC SR Legacy archive; new
 * immutable revisions (2). onion/leeks (reconciliation failure), snow_peas
 * (cooked record fails the gate), mixed_greens (ambiguous), and broccolini
 * (no SR record) stay null/gated.
 * 1.6.0 (ADR-P013 Batch 3C): sourced full-serving gram weights for 14
 * cup-served fruits from the same pinned USDA-FDC SR Legacy archive; new
 * immutable revisions (2). pomegranate (carbs reconciliation failure) and
 * dragon_fruit (no SR record) stay null/gated.
 * 1.7.0 (ADR-P013 Batch 4): sourced full-serving gram weights for 8 of the
 * remaining tbsp foods (6 oils, light cream cheese, tomato paste) after
 * re-verification disproved Batch 2's unmatched reasons for them (SR
 * "Oil, <name>" naming missed; tomato-paste gate failure not reproducible).
 * chia/flax/poppy/mct/pesto/nutritional_yeast/greek_yogurt_dressing/tzatziki
 * stay gated (reasons re-verified); lemon_juice's reason corrected (raw
 * record exists but has no tbsp portion — density-batch candidate);
 * apple_cider_vinegar stays policy-pending.
 * 1.8.0 (ADR-P013 Batch 5): density-derived full-serving gram weights for 11
 * ml foods from volume-paired portions in the same pinned USDA-FDC SR Legacy
 * archive (density = gramWeight / sourceVolumeMl; never assumed 1 g/ml); new
 * immutable revisions (2). pea/oat/cashew milk, coconut-milk beverage,
 * protein shakes, matcha, kombucha stay gated (no reconciling SR record);
 * green_tea/black_coffee/herbal_tea/sparkling_water join apple_cider_vinegar
 * in the zero-macro policy class, pending the owner decision.
 * 1.9.0 (ADR-P013 Batch 6): zero-macro policy resolved by the owner
 * (2026-07-14) — sourced the 5 zero-macro foods from their pre-recorded SR
 * candidates: 4 beverages density-derived (fl-oz portions, 1.0009 g/ml) and
 * apple_cider_vinegar via its direct tbsp portion (14.9 g). New immutable
 * revisions (2). Gram entry on zero-macro foods scales zeros — harmless by
 * design.
 * 1.10.0 (ADR-P013 Batch 7, lemon_juice density mini-batch): density-derived
 * the 1-tbsp serving of food.lemon_juice from SR "Lemon juice, raw" (167747),
 * whose cup and fl-oz volume pairings independently give 1.0313 g/ml
 * (1 tbsp = 14.7868 ml -> 15.25 g). New immutable revision (2).
 * 1.10.1 (ADR-P013 poppy-seeds serving-semantics correction slice): the
 * authored macros of food.poppy_seeds (1/1/1 g, 17 kcal) are teaspoon-scale —
 * they fail SR "Spices, poppy seed" (171330) at the 1-tbsp portion (8.8 g,
 * est 46.2 kcal) but reconcile at the 1-tsp portion (2.8 g, est 14.7 kcal).
 * Serving corrected tbsp(1) -> tsp(1) with the SR tsp gram weight (same
 * pattern as the 1.3.1 tsp semantics mini-slice); macros unchanged. New
 * immutable revision (2).
 * 1.11.0 (ADR-P013 Amendment A1 Batch F1): first FNDDS batch — matched the 16
 * gated cup foods against the pinned FNDDS 2021-2023 archive
 * (fndds_survey_food_csv_2024-10-31). One match: food.polenta -> FNDDS
 * "Cornmeal mush, no added fat" (2708374, officially attribute-tagged
 * "polenta"), 1 cup cooked = 240 g (est 139.2 kcal vs authored 141). The
 * other 15 stay gated with FNDDS-verified reasons (no record / generic-only
 * varietal folds / reconciliation failures). New immutable revision (2).
 * 1.12.0 (ADR-P013 Amendment A1 Batch F2): matched the 7 gated tbsp foods
 * against the pinned FNDDS archive. Two matches: food.pesto -> "Pesto sauce"
 * (2710175, 1 tbsp = 16 g; est 92.8 kcal vs authored 80) and food.tzatziki ->
 * "Tzatziki dip" (2705448, attribute "Greek dip", 1 tbsp = 15 g -> 2 tbsp =
 * 30 g; est 27.3 kcal vs authored 21). chia (no tbsp portion), flax (whole
 * vs ground), mct_oil (no record), nutritional_yeast (record is brewers
 * yeast), and greek_yogurt_dressing (only a sweet fruit dressing carries the
 * yogurt-dressing tag) stay gated. New immutable revisions (2).
 * 1.13.0 (ADR-P013 Amendment A1 Batch F4): matched food.sourdough_bread
 * against the pinned FNDDS archive -> "Bread, sour dough" (2707646, FNDDS
 * spells it as two words), "1 medium or regular slice" = 31 g (est 84.3 kcal
 * vs authored 97). Batch F3 (ml foods, same day) matched nothing and changed
 * no data. New immutable revision (2). The slice-unit gated set is now empty.
 * 1.13.1 (ADR-P013 gate-(a) correction slice 1, food.onion): the authored
 * macros (64 kcal / P2 / C14 / F0 per cup) are RAW-onion chopped-cup values —
 * SR "Onions, raw" (170000, 1 cup chopped = 160 g, 40 kcal/100 g) reconciles
 * at 64.0 kcal EXACTLY and FNDDS "Onions, raw" (2709795, 1 cup = 160 g)
 * cross-checks, while both pins' cooked records fail (88-99 kcal). The name
 * was the defect: renamed "Onion, cooked" -> "Onion, raw" with the SR cup
 * gram weight; macros unchanged. New immutable revision (2).
 * 1.13.2 (ADR-P013 gate-(a) correction slice 2, food.snow_peas): same defect
 * class as onion — the authored macros (40 kcal / P3 / C7 / F0 per cup) are
 * RAW snow-pea chopped-cup values: SR "Peas, edible-podded, raw" (170010,
 * "cup, chopped" = 98 g, 42 kcal/100 g) reconciles at est 41.2 kcal vs 40
 * and FNDDS "Snowpeas, raw" (2709806) carries identical per-100 g values,
 * while both pins' cooked records fail (67-70 kcal). Renamed "Snow peas,
 * cooked" -> "Snow peas, raw" with the SR chopped-cup gram weight; macros
 * unchanged. New immutable revision (2).
 */
export const CATALOG_VERSION = 'food-catalog@1.13.2';

/** Closed vocabularies — the integrity test asserts data stays within these. */
export const FOOD_CATEGORIES: readonly FoodCategory[] = [
  'protein_animal',
  'protein_plant',
  'grain',
  'legume',
  'vegetable',
  'fruit',
  'dairy',
  'nuts_seeds',
  'fat_oil',
  'beverage',
  'condiment',
  'composite',
];

export const FOOD_TAGS: readonly FoodTag[] = [
  'high_protein',
  'low_carb',
  'complex_carb',
  'healthy_fat',
  'vegan',
  'vegetarian',
  'gluten_free',
  'dairy_free',
  'heart_healthy',
  'low_sodium',
  'high_fiber',
  'budget_friendly',
  'quick_prep',
];

export const AVOID_TAGS: readonly AvoidTag[] = [
  'nut_allergy',
  'shellfish_allergy',
  'gluten_sensitive',
  'lactose_sensitive',
  'high_sodium_sensitive',
  'high_purine',
];

export const SERVING_UNITS: readonly ServingUnit[] = [
  'g',
  'ml',
  'piece',
  'cup',
  'tbsp',
  'tsp',
  'slice',
];
