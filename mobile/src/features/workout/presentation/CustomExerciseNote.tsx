import { AppText } from '@/shared/presentation';

/**
 * iCoach-neutrality caution for USER CUSTOM exercises (ADR-P015 Slice 3B/9,
 * D2/D5). Custom exercises are unmapped, so the deterministic exclusion matcher
 * treats them as `neutral` — they are NEVER auto-excluded and the engine's
 * `TrainingPlan` is never recomputed or overridden here. This note sets that
 * expectation honestly without implying medical safety.
 */
export function CustomExerciseNote() {
  return (
    <AppText variant="caption" tone="muted" accessibilityLabel="Custom exercise safety note">
      Custom exercises aren’t checked against your training-plan restrictions yet. Follow your
      provider’s guidance.
    </AppText>
  );
}
