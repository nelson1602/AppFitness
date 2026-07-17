import { run } from '@/shared/infrastructure/database';

import { BUILT_IN_EXERCISES, getBuiltInExerciseById } from './exercise-catalog.data';
import type { BuiltInExercise } from '../domain/exercise-catalog';

/**
 * Built-in exercise seed (ADR-P015 exercise identity/seed slice). Seeds the
 * bundled built-in catalog into the local `exercises` table so the
 * `exercise_id → exercises(id)` FK is satisfiable when `routine_exercises` /
 * `workout_sets` land. Mirrors the nutrition `ensureFoodSeeded` on-demand
 * pattern.
 *
 * Idempotent + non-destructive: `INSERT OR IGNORE` never overwrites an existing
 * row, so a built-in row is never mutated and a user's CUSTOM exercise (a
 * different id, `created_by` set) is never touched. Built-ins are reference
 * data — inserted as `synced`, `created_by = NULL`, and never user-write synced.
 */

const INSERT_SQL = `INSERT OR IGNORE INTO exercises
   (id, created_at, updated_at, version, sync_status, name, muscle_group, category, instructions, created_by)
   VALUES (?, ?, ?, 1, 'synced', ?, ?, ?, NULL, NULL)`;

async function insertBuiltIn(e: BuiltInExercise, nowIso: string): Promise<void> {
  await run(INSERT_SQL, [e.id, nowIso, nowIso, e.name, e.muscleGroup, e.category]);
}

/** Seeds every built-in exercise (idempotent). Safe to call at each boot. */
export async function seedBuiltInExercises(
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  for (const e of BUILT_IN_EXERCISES) {
    await insertBuiltIn(e, nowIso);
  }
}

/**
 * Ensures a single built-in exercise row exists (on-demand, before a
 * routine_exercise/workout_set references it). A non-built-in id is a no-op —
 * custom exercises are seeded by their own (future) path, never here.
 */
export async function ensureBuiltInExerciseSeeded(
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<boolean> {
  const e = getBuiltInExerciseById(id);
  if (!e) return false;
  await insertBuiltIn(e, nowIso);
  return true;
}
