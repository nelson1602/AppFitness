import { createHash } from 'node:crypto';

/**
 * ADR-P012 Slice 4A — deterministic catalog identity, serving normalization,
 * and per-serving snapshot derivation (SERVER side).
 *
 * This mirrors the mobile helper (mobile/.../domain/catalog-identity.ts +
 * catalog-uuid.testkit.ts) byte-for-byte: the SAME fixed namespace, the SAME
 * `${catalogKey}:${foodRevision}` UUIDv5 input, and the SAME snapshot mapping.
 * Both sides are anchored to identical golden UUID literals in tests, proving
 * mobile and server derive identical catalog ids and per-serving snapshots.
 *
 * The server is authoritative for MealItem snapshots (ADR-P012): a future
 * meal_items handler must load its matching immutable food revision and derive
 * the snapshot here, never trusting client-supplied names/macros, and reject an
 * unknown revision with CATALOG_REVISION_UNSUPPORTED.
 */

/** Fixed, documented namespace UUID for AppFitness nutrition-catalog UUIDv5. */
export const NUTRITION_UUID_NAMESPACE = 'b9f4d2a1-6c7e-5a83-9d0b-1e2f3a4c5d60';

/** Current immutable revision of every bundled catalog food. */
export const FOOD_REVISION = 1;

export interface CanonicalFood {
  id: string;
  catalogKey: string;
  foodRevision: number;
  catalogVersion: string;
  name: string;
  category: string;
  servingAmount: number;
  servingUnit: string;
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
}

/**
 * The minimal set of food-revision fields needed to derive a per-serving
 * snapshot. A bundled `CanonicalFood` and a persisted `Food` row both satisfy
 * this shape, so the server can derive a MealItem snapshot straight from the
 * stored food revision (ADR-P012 Slice 4B) using the same code path the
 * catalog parity tests cover.
 */
export interface FoodRevisionSnapshotSource {
  name: string;
  catalogKey: string | null;
  foodRevision: number | null;
  catalogVersion: string | null;
  servingAmount: number;
  servingUnit: string;
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
}

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

/** RFC 4122 v5 (SHA-1) UUID. */
export function uuidv5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  if (ns.length !== 16) throw new Error(`Invalid UUID namespace: ${namespace}`);
  const hash = createHash('sha1');
  hash.update(ns);
  hash.update(Buffer.from(name, 'utf8'));
  const bytes = hash.digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministic food id from stable catalog key + immutable revision. */
export function deriveFoodId(catalogKey: string, foodRevision: number): string {
  return uuidv5(`${catalogKey}:${foodRevision}`, NUTRITION_UUID_NAMESPACE);
}

/**
 * Derive the immutable per-serving snapshot from a food revision. Byte-for-byte
 * identical to the mobile derivation.
 */
export function deriveServingSnapshot(
  food: FoodRevisionSnapshotSource,
): ServingSnapshot {
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

/** Deterministic JSON with sorted object keys (stable content hashing). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Stable SHA-1 content hash of a canonical catalog (drift/parity anchor). */
export function canonicalHash(foods: readonly CanonicalFood[]): string {
  return createHash('sha1')
    .update(Buffer.from(stableStringify(foods), 'utf8'))
    .digest('hex');
}
