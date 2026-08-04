import { ENGINE_RULE_VERSION } from './rule-versions';

/**
 * Deterministic weekly progress-snapshot engine (ADR-P016 Phase 17 Slice 4a,
 * D2/D4/D6). PURE: no `Date.now`, no argless `new Date()`, no storage, network,
 * or device APIs — identical inputs always produce identical outputs
 * (07_ICOACH). All inputs carry PRE-RESOLVED user-local calendar dates
 * (`YYYY-MM-DD`); the IO/gathering layer (Slice 4c) is responsible for resolving
 * workout timestamps to local dates before calling this engine.
 *
 * This is a descriptive PROGRESS SIGNAL only. It never recomputes or mutates the
 * `TrainingPlan`, nutrition targets, medical restrictions, or doctor state
 * (feed-not-override, ADR-P016 D5). `is_deload_week` is an output field, not a
 * plan directive.
 */

/** A body-weight entry on a user-local calendar date. */
export interface WeightEntry {
  /** User-local `YYYY-MM-DD`. */
  date: string;
  weightKg: number;
}

/** One workout_log: its user-local date and completed-set training volume (kg). */
export interface WorkoutEntry {
  /** User-local `YYYY-MM-DD` of the log (derived from started_at by the caller). */
  date: string;
  /** Σ(weight_kg × reps) over completed sets for this log; >= 0. */
  volumeKg: number;
}

/** One logged nutrition day and its consumed calories total. */
export interface CalorieDayEntry {
  /** User-local `YYYY-MM-DD`. */
  date: string;
  calories: number;
}

export interface ProgressAnalysisInput {
  weights: readonly WeightEntry[];
  workouts: readonly WorkoutEntry[];
  calorieDays: readonly CalorieDayEntry[];
}

/** A computed weekly snapshot (domain shape; snake_case persistence is Slice 4c). */
export interface WeeklyProgressSnapshot {
  /** ISO-Monday (`YYYY-MM-DD`) of the week, in the same user-local calendar. */
  weekStart: string;
  avgWeightKg: number | null;
  totalVolumeKg: number;
  avgCalories: number | null;
  workoutCount: number;
  isDeloadWeek: boolean;
  /** The engine rule version that produced this snapshot. */
  ruleVersion: string;
}

const DELOAD_LOOKBACK_WEEKS = 3;
const DELOAD_FRACTION = 0.6;

/** Half-up rounding to `places` decimals; deterministic for finite inputs. */
function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * ISO-Monday (`YYYY-MM-DD`) of the week containing the given local calendar
 * date. The date string is treated as a tz-agnostic calendar date (parsed at
 * UTC midnight, shifted in whole days) so the result never drifts with the host
 * timezone — purely deterministic.
 */
export function isoWeekStart(localDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new Error(`isoWeekStart: expected YYYY-MM-DD, got "${localDate}"`);
  }
  const d = new Date(`${localDate}T00:00:00.000Z`);
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offsetToMonday);
  return d.toISOString().slice(0, 10);
}

function mean(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Compute one deterministic snapshot per week present in ANY input, sorted by
 * `weekStart` ascending. A week appears if it has at least one weigh-in,
 * workout, or logged-calorie day.
 * - `avgWeightKg` / `avgCalories` are null when that week has no such entries.
 * - `totalVolumeKg` is the sum of the week's workout volumes (0 if none).
 * - `workoutCount` is the number of workout logs in the week.
 * - `isDeloadWeek`: false unless there are >= 3 prior nonzero-volume weeks and
 *   the current week's volume is > 0 and < 0.6 × mean of those 3 most-recent
 *   prior nonzero-volume weekly volumes (ADR-P016 Slice 4a decision).
 */
export function computeWeeklyProgressSnapshots(
  input: ProgressAnalysisInput,
): WeeklyProgressSnapshot[] {
  const weeks = new Map<
    string,
    { weights: number[]; volumes: number[]; workoutCount: number; calories: number[] }
  >();

  const week = (localDate: string) => {
    const key = isoWeekStart(localDate);
    let bucket = weeks.get(key);
    if (!bucket) {
      bucket = { weights: [], volumes: [], workoutCount: 0, calories: [] };
      weeks.set(key, bucket);
    }
    return bucket;
  };

  for (const w of input.weights) week(w.date).weights.push(w.weightKg);
  for (const wk of input.workouts) {
    const bucket = week(wk.date);
    bucket.volumes.push(wk.volumeKg);
    bucket.workoutCount += 1;
  }
  for (const c of input.calorieDays) week(c.date).calories.push(c.calories);

  // Ascending week order gives deterministic output + a well-defined "prior weeks".
  const orderedKeys = [...weeks.keys()].sort();

  // First pass: base metrics (needed before the deload look-back).
  const base = orderedKeys.map((weekStart) => {
    const b = weeks.get(weekStart)!;
    const totalVolumeKg = round(
      b.volumes.reduce((s, v) => s + v, 0),
      2,
    );
    return {
      weekStart,
      avgWeightKg: b.weights.length ? round(mean(b.weights), 2) : null,
      totalVolumeKg,
      avgCalories: b.calories.length ? Math.round(mean(b.calories)) : null,
      workoutCount: b.workoutCount,
    };
  });

  // Second pass: deload flag from the 3 most-recent prior nonzero-volume weeks.
  return base.map((snap, i) => {
    let isDeloadWeek = false;
    if (snap.totalVolumeKg > 0) {
      const priorNonzero = base
        .slice(0, i)
        .filter((s) => s.totalVolumeKg > 0)
        .slice(-DELOAD_LOOKBACK_WEEKS);
      if (priorNonzero.length === DELOAD_LOOKBACK_WEEKS) {
        const baseline = mean(priorNonzero.map((s) => s.totalVolumeKg));
        isDeloadWeek = snap.totalVolumeKg < DELOAD_FRACTION * baseline;
      }
    }
    return { ...snap, isDeloadWeek, ruleVersion: ENGINE_RULE_VERSION };
  });
}
