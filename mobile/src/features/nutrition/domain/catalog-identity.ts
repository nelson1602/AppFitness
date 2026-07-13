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

/** Current immutable revision of every bundled catalog food (ADR-P012). */
export const FOOD_REVISION = 1;

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
 * exactly (no reinterpretation, no fabricated conversions). A gram-per-serving
 * value is recorded ONLY where a valid conversion exists — i.e. the serving is
 * already expressed in grams. Non-gram foods keep `gramsPerServing = null`;
 * per-food gram sourcing for those remains open under TECHDEBT-004, and until it
 * lands the log path offers fractional servings (never fabricated gram entry).
 */
export function normalizeServing(serving: ServingSize): NormalizedServing {
  return {
    servingAmount: serving.amount,
    servingUnit: serving.unit,
    gramsPerServing: serving.unit === 'g' ? serving.amount : null,
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
