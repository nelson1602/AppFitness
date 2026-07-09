import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppButton, AppText, Banner, FormField, FormSelect } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useGoalStore } from '../application/goal.store';
import {
  goalFormSchema,
  goalToFormValues,
  toGoalInput,
  type GoalFormInput,
  type GoalFormOutput,
} from './goal-form.schema';

const GOAL_OPTIONS = [
  { label: 'Fat loss', value: 'FAT_LOSS' },
  { label: 'Muscle gain', value: 'MUSCLE_GAIN' },
  { label: 'Recomposition', value: 'RECOMPOSITION' },
  { label: 'Strength', value: 'STRENGTH' },
  { label: 'Endurance', value: 'ENDURANCE' },
  { label: 'General health', value: 'GENERAL_HEALTH' },
  { label: 'Rehabilitation', value: 'REHABILITATION' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
] as const;

interface GoalFormProps {
  /** Called after a successful local save (navigation is the caller's job). */
  onSaved: () => void;
}

/**
 * Goal create/edit form. The same screen serves first-time creation
 * (no active goal yet) and later edits (prefilled from the store).
 * Validation is Zod; state is RHF; persistence + sync are delegated to the
 * store/service. Setting a goal is history-preserving in the repository.
 */
export function GoalForm({ onSaved }: GoalFormProps) {
  const theme = useTheme();
  const { status, goal, error, load, save } = useGoalStore();

  const { control, handleSubmit, reset } = useForm<GoalFormInput, unknown, GoalFormOutput>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goalToFormValues(null),
  });

  useEffect(() => {
    void load();
  }, [load]);

  // Prefill once the active goal loads (edit mode).
  useEffect(() => {
    if (goal) reset(goalToFormValues(goal));
  }, [goal, reset]);

  const onSubmit = async (values: GoalFormOutput) => {
    const ok = await save(toGoalInput(values));
    if (ok) onSaved();
  };

  if (status === 'loading' || status === 'idle') {
    return <AppText accessibilityLabel="Loading goal">Loading…</AppText>;
  }

  const saving = status === 'saving';

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{goal ? 'Edit goal' : 'Set your goal'}</AppText>
        <AppText tone="muted">
          Saved on your device first, then synced automatically. Your goal personalizes calorie and
          training adjustments.
        </AppText>
      </View>

      {error ? (
        <Banner title="Couldn’t save" tone="error">
          {error}
        </Banner>
      ) : null}

      {/* Conflict wins over the pending hint: an unresolved conflict is the
          more important thing for the user to understand. */}
      {!error && goal?.syncStatus === 'conflict' ? (
        <Banner title="Sync conflict" tone="warning">
          This goal has a sync conflict. Saving records a fresh goal on this device and re-queues it
          for sync.
        </Banner>
      ) : null}
      {!error && goal?.syncStatus === 'pending' ? (
        <Banner title="Saved on this device" tone="info">
          Your latest goal is saved locally and waiting to sync.
        </Banner>
      ) : null}

      <FormSelect control={control} name="goalType" label="Goal" options={GOAL_OPTIONS} required />
      <FormField
        control={control}
        name="targetWeightKg"
        label="Target weight (kg)"
        keyboardType="decimal-pad"
      />
      <FormField control={control} name="targetDate" label="Target date" placeholder="YYYY-MM-DD" />

      <AppButton
        accessibilityLabel="Save goal"
        loading={saving}
        onPress={() => void handleSubmit(onSubmit)()}
      >
        Save goal
      </AppButton>
    </View>
  );
}
