import type { CanonicalFood } from '../domain/catalog-identity';
import { CANONICAL_FOOD_CATALOG } from '../infrastructure/catalog/food-catalog.canonical';

/**
 * Pure lookup over the committed canonical catalog (ADR-P012 Slice 4A) — the
 * persisted/synced food identity model (UUIDv5 id + revision). This is the
 * bridge the write flow uses to turn a catalog key/slug (what the plan and
 * log UI carry) into the durable food id + per-serving snapshot source.
 *
 * Read-only reference data — no SQLite, no sync, no network. Indexes are
 * built once at module load.
 */

const byId: ReadonlyMap<string, CanonicalFood> = new Map(
  CANONICAL_FOOD_CATALOG.map((f) => [f.id, f]),
);
const byCatalogKey: ReadonlyMap<string, CanonicalFood> = new Map(
  CANONICAL_FOOD_CATALOG.map((f) => [f.catalogKey, f]),
);

/** All canonical foods (stable order). */
export function listCanonicalFoods(): readonly CanonicalFood[] {
  return CANONICAL_FOOD_CATALOG;
}

/** Canonical food by its durable UUIDv5 id, or undefined. */
export function getCanonicalById(id: string): CanonicalFood | undefined {
  return byId.get(id);
}

/** Canonical food by its stable catalog key/slug, or undefined. */
export function getCanonicalByCatalogKey(catalogKey: string): CanonicalFood | undefined {
  return byCatalogKey.get(catalogKey);
}
