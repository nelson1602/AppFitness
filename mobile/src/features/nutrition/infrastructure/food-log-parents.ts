import {
  inTransaction,
  queryAll,
  queryFirst,
  run,
  type SqlExecutor,
} from '@/shared/infrastructure/database';
import type { MealTypeName, SyncQueueRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import {
  enqueue,
  readQueuePayload,
  requeueAtEnd,
  rewriteQueuedPayload,
} from '@/shared/infrastructure/sync';

import { mealIdFor, nutritionLogIdFor } from '../domain/food-log-ids';
import { MEAL_SLOTS } from '../domain/meal-plan';

/**
 * The parents of a logged food (BUG-044): one `nutrition_logs` row per day and
 * one `meals` row per day and slot. They used to be created on the device only,
 * so the server never found the meal a `meal_items` CREATE pointed at and every
 * logged food retried DEPENDENCY_NOT_READY forever.
 *
 * Now both are synced like any other row, with deterministic ids
 * (`food-log-ids.ts`), and their CREATEs are queued in the same transaction as
 * — and ahead of — the first food logged into them.
 */
export const NUTRITION_LOG_ENTITY_TYPE = 'nutrition_logs';
export const MEAL_ENTITY_TYPE = 'meals';
const MEAL_ITEM_ENTITY_TYPE = 'meal_items';

/** Marks the one-time repair of a user's earlier, unsynced food logs. */
export const PARENTS_REPAIR_KEY = 'bug044.food-log-parents.v1';

const logPayload = (date: string) => ({ date, notes: null });
const mealPayload = (logId: string, type: MealTypeName) => ({
  nutrition_log_id: logId,
  type,
  order_index: Math.max(0, MEAL_SLOTS.indexOf(type)),
});

async function enqueueCreate(
  userId: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
  nowIso: string,
  tx: SqlExecutor,
): Promise<void> {
  await enqueue(
    {
      opId: generateUuid(),
      userId,
      entityType,
      entityId,
      operation: 'CREATE',
      payload,
      baseVersion: 0,
    },
    nowIso,
    tx,
  );
}

/** The day's log, created (and queued) on first use. */
export async function ensureNutritionLog(
  userId: string,
  date: string,
  nowIso: string,
  tx: SqlExecutor,
): Promise<string> {
  const existing = await queryFirst<{ id: string }>(
    `SELECT id FROM nutrition_logs WHERE user_id = ? AND date = ? AND deleted_at IS NULL`,
    [userId, date],
    tx,
  );
  if (existing) return existing.id;
  const id = nutritionLogIdFor(userId, date);
  await run(
    `INSERT INTO nutrition_logs (id, user_id, created_at, updated_at, version, sync_status, date, notes)
     VALUES (?, ?, ?, ?, 1, 'pending', ?, NULL)`,
    [id, userId, nowIso, nowIso, date],
    tx,
  );
  await enqueueCreate(userId, NUTRITION_LOG_ENTITY_TYPE, id, logPayload(date), nowIso, tx);
  return id;
}

/** The day's meal for a slot, created (and queued) on first use. */
export async function ensureMeal(
  userId: string,
  nutritionLogId: string,
  date: string,
  type: MealTypeName,
  nowIso: string,
  tx: SqlExecutor,
): Promise<string> {
  const existing = await queryFirst<{ id: string }>(
    `SELECT id FROM meals
      WHERE nutrition_log_id = ? AND type = ? AND deleted_at IS NULL`,
    [nutritionLogId, type],
    tx,
  );
  if (existing) return existing.id;
  const id = mealIdFor(userId, date, type);
  await run(
    `INSERT INTO meals (id, user_id, created_at, updated_at, version, sync_status,
                        nutrition_log_id, type, order_index)
     VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?)`,
    [id, userId, nowIso, nowIso, nutritionLogId, type, Math.max(0, MEAL_SLOTS.indexOf(type))],
    tx,
  );
  await enqueueCreate(userId, MEAL_ENTITY_TYPE, id, mealPayload(nutritionLogId, type), nowIso, tx);
  return id;
}

/**
 * Give this user's earlier logs and meals (random ids, never synced) their
 * deterministic ids, moving their children with them, and point every queued
 * food that named an old meal at the new one. Idempotent: rows already named
 * deterministically are untouched. Returns how many rows were renamed.
 */
export async function rekeyFoodLogParents(
  userId: string,
  nowIso: string,
  tx: SqlExecutor,
): Promise<number> {
  // Parent and child ids change in the same transaction; check the foreign
  // keys once, at commit.
  await run('PRAGMA defer_foreign_keys = ON', [], tx);
  let renamed = 0;

  const logs = await queryAll<{ id: string; date: string }>(
    `SELECT id, date FROM nutrition_logs WHERE user_id = ?`,
    [userId],
    tx,
  );
  for (const log of logs) {
    const want = nutritionLogIdFor(userId, log.date);
    if (log.id === want) continue;
    await run(`UPDATE nutrition_logs SET id = ? WHERE id = ?`, [want, log.id], tx);
    await run(
      `UPDATE meals SET nutrition_log_id = ? WHERE nutrition_log_id = ?`,
      [want, log.id],
      tx,
    );
    renamed += 1;
  }

  const meals = await queryAll<{ id: string; type: MealTypeName; date: string }>(
    `SELECT m.id, m.type, l.date FROM meals m
       JOIN nutrition_logs l ON l.id = m.nutrition_log_id
      WHERE m.user_id = ?`,
    [userId],
    tx,
  );
  const renamedMeals = new Map<string, string>();
  for (const meal of meals) {
    const want = mealIdFor(userId, meal.date, meal.type);
    if (meal.id === want) continue;
    const taken = await queryFirst<{ id: string }>(`SELECT id FROM meals WHERE id = ?`, [want], tx);
    await run(`UPDATE meal_items SET meal_id = ? WHERE meal_id = ?`, [want, meal.id], tx);
    if (taken) {
      // Two meals for the same day and slot: keep one, with all their foods.
      await run(`DELETE FROM meals WHERE id = ?`, [meal.id], tx);
    } else {
      await run(`UPDATE meals SET id = ? WHERE id = ?`, [want, meal.id], tx);
    }
    renamedMeals.set(meal.id, want);
    renamed += 1;
  }

  if (renamedMeals.size > 0) {
    const queued = await queryAll<SyncQueueRow>(
      `SELECT * FROM sync_queue
        WHERE user_id = ? AND entity_type = ? AND status != 'IN_FLIGHT'`,
      [userId, MEAL_ITEM_ENTITY_TYPE],
      tx,
    );
    for (const row of queued) {
      const { payload, sensitive } = await readQueuePayload(row);
      const old = payload['meal_id'];
      const next = typeof old === 'string' ? renamedMeals.get(old) : undefined;
      if (!next) continue;
      await rewriteQueuedPayload(
        userId,
        row.op_id,
        { ...payload, meal_id: next },
        sensitive,
        nowIso,
        tx,
      );
    }
  }
  return renamed;
}

/**
 * One-time repair (BUG-044), run before a push: rename this user's earlier
 * logs and meals, queue the parent CREATEs they never had, and move the foods
 * that were waiting on them behind them with their backoff cleared, so nothing
 * logged before the fix is lost. Recorded in `app_metadata` once done; a
 * failure rolls everything back and is retried on the next push.
 */
export async function repairFoodLogParents(userId: string, nowIso: string): Promise<void> {
  const key = `${PARENTS_REPAIR_KEY}:${userId}`;
  const done = await queryFirst<{ value: string }>(`SELECT value FROM app_metadata WHERE key = ?`, [
    key,
  ]);
  if (done) return;

  await inTransaction(async (tx) => {
    await rekeyFoodLogParents(userId, nowIso, tx);
    let queuedParents = 0;

    const logs = await queryAll<{ id: string; date: string }>(
      `SELECT l.id, l.date FROM nutrition_logs l
        WHERE l.user_id = ? AND l.sync_status != 'synced' AND l.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM sync_queue q WHERE q.user_id = l.user_id AND q.entity_id = l.id)
        ORDER BY l.date`,
      [userId],
      tx,
    );
    for (const log of logs) {
      await enqueueCreate(
        userId,
        NUTRITION_LOG_ENTITY_TYPE,
        log.id,
        logPayload(log.date),
        nowIso,
        tx,
      );
      queuedParents += 1;
    }

    const meals = await queryAll<{ id: string; nutrition_log_id: string; type: MealTypeName }>(
      `SELECT m.id, m.nutrition_log_id, m.type FROM meals m
         JOIN nutrition_logs l ON l.id = m.nutrition_log_id
        WHERE m.user_id = ? AND m.sync_status != 'synced' AND m.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM sync_queue q WHERE q.user_id = m.user_id AND q.entity_id = m.id)
        ORDER BY l.date, m.order_index`,
      [userId],
      tx,
    );
    for (const meal of meals) {
      await enqueueCreate(
        userId,
        MEAL_ENTITY_TYPE,
        meal.id,
        mealPayload(meal.nutrition_log_id, meal.type),
        nowIso,
        tx,
      );
      queuedParents += 1;
    }

    if (queuedParents > 0) {
      const items = await queryAll<{ op_id: string }>(
        `SELECT op_id FROM sync_queue
          WHERE user_id = ? AND entity_type = ? AND status != 'IN_FLIGHT'
          ORDER BY rowid`,
        [userId, MEAL_ITEM_ENTITY_TYPE],
        tx,
      );
      await requeueAtEnd(
        userId,
        items.map((item) => item.op_id),
        nowIso,
        tx,
      );
    }

    await run(`INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)`, [key, nowIso], tx);
  });
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Pull applier: a day's log from the server (BUG-044). */
export async function applyServerNutritionLog(
  data: Record<string, unknown>,
  deleted: boolean,
  tx: SqlExecutor,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string; date: string };
  // An earlier local log for the same day (random id) is renamed first, so
  // the pulled row is the same row, never a second one for that day.
  const other = await queryFirst<{ id: string }>(
    `SELECT id FROM nutrition_logs WHERE user_id = ? AND date = ? AND id != ?`,
    [row.user_id, row.date, row.id],
    tx,
  );
  if (other) await rekeyFoodLogParents(row.user_id, new Date().toISOString(), tx);
  await run(
    `INSERT INTO nutrition_logs (id, user_id, created_at, updated_at, version, sync_status,
                                 deleted_at, deleted_by, date, notes)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       updated_at = excluded.updated_at, version = excluded.version, sync_status = 'synced',
       deleted_at = excluded.deleted_at, deleted_by = excluded.deleted_by,
       notes = excluded.notes`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      row.date,
      str(row['notes']),
    ],
    tx,
  );
}

/** Pull applier: a day's meal slot from the server (BUG-044). */
export async function applyServerMeal(
  data: Record<string, unknown>,
  deleted: boolean,
  tx: SqlExecutor,
): Promise<void> {
  const row = data as Record<string, unknown> & {
    id: string;
    user_id: string;
    nutrition_log_id: string;
    type: MealTypeName;
  };
  const other = await queryFirst<{ id: string }>(
    `SELECT id FROM meals WHERE nutrition_log_id = ? AND type = ? AND id != ? AND deleted_at IS NULL`,
    [row.nutrition_log_id, row.type, row.id],
    tx,
  );
  if (other) await rekeyFoodLogParents(row.user_id, new Date().toISOString(), tx);
  await run(
    `INSERT INTO meals (id, user_id, created_at, updated_at, version, sync_status,
                        deleted_at, deleted_by, nutrition_log_id, type, order_index)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       updated_at = excluded.updated_at, version = excluded.version, sync_status = 'synced',
       deleted_at = excluded.deleted_at, deleted_by = excluded.deleted_by,
       order_index = excluded.order_index`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      row.nutrition_log_id,
      row.type,
      Number(row['order_index'] ?? 0),
    ],
    tx,
  );
}

export async function markNutritionLogConflict(
  entityId: string,
  nowIso: string,
  userId: string,
): Promise<void> {
  await run(
    `UPDATE nutrition_logs SET sync_status = 'conflict', updated_at = ? WHERE id = ? AND user_id = ?`,
    [nowIso, entityId, userId],
  );
}

export async function markMealConflict(
  entityId: string,
  nowIso: string,
  userId: string,
): Promise<void> {
  await run(
    `UPDATE meals SET sync_status = 'conflict', updated_at = ? WHERE id = ? AND user_id = ?`,
    [nowIso, entityId, userId],
  );
}
