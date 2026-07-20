import { AppText } from '@/shared/presentation';

import type { BuiltInExercise } from '../domain/exercise-catalog';
import { matchExerciseExclusion } from '../domain/exercise-exclusion';

/**
 * Non-blocking caution shown against a built-in exercise whose movement
 * patterns intersect the plan's `excludedMovements` (ADR-P015 Phase 16 Slice
 * 7). Applies the Slice 2 deterministic matcher only — it never blocks the
 * action, recomputes, or overrides medical restrictions. Renders nothing when
 * the exercise is allowed, neutral (custom/unmapped), or unmatched.
 */
export function ExerciseExclusionNote({
  exercise,
  excludedMovements,
}: {
  exercise: BuiltInExercise | undefined;
  excludedMovements: readonly string[];
}) {
  const match = matchExerciseExclusion(exercise, excludedMovements);
  if (match.status !== 'excluded') return null;
  return (
    <AppText variant="caption" tone="warning">
      May conflict with your current plan: {match.matchedMovements.join(', ')}
    </AppText>
  );
}
