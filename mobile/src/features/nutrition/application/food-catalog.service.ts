import type { FoodCategory, FoodItem, FoodTag } from '../domain/food-catalog';
import { FOOD_CATALOG } from '../infrastructure/food-catalog.data';

/**
 * Pure, in-memory query service over the bundled food catalog (Phase 15
 * Slice 2). Read-only reference data — no SQLite, no sync, no network. The
 * id index is built once at module load.
 */

const byId: ReadonlyMap<string, FoodItem> = new Map(FOOD_CATALOG.map((f) => [f.id, f]));

/** All catalog items (stable order). */
export function listAll(): readonly FoodItem[] {
  return FOOD_CATALOG;
}

export function getById(id: string): FoodItem | undefined {
  return byId.get(id);
}

export function filterByCategory(category: FoodCategory): FoodItem[] {
  return FOOD_CATALOG.filter((f) => f.category === category);
}

/**
 * Items matching the given tags. `mode: 'all'` (default) requires every
 * tag; `'any'` requires at least one. An empty tag list returns all items.
 */
export function filterByTags(tags: readonly FoodTag[], mode: 'all' | 'any' = 'all'): FoodItem[] {
  if (tags.length === 0) return [...FOOD_CATALOG];
  return FOOD_CATALOG.filter((f) =>
    mode === 'all' ? tags.every((t) => f.tags.includes(t)) : tags.some((t) => f.tags.includes(t)),
  );
}

/** Case-insensitive substring search on the canonical name. Blank → []. */
export function search(query: string): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FOOD_CATALOG.filter((f) => f.name.toLowerCase().includes(q));
}
