import type { WorkoutExercisePrescription } from '@/features/icoach/domain/workout-routine';
import { MAX_CARDIO_MINUTES, type CarryOverCardio } from '@/features/nutrition/domain/carry-over';

/**
 * Where the carry-over's cardio goes (ADR-P040 Addendum v11-B, C2): a real
 * block on the next scheduled workout, labelled "Añadido por el iCoach".
 * Pure and deterministic; an overlay, the saved plan is never written.
 *
 * - Each day over adds its minutes to the first scheduled session dated after
 *   it (a moved session counts on its new day). A session already behind
 *   today has passed: its block is gone.
 * - One session never takes more than `MAX_CARDIO_MINUTES`.
 * - A block the person removed stays removed. The removal is kept by the days
 *   over the block covered, not by the session's date, so it survives the
 *   session moving to another day (a missed session moves forward).
 */
export const ADDED_CARDIO_EXERCISE = 'exercise.brisk_walk';

/** Movements whose restriction rules the added cardio out (impact on the lower body). */
export const CARDIO_RESTRICTION_TOKENS: readonly string[] = [
  'high_impact_cardio',
  'running',
  'sprinting',
  'jumping',
];

/** The engine's safety flags that keep the plan at low intensity until cleared. */
export const CARDIO_SAFETY_FLAGS: readonly string[] = [
  'SAFETY:bp_crisis_block',
  'SAFETY:medical_clearance',
];

/**
 * False when the evaluation restricts this kind of exercise: an excluded
 * impact movement, or a safety flag that asks for medical clearance first.
 */
export function cardioAllowed(
  excludedMovements: readonly string[],
  recommendationIds: readonly string[],
): boolean {
  return (
    !excludedMovements.some((token) => CARDIO_RESTRICTION_TOKENS.includes(token)) &&
    !recommendationIds.some((id) => CARDIO_SAFETY_FLAGS.includes(id))
  );
}

export interface ScheduledSession {
  /** The day it trains (after any move). */
  date: string;
  sessionKey: string;
}

export interface AddedCardio {
  date: string;
  sessionKey: string;
  minutes: number;
  /** The days over that it covers. */
  fromDates: string[];
}

export function placeAddedCardio(input: {
  cardio: readonly CarryOverCardio[];
  sessions: readonly ScheduledSession[];
  today: string;
  /** Days over whose block the person removed ("Quitar"). */
  removedFromDates: readonly string[];
}): AddedCardio[] {
  const sessions = [...input.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const removed = new Set(input.removedFromDates);
  const byDate = new Map<string, AddedCardio>();
  for (const item of input.cardio) {
    if (removed.has(item.fromDate)) continue;
    const next = sessions.find((session) => session.date > item.fromDate);
    if (!next || next.date < input.today) continue;
    const previous = byDate.get(next.date);
    byDate.set(next.date, {
      date: next.date,
      sessionKey: next.sessionKey,
      minutes: Math.min(MAX_CARDIO_MINUTES, (previous?.minutes ?? 0) + item.minutes),
      fromDates: [...(previous?.fromDates ?? []), item.fromDate],
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The block as one more exercise of the session: one set of easy cardio. */
export function addedCardioExercise(minutes: number): WorkoutExercisePrescription {
  return {
    exerciseKey: ADDED_CARDIO_EXERCISE,
    sets: 1,
    target: { kind: 'DURATION_SECONDS', seconds: minutes * 60 },
    restSeconds: 0,
    targetRpe: 4,
    substitutions: [],
    explanationKeys: [],
  };
}
