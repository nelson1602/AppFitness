import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, FormField, FormSelect } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import {
  EXERCISE_CATEGORIES,
  normalizeExerciseName,
  type CustomExercise,
  type CustomExerciseInput,
} from '../domain/workout';
import { CustomExerciseNote } from './CustomExerciseNote';
import {
  createCustomExerciseFormSchema,
  customExerciseToFormValues,
  toCustomExerciseInput,
  type CustomExerciseFormInput,
  type CustomExerciseFormOutput,
} from './custom-exercise-form.schema';

interface CustomExerciseFormProps {
  /** Editing an existing custom exercise, or null/undefined to create. */
  initial?: CustomExercise | null;
  /** The user's current custom exercises — for owner-scoped duplicate detection. */
  existing: readonly CustomExercise[];
  saving: boolean;
  /** Persists the input (create/update). Returns true on success. */
  onSubmit: (input: CustomExerciseInput) => Promise<boolean>;
  /** Called after a successful submit (e.g. reset/close the form). */
  onDone?: () => void;
  /** Optional cancel affordance (inline quick-create). */
  onCancel?: () => void;
}

/**
 * Shared create/edit form for user custom exercises (ADR-P015 Slice 9). Reused
 * by the Exercise library screen and the inline "+ New exercise" quick-create
 * in the routine builder / workout log. RHF + Zod (design-system `FormField`/
 * `FormSelect`); persistence is delegated to the caller's `onSubmit` (store →
 * service → repository) — the UI never touches SQLite. Name is normalized to
 * match the repository; owner-scoped duplicate names are caught inline before
 * submit, with the repository/DB as the final guard.
 */
export function CustomExerciseForm({
  initial,
  existing,
  saving,
  onSubmit,
  onDone,
  onCancel,
}: CustomExerciseFormProps) {
  const theme = useTheme();
  const { t } = useLocalization();
  const schema = createCustomExerciseFormSchema(t('workout.custom.required'));
  const categoryLabels: Record<CustomExercise['category'], string> = {
    STRENGTH: t('workout.custom.categoryStrength'),
    CARDIO: t('workout.custom.categoryCardio'),
    FLEXIBILITY: t('workout.custom.categoryFlexibility'),
    BODYWEIGHT: t('workout.custom.categoryBodyweight'),
  };
  const categoryOptions = EXERCISE_CATEGORIES.map((category) => ({
    label: categoryLabels[category],
    value: category,
  }));
  const { control, handleSubmit, reset, setError } = useForm<
    CustomExerciseFormInput,
    unknown,
    CustomExerciseFormOutput
  >({
    resolver: zodResolver(schema),
    defaultValues: customExerciseToFormValues(initial ?? null),
  });

  useEffect(() => {
    reset(customExerciseToFormValues(initial ?? null));
  }, [initial, reset]);

  const rawName = useWatch({ control, name: 'name' }) ?? '';
  const normalizedName = normalizeExerciseName(rawName);
  const showNormalizedPreview = normalizedName.length > 0 && normalizedName !== rawName;

  const submit = async (values: CustomExerciseFormOutput) => {
    // Owner-scoped duplicate check against the in-memory list (names are stored
    // already-normalized). Exclude the row being edited.
    const clash = existing.some((e) => e.id !== initial?.id && e.name === values.name);
    if (clash) {
      setError('name', {
        type: 'duplicate',
        message: t('workout.custom.duplicateName'),
      });
      return;
    }
    const ok = await onSubmit(toCustomExerciseInput(values));
    if (ok) {
      reset(customExerciseToFormValues(initial ?? null));
      onDone?.();
    }
    // A false result (e.g. a duplicate the DB caught in a race) surfaces via the
    // store's error banner in the parent screen.
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <FormField
        control={control}
        name="name"
        label={t('workout.custom.name')}
        placeholder={t('workout.custom.namePlaceholder')}
        required
        selectTextOnFocus
      />
      {showNormalizedPreview ? (
        <AppText
          variant="caption"
          tone="muted"
          accessibilityLabel={t('workout.custom.normalizedAccessibility')}
        >
          {t('workout.custom.normalizedPrefix')}: {normalizedName}
        </AppText>
      ) : null}
      <FormField
        control={control}
        name="muscleGroup"
        label={t('workout.custom.muscleGroup')}
        placeholder={t('workout.custom.muscleGroupPlaceholder')}
        required
        selectTextOnFocus
      />
      <FormSelect
        control={control}
        name="category"
        label={t('workout.custom.category')}
        options={categoryOptions}
        required
      />
      <FormField
        control={control}
        name="instructions"
        label={t('workout.custom.instructions')}
        placeholder={t('workout.custom.instructionsPlaceholder')}
        selectTextOnFocus
      />

      <CustomExerciseNote />

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <AppButton
          accessibilityLabel={
            initial ? t('workout.custom.saveChanges') : t('workout.custom.addExerciseAccessibility')
          }
          testID="custom-exercise-submit"
          loading={saving}
          onPress={() => void handleSubmit(submit)()}
        >
          {initial ? t('workout.custom.saveChanges') : t('workout.custom.addExercise')}
        </AppButton>
        {onCancel ? (
          <AppButton
            accessibilityLabel={t('workout.custom.cancel')}
            testID="custom-exercise-cancel"
            variant="text"
            onPress={onCancel}
          >
            {t('workout.custom.cancel')}
          </AppButton>
        ) : null}
      </View>
    </View>
  );
}
