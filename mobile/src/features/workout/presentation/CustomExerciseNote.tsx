import { useLocalization } from '@/shared/localization';
import { AppText } from '@/shared/presentation';

/**
 * iCoach-neutrality caution for USER CUSTOM exercises (ADR-P015 Slice 3B/9,
 * D2/D5). Custom exercises are unmapped, so the deterministic limitation
 * matcher treats them as `neutral` and never auto-excludes them. This note sets
 * that expectation using public-v1 wellness language.
 */
export function CustomExerciseNote() {
  const { t } = useLocalization();
  return (
    <AppText
      variant="caption"
      tone="muted"
      accessibilityLabel={t('workout.custom.noteAccessibility')}
    >
      {t('workout.custom.note')}
    </AppText>
  );
}
