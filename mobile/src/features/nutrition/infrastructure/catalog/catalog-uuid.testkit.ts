/**
 * TEST-ONLY catalog identity derivation (ADR-P012 Slice 4A).
 *
 * This module is imported ONLY by `*.spec.ts` files — never by runtime code —
 * so the mobile app bundle ships precomputed static ids and carries no UUID
 * derivation at run time (no runtime UUID dependency; see catalog-identity.ts).
 *
 * Its RFC 4122 v5 (SHA-1) core is pure JS (no `crypto` import, no native
 * dependency) and lives in shared/infrastructure/uuidv5.ts. The API mirrors
 * this using Node's crypto; both are anchored to the SAME golden UUID literals
 * in tests, proving mobile and server derive identical catalog ids.
 */

import {
  NUTRITION_UUID_NAMESPACE,
  normalizeServing,
  revisionOf,
  type CanonicalFood,
} from '../../domain/catalog-identity';
import { CATALOG_VERSION, type FoodItem } from '../../domain/food-catalog';
import { sha1Bytes, toHex, utf8Bytes, uuidv5 } from '@/shared/infrastructure/uuidv5';

// The pure SHA-1/UUIDv5 core lives in shared/infrastructure/uuidv5.ts.
export { uuidv5 } from '@/shared/infrastructure/uuidv5';

/** Deterministic food id from stable catalog key + immutable revision. */
export function deriveFoodId(catalogKey: string, foodRevision: number): string {
  return uuidv5(`${catalogKey}:${foodRevision}`, NUTRITION_UUID_NAMESPACE);
}

/** Stable content hash (SHA-1 hex) of a canonical catalog for drift/parity. */
export function canonicalHash(foods: readonly CanonicalFood[]): string {
  return toHex(sha1Bytes(utf8Bytes(stableStringify(foods))));
}

/** Deterministic JSON with sorted object keys. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Build the canonical catalog from the authored bundle. Deterministic; ids are
 * derived here (test time) and then shipped as static data.
 */
export function buildCanonicalCatalog(catalog: readonly FoodItem[]): CanonicalFood[] {
  return catalog.map((item) => {
    const serving = normalizeServing(item.servingSize);
    const foodRevision = revisionOf(item.id);
    return {
      id: deriveFoodId(item.id, foodRevision),
      catalogKey: item.id,
      foodRevision,
      catalogVersion: CATALOG_VERSION,
      name: item.name,
      category: item.category,
      servingAmount: serving.servingAmount,
      servingUnit: serving.servingUnit,
      gramsPerServing: serving.gramsPerServing,
      caloriesPerServing: item.calories,
      proteinPerServing: item.proteinG,
      carbsPerServing: item.carbsG,
      fatPerServing: item.fatG,
      fiberPerServing: item.fiberG ?? null,
    };
  });
}
