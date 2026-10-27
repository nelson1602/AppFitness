import {
  inTransaction,
  queryAll,
  queryFirst,
  run,
  type SqlExecutor,
} from '@/shared/infrastructure/database';
import type { WeeklyPlanRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import type { PlanNote, PlanTrigger, WeeklyPlan, WeeklyPlanContent } from '../domain/weekly-plan';

/**
 * Local-first persistence for the saved weekly plan (ADR-P042). A plan
 * revision is written as `pending` and its CREATE is enqueued in the SAME
 * transaction. Revisions are never edited: a mid-week change inserts a new
 * revision. Owner-scoped on every read. Synced as `sensitive` (wellness data).
 */
export const WEEKLY_PLAN_ENTITY = 'weekly_plans';

function str(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function rowToWeeklyPlan(row: WeeklyPlanRow): WeeklyPlan {
  return {
    id: row.id,
    userId: row.user_id,
    weekStart: row.week_start,
    revision: row.revision,
    effectiveFrom: row.effective_from,
    trigger: row.generation_trigger,
    loadStep: row.load_step,
    inputsFingerprint: row.inputs_fingerprint,
    ruleVersions: json<Record<string, string>>(row.rule_versions, {}),
    plan: json<WeeklyPlanContent>(row.plan, null as unknown as WeeklyPlanContent),
    notes: json<PlanNote[]>(row.notes, []),
    version: row.version,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface NewPlanRevision {
  weekStart: string;
  effectiveFrom: string;
  trigger: PlanTrigger;
  loadStep: number;
  inputsFingerprint: string;
  ruleVersions: Readonly<Record<string, string>>;
  plan: WeeklyPlanContent;
  notes: readonly PlanNote[];
}

/** Insert the next revision of a week (1 for a new week). Atomic with its enqueue. */
export async function insertPlanRevision(
  userId: string,
  input: NewPlanRevision,
  nowIso: string = new Date().toISOString(),
): Promise<WeeklyPlan> {
  return inTransaction(async (tx) => {
    const latest = await queryFirst<{ revision: number }>(
      `SELECT MAX(revision) AS revision FROM weekly_plans
        WHERE user_id = ? AND week_start = ? AND deleted_at IS NULL`,
      [userId, input.weekStart],
      tx,
    );
    const revision = (latest?.revision ?? 0) + 1;
    const id = generateUuid();
    const columns = {
      week_start: input.weekStart,
      revision,
      effective_from: input.effectiveFrom,
      generation_trigger: input.trigger,
      load_step: input.loadStep,
      inputs_fingerprint: input.inputsFingerprint,
      rule_versions: JSON.stringify(input.ruleVersions),
      plan: JSON.stringify(input.plan),
      notes: JSON.stringify(input.notes),
    };
    await run(
      `INSERT INTO weekly_plans (id, user_id, created_at, updated_at, version, sync_status,
         week_start, revision, effective_from, generation_trigger, load_step,
         inputs_fingerprint, rule_versions, plan, notes)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        columns.week_start,
        columns.revision,
        columns.effective_from,
        columns.generation_trigger,
        columns.load_step,
        columns.inputs_fingerprint,
        columns.rule_versions,
        columns.plan,
        columns.notes,
      ],
      tx,
    );
    await enqueue(
      {
        opId: generateUuid(),
        userId,
        entityType: WEEKLY_PLAN_ENTITY,
        entityId: id,
        operation: 'CREATE',
        payload: { id, ...columns },
        baseVersion: 0,
        sensitive: true,
      },
      nowIso,
      tx,
    );
    const row = await queryFirst<WeeklyPlanRow>(
      `SELECT * FROM weekly_plans WHERE id = ?`,
      [id],
      tx,
    );
    if (!row) throw new Error('weekly_plans row disappeared mid-transaction');
    return rowToWeeklyPlan(row);
  });
}

/** Every live revision of one week, oldest first. */
export async function listWeekRevisions(userId: string, weekStart: string): Promise<WeeklyPlan[]> {
  const rows = await queryAll<WeeklyPlanRow>(
    `SELECT * FROM weekly_plans WHERE user_id = ? AND week_start = ? AND deleted_at IS NULL
      ORDER BY revision ASC`,
    [userId, weekStart],
  );
  return rows.map(rowToWeeklyPlan);
}

/** Every live revision of every week before `beforeWeek`, newest week first. */
export async function listPastPlanRevisions(
  userId: string,
  beforeWeek: string,
): Promise<WeeklyPlan[]> {
  const rows = await queryAll<WeeklyPlanRow>(
    `SELECT * FROM weekly_plans WHERE user_id = ? AND week_start < ? AND deleted_at IS NULL
      ORDER BY week_start DESC, revision ASC`,
    [userId, beforeWeek],
  );
  return rows.map(rowToWeeklyPlan);
}

export async function applyServerWeeklyPlan(
  data: Record<string, unknown>,
  deleted: boolean,
  /** The connection this write must land on (BUG-015). */
  tx: SqlExecutor,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' ? value : JSON.stringify(value ?? JSON.parse(fallback));
  await run(
    `INSERT OR REPLACE INTO weekly_plans
       (id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
        week_start, revision, effective_from, generation_trigger, load_step,
        inputs_fingerprint, rule_versions, plan, notes)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['week_start']),
      Number(row['revision'] ?? 1),
      str(row['effective_from']),
      str(row['generation_trigger']),
      Number(row['load_step'] ?? 0),
      str(row['inputs_fingerprint']),
      text(row['rule_versions'], '{}'),
      text(row['plan'], '{}'),
      text(row['notes'], '[]'),
    ],
    tx,
  );
}

export async function markWeeklyPlanConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE weekly_plans SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}
