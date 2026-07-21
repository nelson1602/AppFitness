import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

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
  customExerciseFormSchema,
  customExerciseToFormValues,
  toCustomExerciseInput,
  type CustomExerciseFormInput,
  type CustomExerciseFormOutput,
} from './custom-exercise-form.schema';

const CATEGORY_LABELS: Record<CustomExercise['category'], string> = {
  STRENGTH: 'Strength',
  CARDIO: 'Cardio',
  FLEXIBILITY: 'Flexibility',
  BODYWEIGHT: 'Bodyweight',
};

const CATEGORY_OPTIONS = EXERCISE_CATEGORIES.map((c) => ({
  label: CATEGORY_LABELS[c],
  value: c,
}));

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
  const { control, handleSubmit, reset, setError } = useForm<
    CustomExerciseFormInput,
    unknown,
    CustomExerciseFormOutput
  >({
    resolver: zodResolver(customExerciseFormSchema),
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
        message: 'You already have a custom exercise with that name.',
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
        label="Name"
        placeholder="e.g. Zercher squat"
        required
      />
      {showNormalizedPreview ? (
        <AppText variant="caption" tone="muted" accessibilityLabel="Name will be saved as">
          Will be saved as: {normalizedName}
        </AppText>
      ) : null}
      <FormField
        control={control}
        name="muscleGroup"
        label="Muscle group"
        placeholder="e.g. legs"
        required
      />
      <FormSelect
        control={control}
        name="category"
        label="Category"
        options={CATEGORY_OPTIONS}
        required
      />
      <FormField
        control={control}
        name="instructions"
        label="Instructions (optional)"
        placeholder="How to perform it"
      />

      <CustomExerciseNote />

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <AppButton
          accessibilityLabel={initial ? 'Save changes' : 'Add custom exercise'}
          testID="custom-exercise-submit"
          loading={saving}
          onPress={() => void handleSubmit(submit)()}
        >
          {initial ? 'Save changes' : 'Add exercise'}
        </AppButton>
        {onCancel ? (
          <AppButton
            accessibilityLabel="Cancel"
            testID="custom-exercise-cancel"
            variant="text"
            onPress={onCancel}
          >
            Cancel
          </AppButton>
        ) : null}
      </View>
    </View>
  );
}
