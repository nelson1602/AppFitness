import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { MealItemRow, MealTypeName } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import { getCanonicalByCatalogKey } from '../application/catalog-lookup.service';
import {
  deriveServingSnapshot,
  type CanonicalFood,
  type ServingSnapshot,
} from '../domain/catalog-identity';
import { MEAL_SLOTS } from '../domain/meal-plan';
import { itemConsumed, type LoggedMealItem, type MealItemSyncState } from '../domain/food-log';

/**
 * Local-first food logging (ADR-0006 + ADR-P012 Slice 4C).
 *
 * Every write lands in SQLite and, for the ONLY server-synced nutrition
 * entity — `meal_items` — enqueues a sync op in the SAME transaction, marked
 * `sensitive` so the queue stores it encrypted (food + quantity is health
 * data). The parent `nutrition_logs`/`meals` rows are created locally only:
 * the backend registers NO handler for them (Slice 4B), so pushing them would
 * be permanently ENTITY_NOT_SUPPORTED. The server derives the meal_item
 * snapshot from `food_id`; we keep an immutable local snapshot for offline
 * display and never treat it as authoritative after reconciliation.
 *
 * Version discipline mirrors the profile/medical repos: `version` stays at the
 * last server-acknowledged value; local edits set sync_status='pending' and
 * the queued op carries baseVersion = that version for server conflict checks.
 */

const MEAL_ITEM_ENTITY_TYPE = 'meal_items';

/** Joined row: a meal_item plus its parent meal's type (for grouping). */
interface JoinedMealItemRow extends MealItemRow {
  meal_type: MealTypeName;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Log one catalog food against a meal on a date. Get-or-creates the day's
 * nutrition_log and the meal, seeds the referenced catalog food locally (FK
 * target), inserts the meal_item with its per-serving snapshot, and enqueues
 * the CREATE. Atomic — a saved item can never miss its queue entry.
 */
export async function logFood(
  userId: string,
  input: { date: string; mealType: MealTypeName; catalogKey: string; servingCount: number },
  nowIso: string = new Date().toISOString(),
): Promise<LoggedMealItem> {
  const canonical = getCanonicalByCatalogKey(input.catalogKey);
  if (!canonical) throw new Error('unknown catalog food'); // slug only, no PHI
  if (!(input.servingCount > 0)) throw new Error('serving count must be positive');
  const snapshot = deriveServingSnapshot(canonical);

  return inTransaction(async () => {
    const logId = await ensureNutritionLog(userId, input.date, nowIso);
    const mealId = await ensureMeal(userId, logId, input.mealType, nowIso);
    await ensureFoodSeeded(canonical, nowIso);

    const id = generateUuid();
    await run(
      `INSERT INTO meal_items (
         id, user_id, created_at, updated_at, version, sync_status,
         meal_id, food_id, serving_count,
         food_name_snapshot, catalog_key_snapshot, food_revision_snapshot,
         catalog_version_snapshot, serving_amount_snapshot, serving_unit_snapshot,
         grams_per_serving_snapshot, calories_per_serving_snapshot,
         protein_per_serving_snapshot, carbs_per_serving_snapshot,
         fat_per_serving_snapshot, fiber_per_serving_snapshot
       ) VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        mealId,
        canonical.id,
        input.servingCount,
        snapshot.foodNameSnapshot,
        snapshot.catalogKeySnapshot,
        snapshot.foodRevisionSnapshot,
        snapshot.catalogVersionSnapshot,
        snapshot.servingAmountSnapshot,
        snapshot.servingUnitSnapshot,
        snapshot.gramsPerServingSnapshot,
        snapshot.caloriesPerServingSnapshot,
        snapshot.proteinPerServingSnapshot,
        snapshot.carbsPerServingSnapshot,
        snapshot.fatPerServingSnapshot,
        snapshot.fiberPerServingSnapshot,
      ],
    );

    // Server reads only meal_id/food_id/serving_count; snapshot is derived
    // server-side. Sensitive: encrypted at rest in the queue.
    await enqueue(
      {
        opId: generateUuid(),
        entityType: MEAL_ITEM_ENTITY_TYPE,
        entityId: id,
        operation: 'CREATE',
        payload: { meal_id: mealId, food_id: canonical.id, serving_count: input.servingCount },
        baseVersion: 0,
        sensitive: true,
      },
      nowIso,
    );

    return rowToLoggedItem(await mustReadItem(id), input.mealType);
  });
}

/** Edit the serving_count of a logged item (the only mutable field). */
export async function updateServingCount(
  userId: string,
  id: string,
  servingCount: number,
  nowIso: string = new Date().toISOString(),
): Promise<LoggedMealItem | null> {
  if (!(servingCount > 0)) throw new Error('serving count must be positive');
  return inTransaction(async () => {
    const existing = await queryFirst<MealItemRow>(
      `SELECT * FROM meal_items WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!existing) return null;

    await run(
      `UPDATE meal_items SET serving_count = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      [servingCount, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: MEAL_ITEM_ENTITY_TYPE,
        entityId: id,
        operation: 'UPDATE',
        payload: { serving_count: servingCount },
        baseVersion: existing.version,
        sensitive: true,
      },
      nowIso,
    );

    const type = await mealTypeOf(existing.meal_id);
    return rowToLoggedItem(await mustReadItem(id), type);
  });
}

/** Soft-delete a logged item (history preserved; DELETE enqueued). */
export async function removeMealItem(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const existing = await queryFirst<MealItemRow>(
      `SELECT * FROM meal_items WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!existing) return;

    await run(
      `UPDATE meal_items
         SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: MEAL_ITEM_ENTITY_TYPE,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: existing.version,
        sensitive: true,
      },
      nowIso,
    );
  });
}

// ─── Reads ─────────────────────────────────────────────────────────────────

/** Non-deleted logged items for a user/date, grouped-ready (meal order). */
export async function listLoggedItems(userId: string, date: string): Promise<LoggedMealItem[]> {
  const rows = await queryAll<JoinedMealItemRow>(
    `SELECT mi.*, m.type AS meal_type
       FROM meal_items mi
       JOIN meals m ON m.id = mi.meal_id
       JOIN nutrition_logs nl ON nl.id = m.nutrition_log_id
      WHERE nl.user_id = ? AND nl.date = ?
        AND mi.deleted_at IS NULL AND m.deleted_at IS NULL AND nl.deleted_at IS NULL
      ORDER BY m.order_index ASC, mi.created_at ASC`,
    [userId, date],
  );
  return rows.map((row) => rowToLoggedItem(row, row.meal_type));
}

// ─── Pull-side applier (sync worker integration) ─────────────────────────────

/** Upsert a pulled server meal_item (server is authoritative after reconcile). */
export async function applyServerMealItem(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  await run(
    `INSERT OR REPLACE INTO meal_items (
       id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
       meal_id, food_id, serving_count,
       food_name_snapshot, catalog_key_snapshot, food_revision_snapshot,
       catalog_version_snapshot, serving_amount_snapshot, serving_unit_snapshot,
       grams_per_serving_snapshot, calories_per_serving_snapshot,
       protein_per_serving_snapshot, carbs_per_serving_snapshot,
       fat_per_serving_snapshot, fiber_per_serving_snapshot
     ) VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['meal_id']),
      str(row['food_id']),
      Number(row['serving_count'] ?? 0),
      str(row['food_name_snapshot']),
      str(row['catalog_key_snapshot']),
      numOrNull(row['food_revision_snapshot']),
      str(row['catalog_version_snapshot']),
      Number(row['serving_amount_snapshot'] ?? 0),
      str(row['serving_unit_snapshot']),
      numOrNull(row['grams_per_serving_snapshot']),
      Number(row['calories_per_serving_snapshot'] ?? 0),
      Number(row['protein_per_serving_snapshot'] ?? 0),
      Number(row['carbs_per_serving_snapshot'] ?? 0),
      Number(row['fat_per_serving_snapshot'] ?? 0),
      numOrNull(row['fiber_per_serving_snapshot']),
    ],
  );
}

/** Flag the local row when the server rejects our version (action required). */
export async function markMealItemConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE meal_items SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}

// ─── Local parent ensure (not synced in Slice 4C) ────────────────────────────

async function ensureNutritionLog(userId: string, date: string, nowIso: string): Promise<string> {
  const existing = await queryFirst<{ id: string }>(
    `SELECT id FROM nutrition_logs WHERE user_id = ? AND date = ? AND deleted_at IS NULL`,
    [userId, date],
  );
  if (existing) return existing.id;
  const id = generateUuid();
  await run(
    `INSERT INTO nutrition_logs (id, user_id, created_at, updated_at, version, sync_status, date, notes)
     VALUES (?, ?, ?, ?, 1, 'pending', ?, NULL)`,
    [id, userId, nowIso, nowIso, date],
  );
  return id;
}

async function ensureMeal(
  userId: string,
  nutritionLogId: string,
  type: MealTypeName,
  nowIso: string,
): Promise<string> {
  const existing = await queryFirst<{ id: string }>(
    `SELECT id FROM meals
      WHERE nutrition_log_id = ? AND type = ? AND deleted_at IS NULL`,
    [nutritionLogId, type],
  );
  if (existing) return existing.id;
  const id = generateUuid();
  const orderIndex = Math.max(0, MEAL_SLOTS.indexOf(type));
  await run(
    `INSERT INTO meals (id, user_id, created_at, updated_at, version, sync_status,
                        nutrition_log_id, type, order_index)
     VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?)`,
    [id, userId, nowIso, nowIso, nutritionLogId, type, orderIndex],
  );
  return id;
}

/**
 * Seed the referenced catalog food into the local `foods` table so the
 * meal_item FK resolves. Catalog data (not user data): sync_status='synced',
 * never enqueued — the server already holds the byte-identical revision.
 * INSERT OR IGNORE keeps the immutable revision row stable across logs.
 */
async function ensureFoodSeeded(food: CanonicalFood, nowIso: string): Promise<void> {
  await run(
    `INSERT OR IGNORE INTO foods (
       id, created_at, updated_at, version, sync_status,
       catalog_key, food_revision, catalog_version, name, brand,
       serving_amount, serving_unit, grams_per_serving,
       calories_per_serving, protein_per_serving, carbs_per_serving,
       fat_per_serving, fiber_per_serving, created_by, is_verified
     ) VALUES (?, ?, ?, 1, 'synced', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
    [
      food.id,
      nowIso,
      nowIso,
      food.catalogKey,
      food.foodRevision,
      food.catalogVersion,
      food.name,
      food.servingAmount,
      food.servingUnit,
      food.gramsPerServing,
      food.caloriesPerServing,
      food.proteinPerServing,
      food.carbsPerServing,
      food.fatPerServing,
      food.fiberPerServing,
    ],
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function mustReadItem(id: string): Promise<MealItemRow> {
  const row = await queryFirst<MealItemRow>(`SELECT * FROM meal_items WHERE id = ?`, [id]);
  if (!row) throw new Error('meal_item row disappeared mid-transaction');
  return row;
}

async function mealTypeOf(mealId: string): Promise<MealTypeName> {
  const row = await queryFirst<{ type: MealTypeName }>(`SELECT type FROM meals WHERE id = ?`, [
    mealId,
  ]);
  return row?.type ?? 'SNACK';
}

function rowSnapshot(row: MealItemRow): ServingSnapshot {
  return {
    foodNameSnapshot: row.food_name_snapshot,
    catalogKeySnapshot: row.catalog_key_snapshot,
    foodRevisionSnapshot: row.food_revision_snapshot,
    catalogVersionSnapshot: row.catalog_version_snapshot,
    servingAmountSnapshot: row.serving_amount_snapshot,
    servingUnitSnapshot: row.serving_unit_snapshot,
    gramsPerServingSnapshot: row.grams_per_serving_snapshot,
    caloriesPerServingSnapshot: row.calories_per_serving_snapshot,
    proteinPerServingSnapshot: row.protein_per_serving_snapshot,
    carbsPerServingSnapshot: row.carbs_per_serving_snapshot,
    fatPerServingSnapshot: row.fat_per_serving_snapshot,
    fiberPerServingSnapshot: row.fiber_per_serving_snapshot,
  };
}

function syncStateOf(status: MealItemRow['sync_status']): MealItemSyncState {
  if (status === 'conflict') return 'action_required';
  if (status === 'synced') return 'synced';
  return 'pending';
}

function rowToLoggedItem(row: MealItemRow, mealType: MealTypeName): LoggedMealItem {
  const snapshot = rowSnapshot(row);
  return {
    id: row.id,
    mealType,
    foodId: row.food_id,
    catalogKey: row.catalog_key_snapshot,
    name: row.food_name_snapshot,
    servingCount: row.serving_count,
    serving: { amount: row.serving_amount_snapshot, unit: row.serving_unit_snapshot },
    consumed: itemConsumed(snapshot, row.serving_count),
    syncState: syncStateOf(row.sync_status),
  };
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
