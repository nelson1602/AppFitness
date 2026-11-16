import { queryAll, queryFirst, run, type SqlExecutor } from '@/shared/infrastructure/database';

import type { CanonicalFood } from '../domain/catalog-identity';

/**
 * Foods that are not in the bundled catalogue (v10 Block B, item 7): results
 * chosen from USDA FoodData Central or Open Food Facts (`fdc.` / `off.` keys,
 * saved in the shared server catalogue) and the person's own foods
 * (`custom.`). They live in the local `foods` table so they can be searched and
 * logged offline afterwards. Catalogue data, not user records: never enqueued —
 * the server already holds them.
 */
export const SAVED_FOOD_KEY_PREFIXES = ['fdc.', 'off.', 'custom.'] as const;

interface FoodRow {
  id: string;
  catalog_key: string | null;
  food_revision: number;
  catalog_version: string | null;
  name: string;
  brand: string | null;
  serving_amount: number;
  serving_unit: string;
  grams_per_serving: number | null;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
  fiber_per_serving: number | null;
}

function toCanonical(row: FoodRow): CanonicalFood {
  const key = row.catalog_key ?? '';
  return {
    id: row.id,
    catalogKey: key,
    foodRevision: row.food_revision,
    catalogVersion: row.catalog_version ?? '',
    name: row.name,
    category: key.startsWith('custom.') ? 'custom' : 'external',
    servingAmount: row.serving_amount,
    // Saved foods only use the catalogue's units (g, ml, piece …).
    servingUnit: row.serving_unit as CanonicalFood['servingUnit'],
    gramsPerServing: row.grams_per_serving,
    caloriesPerServing: row.calories_per_serving,
    proteinPerServing: row.protein_per_serving,
    carbsPerServing: row.carbs_per_serving,
    fatPerServing: row.fat_per_serving,
    fiberPerServing: row.fiber_per_serving,
    brand: row.brand,
  };
}

export function isSavedFoodKey(catalogKey: string): boolean {
  return SAVED_FOOD_KEY_PREFIXES.some((prefix) => catalogKey.startsWith(prefix));
}

/**
 * Keeps an imported or custom food on the phone (immutable revision: insert
 * once). v11-B: its brand is kept too; a row saved earlier without one gets it
 * now (the brand is display data, not part of the immutable revision).
 */
export async function saveFoodLocally(
  food: CanonicalFood,
  nowIso: string,
  tx?: SqlExecutor,
): Promise<void> {
  const brand = cleanBrand(food.brand);
  await run(
    `INSERT OR IGNORE INTO foods (
       id, created_at, updated_at, version, sync_status,
       catalog_key, food_revision, catalog_version, name, brand,
       serving_amount, serving_unit, grams_per_serving,
       calories_per_serving, protein_per_serving, carbs_per_serving,
       fat_per_serving, fiber_per_serving, created_by, is_verified
     ) VALUES (?, ?, ?, 1, 'synced', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
    [
      food.id,
      nowIso,
      nowIso,
      food.catalogKey,
      food.foodRevision,
      food.catalogVersion,
      food.name,
      brand,
      food.servingAmount,
      food.servingUnit,
      food.gramsPerServing,
      food.caloriesPerServing,
      food.proteinPerServing,
      food.carbsPerServing,
      food.fatPerServing,
      food.fiberPerServing,
    ],
    tx,
  );
  if (brand) {
    await run(`UPDATE foods SET brand = ? WHERE id = ? AND brand IS NULL`, [brand, food.id], tx);
  }
}

/** A brand worth keeping: trimmed, single-spaced, at most 80 characters; else null. */
export function cleanBrand(brand: string | null | undefined): string | null {
  const clean = brand?.replace(/\s+/g, ' ').trim() ?? '';
  return clean ? clean.slice(0, 80) : null;
}

/**
 * v11-B backfill: saved foods (by catalogue key) that have no brand yet get
 * the one the server knows — from a search result or a pulled meal item. A
 * brand already kept is never overwritten. Returns how many rows changed.
 */
export async function fillMissingBrands(
  entries: readonly { catalogKey: string; brand: string | null }[],
  tx?: SqlExecutor,
): Promise<number> {
  let changed = 0;
  for (const entry of entries) {
    const brand = cleanBrand(entry.brand);
    if (!brand || !isSavedFoodKey(entry.catalogKey)) continue;
    const result = await run(
      `UPDATE foods SET brand = ?
        WHERE catalog_key = ? AND brand IS NULL AND deleted_at IS NULL`,
      [brand, entry.catalogKey],
      tx,
    );
    changed += result.changes;
  }
  return changed;
}

/** A saved (non-bundled) food by its catalogue key, or null. */
export async function readSavedFood(
  catalogKey: string,
  tx?: SqlExecutor,
): Promise<CanonicalFood | null> {
  if (!isSavedFoodKey(catalogKey)) return null;
  const row = await queryFirst<FoodRow>(
    `SELECT * FROM foods WHERE catalog_key = ? AND deleted_at IS NULL`,
    [catalogKey],
    tx,
  );
  return row ? toCanonical(row) : null;
}

const fold = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase();

/** Saved foods whose name contains the query, accents and case ignored. */
export async function searchSavedFoods(query: string, limit = 8): Promise<CanonicalFood[]> {
  const folded = fold(query);
  if (!folded) return [];
  const rows = await queryAll<FoodRow>(
    `SELECT * FROM foods
      WHERE deleted_at IS NULL
        AND (catalog_key LIKE 'fdc.%' OR catalog_key LIKE 'off.%' OR catalog_key LIKE 'custom.%')
      ORDER BY name`,
  );
  return rows
    .filter((row) => fold(row.name).includes(folded))
    .slice(0, limit)
    .map(toCanonical);
}
