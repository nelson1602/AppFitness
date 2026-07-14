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
 */
export const CATALOG_VERSION = 'food-catalog@1.3.1';

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
