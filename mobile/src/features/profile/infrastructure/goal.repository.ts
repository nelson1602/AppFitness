import { inTransaction, queryFirst, run } from '../../../shared/infrastructure/database';
import type { GoalRow } from '../../../shared/infrastructure/database/types';
import { generateUuid } from '../../../shared/infrastructure/ids';
import { enqueue } from '../../../shared/infrastructure/sync';
import type { Goal, GoalInput } from '../domain/goal.types';
import { rowToGoal } from '../domain/goal.types';

/**
 * Local-first goal persistence. Setting a new goal preserves history
 * (MVP behavior + .ai/07_ICOACH.md Goal Engine): the previous active
 * goal is closed (is_active=0, ended_at), never overwritten, and a new
 * row is created. Both changes enqueue in the same transaction.
 */

const ENTITY_TYPE = 'goals';

export async function getActiveGoal(userId: string): Promise<Goal | null> {
  const row = await queryFirst<GoalRow>(
    `SELECT * FROM goals WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL
     ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
  return row ? rowToGoal(row) : null;
}

export async function setGoal(
  userId: string,
  input: GoalInput,
  nowIso: string = new Date().toISOString(),
): Promise<Goal> {
  return inTransaction(async () => {
    const current = await queryFirst<GoalRow>(
      `SELECT * FROM goals WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
      [userId],
    );

    if (current) {
      await run(
        `UPDATE goals SET is_active = 0, ended_at = ?, updated_at = ?, sync_status = 'pending'
         WHERE id = ?`,
        [nowIso, nowIso, current.id],
      );
      await enqueue(
        {
          opId: generateUuid(),
          entityType: ENTITY_TYPE,
          entityId: current.id,
          operation: 'UPDATE',
          payload: { is_active: 0, ended_at: nowIso },
          baseVersion: current.version,
        },
        nowIso,
      );
    }

    const id = generateUuid();
    await run(
      `INSERT INTO goals (
         id, user_id, created_at, updated_at, version, sync_status,
         goal_type, target_weight_kg, target_date, is_active, started_at, ended_at
       ) VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, 1, ?, NULL)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        input.goalType,
        input.targetWeightKg ?? null,
        input.targetDate ?? null,
        nowIso,
      ],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: ENTITY_TYPE,
        entityId: id,
        operation: 'CREATE',
        payload: {
          id,
          goal_type: input.goalType,
          target_weight_kg: input.targetWeightKg ?? null,
          target_date: input.targetDate ?? null,
          is_active: 1,
          started_at: nowIso,
          ended_at: null,
        },
        baseVersion: 0,
      },
      nowIso,
    );

    const row = await queryFirst<GoalRow>(`SELECT * FROM goals WHERE id = ?`, [id]);
    if (!row) throw new Error('goal row disappeared mid-transaction');
    return rowToGoal(row);
  });
}

/** Applies a pulled server goal (sync worker integration point). */
export async function applyServerGoal(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as unknown as Omit<GoalRow, 'is_active'> & { is_active: unknown };
  await run(
    `INSERT OR REPLACE INTO goals (
       id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
       goal_type, target_weight_kg, target_date, is_active, started_at, ended_at
     ) VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      row.created_at,
      row.updated_at,
      row.version,
      deleted ? (row.deleted_at ?? new Date().toISOString()) : null,
      row.deleted_by ?? null,
      row.goal_type,
      row.target_weight_kg,
      row.target_date,
      row.is_active === 1 || row.is_active === true ? 1 : 0,
      row.started_at,
      row.ended_at,
    ],
  );
}

export async function markGoalConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE goals SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}
