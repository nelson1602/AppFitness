import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, FormField, FormSelect } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useGoalStore } from '../application/goal.store';
import {
  createGoalFormSchema,
  goalToFormValues,
  toGoalInput,
  type GoalFormInput,
  type GoalFormOutput,
} from './goal-form.schema';

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
  const { t } = useLocalization();
  const { status, goal, error, load, save } = useGoalStore();
  const schema = createGoalFormSchema({
    greaterThanZero: t('goal.validation.greaterThanZero'),
    tooLarge: t('goal.validation.tooLarge'),
    dateFormat: t('goal.validation.dateFormat'),
    validDate: t('goal.validation.validDate'),
  });
  const goalOptions = [
    { label: t('goal.type.fatLoss'), value: 'FAT_LOSS' },
    { label: t('goal.type.muscleGain'), value: 'MUSCLE_GAIN' },
    { label: t('goal.type.recomposition'), value: 'RECOMPOSITION' },
    { label: t('goal.type.strength'), value: 'STRENGTH' },
    { label: t('goal.type.endurance'), value: 'ENDURANCE' },
    { label: t('goal.type.generalHealth'), value: 'GENERAL_HEALTH' },
    { label: t('goal.type.maintenance'), value: 'MAINTENANCE' },
  ] as const;

  const { control, handleSubmit, reset } = useForm<GoalFormInput, unknown, GoalFormOutput>({
    resolver: zodResolver(schema),
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
    return (
      <AppText accessibilityLabel={t('goal.loadingAccessibility')}>{t('goal.loading')}</AppText>
    );
  }

  const saving = status === 'saving';

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{goal ? t('goal.editTitle') : t('goal.createTitle')}</AppText>
        <AppText tone="muted">{t('goal.subtitle')}</AppText>
      </View>

      {error ? (
        <Banner title={t('goal.errorTitle')} tone="error">
          {t('goal.errorMessage')}
        </Banner>
      ) : null}

      {/* Conflict wins over the pending hint: an unresolved conflict is the
          more important thing for the user to understand. */}
      {!error && goal?.syncStatus === 'conflict' ? (
        <Banner title={t('goal.conflictTitle')} tone="warning">
          {t('goal.conflictMessage')}
        </Banner>
      ) : null}
      {!error && goal?.syncStatus === 'pending' ? (
        <Banner title={t('goal.pendingTitle')} tone="info">
          {t('goal.pendingMessage')}
        </Banner>
      ) : null}

      <FormSelect
        control={control}
        name="goalType"
        label={t('goal.typeLabel')}
        options={goalOptions}
        required
      />
      <FormField
        control={control}
        name="targetWeightKg"
        label={t('goal.targetWeightKg')}
        keyboardType="decimal-pad"
      />
      <FormField
        control={control}
        name="targetDate"
        label={t('goal.targetDate')}
        placeholder={t('goal.targetDatePlaceholder')}
      />

      <AppButton
        accessibilityLabel={t('goal.save')}
        loading={saving}
        onPress={() => void handleSubmit(onSubmit)()}
      >
        {t('goal.save')}
      </AppButton>
    </View>
  );
}
