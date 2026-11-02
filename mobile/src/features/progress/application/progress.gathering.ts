import {
  computeWeeklyProgressSnapshots,
  type CalorieDayEntry,
  type ProgressAnalysisInput,
  type WorkoutEntry,
} from '@/features/icoach/domain/progress-analysis';
import { listDailyCalorieTotals } from '@/features/nutrition';
import { listRecentWorkoutLogs, listWorkoutSets } from '@/features/workout';

import type { ProgressSnapshot } from '../domain/progress';
import { listBodyWeights, upsertProgressSnapshot } from '../infrastructure/progress.repository';

/**
 * Progress gathering service (ADR-P016 Phase 17 Slice 4c). Reads the local
 * wellness sources, runs the pure Slice 4a deterministic engine, and upserts the
 * resulting weekly snapshots. Feed-not-override: this only READS other domains
 * (body weights, workout logs/sets, nutrition daily totals via their public
 * APIs) and WRITES `progress_snapshots` — it never mutates the TrainingPlan,
 * nutrition targets, or medical state (D5).
 *
 * Cross-feature reads go through the workout/nutrition PUBLIC APIs (never their
 * infrastructure), matching the dashboard aggregation pattern.
 */

// How much history to roll up (generous bounds; snapshots are cheap + idempotent).
const WORKOUT_LOG_LIMIT = 1000;

/**
 * Resolve an ISO timestamp to a user-local `YYYY-MM-DD` using the DEVICE
 * timezone (ADR-P016 Slice 4c v1 decision; a persisted per-row offset is a
 * future refinement). The gathering layer — not the pure engine — owns this
 * clock/tz-dependent resolution so the engine stays deterministic.
 */
export function deviceLocalDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Σ(weight_kg × reps) over a log's completed sets — the snapshot engine's volume rule. */
export function completedVolumeKg(
  sets: readonly { completed: boolean; weightKg: number | null; reps: number | null }[],
): number {
  return sets.reduce(
    (sum, set) => (set.completed ? sum + (set.weightKg ?? 0) * (set.reps ?? 0) : sum),
    0,
  );
}

// The Progreso tab reads only the current week; this bounds the logs it scans.
const WEEK_WORKOUT_LOG_LIMIT = 100;

export interface WeekActivity {
  weekStart: string;
  workouts: WorkoutEntry[];
  calorieDays: CalorieDayEntry[];
}

/**
 * The current week's workout volumes and logged calorie days for the Progreso
 * tab's "Resumen de la semana" (v8.1). Read-only — unlike `recomputeSnapshots`
 * it writes nothing, so opening the tab never enqueues a sync change. Only logs
 * started on or after `weekStart` load their sets.
 */
export async function gatherWeekActivity(userId: string, weekStart: string): Promise<WeekActivity> {
  const [logs, calorieDays] = await Promise.all([
    listRecentWorkoutLogs(userId, WEEK_WORKOUT_LOG_LIMIT),
    listDailyCalorieTotals(userId),
  ]);
  const workouts: WorkoutEntry[] = [];
  for (const log of logs) {
    const date = deviceLocalDate(log.startedAt);
    if (date < weekStart) continue;
    const sets = await listWorkoutSets(userId, log.id);
    workouts.push({ date, volumeKg: completedVolumeKg(sets) });
  }
  return {
    weekStart,
    workouts,
    calorieDays: calorieDays
      .filter((day) => day.date >= weekStart)
      .map((day) => ({ date: day.date, calories: day.calories })),
  };
}

/** Build the pure-engine input from the local wellness sources. */
export async function gatherProgressInputs(userId: string): Promise<ProgressAnalysisInput> {
  const [weights, logs, calorieDays] = await Promise.all([
    listBodyWeights(userId, 3650),
    listRecentWorkoutLogs(userId, WORKOUT_LOG_LIMIT),
    listDailyCalorieTotals(userId),
  ]);

  const workouts: WorkoutEntry[] = [];
  for (const log of logs) {
    const sets = await listWorkoutSets(userId, log.id);
    workouts.push({ date: deviceLocalDate(log.startedAt), volumeKg: completedVolumeKg(sets) });
  }

  return {
    weights: weights.map((w) => ({ date: w.date, weightKg: w.weightKg })),
    workouts,
    calorieDays: calorieDays.map((c) => ({ date: c.date, calories: c.calories })),
  };
}

/**
 * Recompute all weekly snapshots deterministically from local data and upsert
 * them (id-stable per `(user, week_start, rule_version)`). Returns the upserted
 * snapshots (ascending week order from the engine).
 */
export async function recomputeSnapshots(
  userId: string,
  nowIso?: string,
): Promise<ProgressSnapshot[]> {
  const input = await gatherProgressInputs(userId);
  const computed = computeWeeklyProgressSnapshots(input);
  const out: ProgressSnapshot[] = [];
  for (const snap of computed) {
    out.push(await upsertProgressSnapshot(userId, snap, nowIso));
  }
  return out;
}
