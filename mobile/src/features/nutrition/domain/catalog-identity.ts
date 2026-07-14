/**
 * ADR-P012 Slice 4A — deterministic catalog identity, serving normalization,
 * and per-serving snapshot derivation.
 *
 * PURE and RUNTIME-SAFE: no crypto, no network, no storage. The mobile runtime
 * NEVER derives UUIDs at run time — it ships precomputed static ids in the
 * canonical catalog artifact (food-catalog.canonical.json). The UUIDv5
 * derivation lives only in test utilities (see catalog-uuid.testkit.ts), which
 * verify that the static ids equal `uuidv5(catalog_key:food_revision)` under the
 * fixed namespace below. The API mirrors these constants and the snapshot
 * derivation byte-for-byte so mobile and server derive identical identities and
 * snapshots from the same canonical data.
 */

import type { ServingSize, ServingUnit } from './food-catalog';

/** Fixed, documented namespace UUID for AppFitness nutrition-catalog UUIDv5. */
export const NUTRITION_UUID_NAMESPACE = 'b9f4d2a1-6c7e-5a83-9d0b-1e2f3a4c5d60';

/** Base immutable revision of a bundled catalog food (ADR-P012). */
export const FOOD_REVISION = 1;

/**
 * Per-food revision overrides (ADR-P012 / TECHDEBT-004 risk 3, split-risk part
 * 1). These 29 `piece` foods were authored with the one-piece gram weight in
 * `servingAmount` under a `piece` label — the exact `piece(182)` conflation
 * ADR-P012 flagged. They are corrected to `{amount: 1, unit: 'piece', grams:
 * <weight>}` and, because catalog revisions are IMMUTABLE, shipped as a NEW
 * revision (2 → a new UUID); the old revision-1 rows stay FK-valid on any
 * server that already seeded them. A food's key appears here IFF its authored
 * serving now carries an explicit `grams` on a non-gram unit; the canonical
 * integrity test locks the two together.
 *
 * ADR-P013 Batch 1 (2026-07-14) adds the 4 `slice` foods whose full-serving
 * gram weight was sourced from the pinned USDA-FDC SR Legacy archive — see
 * infrastructure/catalog/fdc-portion-manifest.json for per-food provenance.
 * ADR-P013 Batch 2 (2026-07-14) adds 13 `tbsp` foods from the same pinned
 * archive. The tsp semantics mini-slice corrects the six ambiguous `tsp(N)`
 * foods whose authored amount encoded grams, not teaspoon counts. ADR-P013
 * Batch 3A adds reviewed `cup` portions for grains, legumes, and staples;
 * Batch 3B adds reviewed `cup` portions for vegetables; Batch 3C adds
 * reviewed `cup` portions for fruits. The remaining volumetric foods and the
 * unmatched foods (`food.sourdough_bread`, `food.onion`, `food.snow_peas`,
 * `food.leeks`, `food.mixed_greens`, `food.broccolini`, `food.pomegranate`,
 * `food.dragon_fruit`, plus 3A's unmatched varietals — see the manifest's
 * `unmatched` reasons) stay at revision 1 with `gramsPerServing = null`,
 * gated behind later ADR-P013 batches.
 */
export const FOOD_REVISIONS: Readonly<Record<string, number>> = {
  'food.egg_whole': 2,
  'food.egg_white': 2,
  'food.egg_omelette_plain': 2,
  'food.eggs_two_large': 2,
  'food.black_bean_burger': 2,
  'food.falafel': 2,
  'food.corn_tortilla': 2,
  'food.whole_wheat_tortilla': 2,
  'food.rice_cakes': 2,
  'food.potato_baked': 2,
  'food.artichoke': 2,
  'food.portobello': 2,
  'food.apple': 2,
  'food.banana': 2,
  'food.orange': 2,
  'food.peach': 2,
  'food.pear': 2,
  'food.plum': 2,
  'food.kiwi': 2,
  'food.grapefruit': 2,
  'food.avocado_fruit': 2,
  'food.dates': 2,
  'food.apricot': 2,
  'food.clementine': 2,
  'food.nectarine': 2,
  'food.passion_fruit': 2,
  'food.starfruit': 2,
  'food.string_cheese': 2,
  'food.avocado_half': 2,
  // ADR-P013 Batch 1 — slice foods with FDC-sourced full-serving gram weights.
  'food.whole_wheat_bread': 2,
  'food.rye_bread': 2,
  'food.ezekiel_bread': 2,
  'food.canadian_bacon': 2,
  // ADR-P013 Batch 2 â€” tablespoon foods with FDC-sourced full-serving gram weights.
  'food.hummus': 2,
  'food.parmesan': 2,
  'food.peanut_butter': 2,
  'food.almond_butter': 2,
  'food.sesame_seeds': 2,
  'food.hemp_seeds': 2,
  'food.tahini': 2,
  'food.cashew_butter': 2,
  'food.sunflower_butter': 2,
  'food.flaxseed_oil': 2,
  'food.salsa': 2,
  'food.balsamic_vinegar': 2,
  'food.soy_sauce_low_sodium': 2,
  // ADR-P013 tsp semantics mini-slice — corrected `tsp(N grams)` servings.
  'food.butter': 2,
  'food.ghee': 2,
  'food.mustard': 2,
  'food.hot_sauce': 2,
  'food.garlic': 2,
  'food.ginger': 2,
  // ADR-P013 Batch 3A — cup-served grains, legumes, and staples with FDC-sourced full-serving gram weights.
  'food.edamame': 2,
  'food.brown_rice': 2,
  'food.white_rice': 2,
  'food.wild_rice': 2,
  'food.quinoa': 2,
  'food.barley': 2,
  'food.bulgur': 2,
  'food.buckwheat': 2,
  'food.millet': 2,
  'food.amaranth': 2,
  'food.popcorn_air': 2,
  'food.lentils_brown': 2,
  'food.chickpeas': 2,
  'food.black_beans': 2,
  'food.kidney_beans': 2,
  'food.pinto_beans': 2,
  'food.navy_beans': 2,
  'food.great_northern_beans': 2,
  'food.lima_beans': 2,
  'food.split_peas': 2,
  'food.green_peas': 2,
  'food.black_eyed_peas': 2,
  'food.mung_beans': 2,
  'food.adzuki_beans': 2,
  'food.fava_beans': 2,
  'food.soybeans': 2,
  // ADR-P013 Batch 3B — cup-served vegetables with FDC-sourced full-serving gram weights.
  'food.broccoli': 2,
  'food.spinach': 2,
  'food.kale': 2,
  'food.cauliflower': 2,
  'food.brussels_sprouts': 2,
  'food.asparagus': 2,
  'food.green_beans': 2,
  'food.zucchini': 2,
  'food.bell_pepper_red': 2,
  'food.carrots': 2,
  'food.tomato': 2,
  'food.cucumber': 2,
  'food.lettuce_romaine': 2,
  'food.cabbage': 2,
  'food.mushrooms': 2,
  'food.sweet_potato': 2,
  'food.butternut_squash': 2,
  'food.beets': 2,
  'food.eggplant': 2,
  'food.celery': 2,
  'food.bok_choy': 2,
  'food.swiss_chard': 2,
  'food.collard_greens': 2,
  'food.okra': 2,
  'food.snap_peas': 2,
  'food.corn': 2,
  'food.pumpkin': 2,
  'food.spaghetti_squash': 2,
  'food.turnip': 2,
  'food.parsnip': 2,
  'food.radish': 2,
  'food.arugula': 2,
  'food.watercress': 2,
  'food.fennel': 2,
  'food.kohlrabi': 2,
  'food.acorn_squash': 2,
  'food.bell_pepper_green': 2,
  'food.cherry_tomatoes': 2,
  'food.sauerkraut': 2,
  'food.spinach_raw': 2,
  'food.jicama': 2,
  'food.tomatillo': 2,
  // ADR-P013 Batch 3C — cup-served fruits with FDC-sourced full-serving gram weights.
  'food.strawberries': 2,
  'food.blueberries': 2,
  'food.raspberries': 2,
  'food.blackberries': 2,
  'food.grapes': 2,
  'food.pineapple': 2,
  'food.mango': 2,
  'food.watermelon': 2,
  'food.cantaloupe': 2,
  'food.cherries': 2,
  'food.honeydew': 2,
  'food.papaya': 2,
  'food.guava': 2,
  'food.lychee': 2,
  // ADR-P013 Batch 4 — remaining tbsp foods; corrects Batch 2's wrong
  // unmatched verdicts (SR "Oil, <name>" naming was missed by that search).
  'food.olive_oil': 2,
  'food.avocado_oil': 2,
  'food.canola_oil': 2,
  'food.walnut_oil': 2,
  'food.sesame_oil': 2,
  'food.coconut_oil': 2,
  'food.cream_cheese_light': 2,
  'food.tomato_paste': 2,
  // ADR-P013 Batch 5 — ml foods with density-derived full-serving gram weights.
  'food.soy_milk_unsweet': 2,
  'food.milk_skim': 2,
  'food.milk_1pct': 2,
  'food.milk_2pct': 2,
  'food.kefir_plain': 2,
  'food.almond_milk_unsweet': 2,
  'food.buttermilk_lowfat': 2,
  'food.tomato_juice_lowsodium': 2,
  'food.orange_juice': 2,
  'food.vegetable_juice_lowsodium': 2,
  'food.coconut_water': 2,
};

/** The immutable revision of one bundled food (override, else the base). */
export function revisionOf(catalogKey: string): number {
  return FOOD_REVISIONS[catalogKey] ?? FOOD_REVISION;
}

/**
 * The canonical, normalized representation of one catalog food revision. This
 * is the shape persisted in the shared canonical artifact and seeded, byte-for
 * byte, on both mobile (SQLite) and server (PostgreSQL).
 */
export interface CanonicalFood {
  /** Deterministic UUIDv5 of `${catalogKey}:${foodRevision}` (static, precomputed). */
  id: string;
  catalogKey: string;
  foodRevision: number;
  catalogVersion: string;
  name: string;
  category: string;
  servingAmount: number;
  servingUnit: ServingUnit;
  /** Gram weight of one serving where a valid conversion exists; else null. */
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
}

/** The immutable per-serving snapshot copied onto a MealItem at log time. */
export interface ServingSnapshot {
  foodNameSnapshot: string;
  catalogKeySnapshot: string | null;
  foodRevisionSnapshot: number | null;
  catalogVersionSnapshot: string | null;
  servingAmountSnapshot: number;
  servingUnitSnapshot: string;
  gramsPerServingSnapshot: number | null;
  caloriesPerServingSnapshot: number;
  proteinPerServingSnapshot: number;
  carbsPerServingSnapshot: number;
  fatPerServingSnapshot: number;
  fiberPerServingSnapshot: number | null;
}

export interface NormalizedServing {
  servingAmount: number;
  servingUnit: ServingUnit;
  gramsPerServing: number | null;
}

/**
 * Normalize a catalog serving. The authored `{amount, unit}` is preserved
 * exactly (no reinterpretation). A gram-per-serving value is recorded ONLY
 * where a valid, authored conversion exists: the serving is already in grams
 * (`unit: 'g'`), OR a non-gram serving carries an explicit authored `grams`
 * weight (ADR-P012 / TECHDEBT-004 risk 3 — never fabricated). Non-gram foods
 * without an authored gram weight keep `gramsPerServing = null`; sourcing those
 * (the volumetric foods) remains open under TECHDEBT-004, and until it lands the
 * log path offers fractional servings (never fabricated gram entry).
 */
export function normalizeServing(serving: ServingSize): NormalizedServing {
  return {
    servingAmount: serving.amount,
    servingUnit: serving.unit,
    gramsPerServing: serving.unit === 'g' ? serving.amount : (serving.grams ?? null),
  };
}

/**
 * Derive the immutable per-serving snapshot from a canonical food. Identical on
 * mobile and server (server derives from its own food revision; mobile from the
 * bundled one) — proven byte-for-byte by tests on both sides.
 */
export function deriveServingSnapshot(food: CanonicalFood): ServingSnapshot {
  return {
    foodNameSnapshot: food.name,
    catalogKeySnapshot: food.catalogKey,
    foodRevisionSnapshot: food.foodRevision,
    catalogVersionSnapshot: food.catalogVersion,
    servingAmountSnapshot: food.servingAmount,
    servingUnitSnapshot: food.servingUnit,
    gramsPerServingSnapshot: food.gramsPerServing,
    caloriesPerServingSnapshot: food.caloriesPerServing,
    proteinPerServingSnapshot: food.proteinPerServing,
    carbsPerServingSnapshot: food.carbsPerServing,
    fatPerServingSnapshot: food.fatPerServing,
    fiberPerServingSnapshot: food.fiberPerServing,
  };
}

/** Consumed totals for a logged item = serving_count × per-serving snapshot. */
export function consumedTotals(
  snapshot: ServingSnapshot,
  servingCount: number,
): { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null } {
  const round1 = (n: number): number => Math.round(n * 10) / 10;
  return {
    calories: Math.round(snapshot.caloriesPerServingSnapshot * servingCount),
    proteinG: round1(snapshot.proteinPerServingSnapshot * servingCount),
    carbsG: round1(snapshot.carbsPerServingSnapshot * servingCount),
    fatG: round1(snapshot.fatPerServingSnapshot * servingCount),
    fiberG:
      snapshot.fiberPerServingSnapshot == null
        ? null
        : round1(snapshot.fiberPerServingSnapshot * servingCount),
  };
}
