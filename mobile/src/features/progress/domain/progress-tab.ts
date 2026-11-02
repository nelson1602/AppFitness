import type { CalorieDayEntry, WorkoutEntry } from '@/features/icoach/domain/progress-analysis';

import type { BodyMeasurement, BodyWeight } from './progress';

/**
 * Pure read models for the Progreso tab (v8.1, approved prototype): the weight
 * chart, the "Medidas" tiles with their change against about four weeks ago,
 * and "Resumen de la semana". Clock-free and deterministic — the caller passes
 * every date; identical inputs always produce identical outputs.
 */

// ── Weight chart ──────────────────────────────────────────────────────────────
/** The prototype draws eight points; older weights stay on the full progress screen. */
export const WEIGHT_CHART_MAX_POINTS = 8;

export interface WeightChartPoint {
  date: string;
  weightKg: number;
}

export interface WeightChartModel {
  /** Oldest → newest, at most `WEIGHT_CHART_MAX_POINTS`. */
  points: WeightChartPoint[];
  target: number | null;
  /** Whole-kilogram axis bounds, one kilogram of room around every value and the target. */
  min: number;
  max: number;
  /** Bottom, middle and top grid values (distinct, ascending). */
  ticks: number[];
}

/** Null when there is no weight to draw. `weightsNewestFirst` is the store's order. */
export function buildWeightChart(
  weightsNewestFirst: readonly Pick<BodyWeight, 'date' | 'weightKg'>[],
  target: number | null,
): WeightChartModel | null {
  if (weightsNewestFirst.length === 0) return null;
  const points = weightsNewestFirst
    .slice(0, WEIGHT_CHART_MAX_POINTS)
    .map(({ date, weightKg }) => ({ date, weightKg }))
    .reverse();
  const values = points.map((p) => p.weightKg);
  if (target !== null) values.push(target);
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const ticks = [...new Set([min, Math.round((min + max) / 2), max])];
  return { points, target, min, max, ticks };
}

// ── Measurements ──────────────────────────────────────────────────────────────
/** "vs. hace 4 semanas": the comparison reads the closest entry at least this old. */
export const MEASUREMENT_COMPARISON_DAYS = 28;

export type MeasurementMetric = 'waistCm' | 'hipCm' | 'chestCm' | 'bodyFatPct' | 'muscleMassKg';

/** The five metrics the measurement form stores, in the prototype's order. */
export const MEASUREMENT_METRICS: readonly MeasurementMetric[] = [
  'waistCm',
  'hipCm',
  'chestCm',
  'bodyFatPct',
  'muscleMassKg',
];

/**
 * Which way is an improvement. Lower waist, hip and body fat are better and more
 * muscle is better. Chest is neutral: a larger chest can be muscle or fat, so
 * its change is shown but never praised.
 */
const BETTER: Record<MeasurementMetric, 'lower' | 'higher' | 'neutral'> = {
  waistCm: 'lower',
  hipCm: 'lower',
  chestCm: 'neutral',
  bodyFatPct: 'lower',
  muscleMassKg: 'higher',
};

/**
 * `improved` is the success tone. `neutral` covers no change, a neutral metric
 * and a change the wrong way — the panel encourages and never alarms (the
 * prototype has only these two tones). `none`: no earlier value to compare.
 */
export type MeasurementTone = 'improved' | 'neutral' | 'none';

export interface MeasurementTile {
  metric: MeasurementMetric;
  /** The latest recorded value of this metric, or null if it was never recorded. */
  value: number | null;
  /** latest − comparison, rounded to one decimal; null without a comparison value. */
  delta: number | null;
  tone: MeasurementTone;
}

function daysBetween(earlier: string, later: string): number {
  const ms = Date.parse(`${later}T00:00:00.000Z`) - Date.parse(`${earlier}T00:00:00.000Z`);
  return Math.round(ms / 86_400_000);
}

function toneOf(metric: MeasurementMetric, delta: number | null): MeasurementTone {
  if (delta === null) return 'none';
  const better = BETTER[metric];
  if (delta === 0 || better === 'neutral') return 'neutral';
  return (better === 'lower' ? delta < 0 : delta > 0) ? 'improved' : 'neutral';
}

/**
 * One tile per metric. Each metric is read on its own — an entry may record
 * only some of them — so the value is that metric's latest reading and the
 * comparison is its newest reading at least `MEASUREMENT_COMPARISON_DAYS`
 * before that. Null when nothing at all was ever recorded.
 */
export function buildMeasurementTiles(
  measurementsNewestFirst: readonly BodyMeasurement[],
): MeasurementTile[] | null {
  if (measurementsNewestFirst.length === 0) return null;
  return MEASUREMENT_METRICS.map((metric) => {
    const readings = measurementsNewestFirst.filter((m) => m[metric] !== null);
    const latest = readings[0];
    if (!latest) return { metric, value: null, delta: null, tone: 'none' };
    const value = latest[metric] as number;
    const earlier = readings.find(
      (m) => daysBetween(m.date, latest.date) >= MEASUREMENT_COMPARISON_DAYS,
    );
    const delta = earlier ? Math.round((value - (earlier[metric] as number)) * 10) / 10 : null;
    return { metric, value, delta, tone: toneOf(metric, delta) };
  });
}

// ── This week ─────────────────────────────────────────────────────────────────
export interface WeekSummaryInput {
  /** ISO Monday of the week to summarize. */
  weekStart: string;
  /** Workout logs with their completed-set volume (any dates; filtered here). */
  workouts: readonly WorkoutEntry[];
  /** Logged nutrition days (any dates; filtered here). */
  calorieDays: readonly CalorieDayEntry[];
  /** Workouts done against the saved week's plan; `planned` null without a plan. */
  done: number;
  planned: number | null;
}

export interface WeekSummary {
  /** Null without a saved plan for the week. */
  workouts: { done: number; planned: number } | null;
  /** Σ weight × reps of this week's completed sets; null with no workout logged. */
  volumeKg: number | null;
  /** Mean daily kcal over this week's logged days, whole kcal; null with none logged. */
  avgKcal: number | null;
}

function inWeek(date: string, weekStart: string): boolean {
  const offset = daysBetween(weekStart, date);
  return offset >= 0 && offset <= 6;
}

export function buildWeekSummary(input: WeekSummaryInput): WeekSummary {
  const workouts = input.workouts.filter((w) => inWeek(w.date, input.weekStart));
  const days = input.calorieDays.filter((d) => inWeek(d.date, input.weekStart));
  const volume = workouts.reduce((sum, w) => sum + w.volumeKg, 0);
  return {
    workouts: input.planned === null ? null : { done: input.done, planned: input.planned },
    volumeKg: workouts.length === 0 ? null : Math.round(volume * 10) / 10,
    avgKcal:
      days.length === 0
        ? null
        : Math.round(days.reduce((sum, d) => sum + d.calories, 0) / days.length),
  };
}
