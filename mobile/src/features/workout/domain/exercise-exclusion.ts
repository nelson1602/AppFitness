import type { BuiltInExercise } from './exercise-catalog';

/**
 * Pure matcher between an exercise and the iCoach `TrainingPlan.excludedMovements`
 * (ADR-P015 Phase 16 Slice 2). Answers: given the plan's excluded movement
 * tokens (already computed by the deterministic engine, with absolute medical
 * priority), should this exercise be flagged?
 *
 * Advisory only — the caller NEVER hard-blocks and NEVER recomputes or overrides
 * medical restrictions. This module only READS `excludedMovements`; it does not
 * import or invoke the restriction/medical engine.
 *
 * Semantics (Option C hybrid):
 *  - Built-in exercise whose movement patterns intersect `excludedMovements`
 *    → `excluded` (with the matched tokens).
 *  - Built-in exercise with no intersection → `allowed`.
 *  - Custom / unmapped exercise (not in the built-in catalog, passed as null)
 *    → `neutral`: never auto-excluded, surfaced with a generic caution only.
 *
 * Deterministic and side-effect free.
 */

export type ExerciseExclusionStatus = 'excluded' | 'allowed' | 'neutral';

export interface ExerciseExclusionResult {
  status: ExerciseExclusionStatus;
  /** The exercise's movement patterns that are in `excludedMovements` (sorted). */
  matchedMovements: string[];
  /** True when the exercise is a mapped built-in (false → custom/neutral). */
  isBuiltIn: boolean;
}

export function matchExerciseExclusion(
  exercise: BuiltInExercise | null | undefined,
  excludedMovements: readonly string[],
): ExerciseExclusionResult {
  // Custom / unmapped exercise: no medical authority → always neutral.
  if (!exercise) {
    return { status: 'neutral', matchedMovements: [], isBuiltIn: false };
  }

  const excluded = new Set(excludedMovements);
  const matchedMovements = exercise.movementPatterns.filter((m) => excluded.has(m)).sort();

  return {
    status: matchedMovements.length > 0 ? 'excluded' : 'allowed',
    matchedMovements,
    isBuiltIn: true,
  };
}
