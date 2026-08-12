import { type TranslationKey, useLocalization } from '@/shared/localization';
import { AppText } from '@/shared/presentation';

import type { BuiltInExercise, MovementPattern } from '../domain/exercise-catalog';
import { matchExerciseExclusion } from '../domain/exercise-exclusion';

const MOVEMENT_KEYS: Readonly<Record<MovementPattern, TranslationKey>> = {
  deep_squat: 'workout.movement.deepSquat',
  lunge: 'workout.movement.lunge',
  jumping: 'workout.movement.jumping',
  running: 'workout.movement.running',
  sprinting: 'workout.movement.sprinting',
  high_impact_cardio: 'workout.movement.highImpactCardio',
  overhead_press: 'workout.movement.overheadPress',
  behind_neck_press: 'workout.movement.behindNeckPress',
  dips: 'workout.movement.dips',
  heavy_pressing: 'workout.movement.heavyPressing',
  front_rack_loading: 'workout.movement.frontRackLoading',
  skull_crushers: 'workout.movement.skullCrushers',
  heavy_hinge: 'workout.movement.heavyHinge',
  good_morning: 'workout.movement.goodMorning',
  loaded_spinal_flexion: 'workout.movement.loadedSpinalFlexion',
  loaded_carries: 'workout.movement.loadedCarries',
  bridging: 'workout.movement.bridging',
  max_effort_lifts: 'workout.movement.maxEffortLifts',
  valsalva_heavy_lifts: 'workout.movement.valsalvaHeavyLifts',
};

/**
 * Non-blocking caution shown against a built-in exercise whose movement
 * patterns intersect the supplied limitation tokens (ADR-P015 Phase 16 Slice
 * 7). Applies the deterministic matcher only; it never blocks the action or
 * recomputes limitations. Renders nothing when the exercise is allowed,
 * neutral (custom/unmapped), or unmatched.
 */
export function ExerciseExclusionNote({
  exercise,
  excludedMovements,
}: {
  exercise: BuiltInExercise | undefined;
  excludedMovements: readonly string[];
}) {
  const { t } = useLocalization();
  const match = matchExerciseExclusion(exercise, excludedMovements);
  if (match.status !== 'excluded') return null;
  const movements = match.matchedMovements
    .map((movement) => t(MOVEMENT_KEYS[movement as MovementPattern]))
    .join(', ');
  return (
    <AppText
      variant="caption"
      tone="warning"
      accessibilityLabel={t('workout.exclusion.accessibility')}
    >
      {t('workout.exclusion.warning')}: {movements}
    </AppText>
  );
}
