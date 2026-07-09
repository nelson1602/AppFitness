import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppButton, AppText, Banner, FormField, FormSelect } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useEvaluationStore } from '../application/evaluation.store';
import {
  evaluationFormDefaults,
  evaluationFormSchema,
  toEvaluationInput,
  type EvaluationFormInput,
  type EvaluationFormOutput,
} from './evaluation-form.schema';

const ACTIVITY = [
  { label: 'Sedentary', value: 'SEDENTARY' },
  { label: 'Light', value: 'LIGHT' },
  { label: 'Moderate', value: 'MODERATE' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Very active', value: 'VERY_ACTIVE' },
] as const;

interface EvaluationFormProps {
  /** Called after a successful local save (navigation is the caller's job). */
  onSaved: () => void;
}

/**
 * Physical evaluation entry form (Phase 14 Slice 1). Records a NEW
 * evaluation each time (evaluations are append-only). Validation is Zod;
 * state is RHF; persistence, field-level encryption of sensitive free-text,
 * and sync are all delegated to the store/service/repository. Sensitive
 * values are never logged here.
 */
export function EvaluationForm({ onSaved }: EvaluationFormProps) {
  const theme = useTheme();
  const { status, latest, error, load, save } = useEvaluationStore();

  const { control, handleSubmit } = useForm<EvaluationFormInput, unknown, EvaluationFormOutput>({
    resolver: zodResolver(evaluationFormSchema),
    defaultValues: evaluationFormDefaults(),
  });

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (values: EvaluationFormOutput) => {
    const ok = await save(toEvaluationInput(values));
    if (ok) onSaved();
  };

  if (status === 'loading' || status === 'idle') {
    return <AppText accessibilityLabel="Loading evaluations">Loading…</AppText>;
  }

  const saving = status === 'saving';

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Record an evaluation</AppText>
        <AppText tone="muted">
          Saved on your device first, then synced. Weight unlocks your iCoach assessment. Notes are
          encrypted on your device.
        </AppText>
        {latest ? (
          <AppText variant="caption" tone="muted">
            Last recorded {latest.evaluationDate}
          </AppText>
        ) : null}
      </View>

      {error ? (
        <Banner title="Couldn’t save" tone="error">
          {error}
        </Banner>
      ) : null}

      <FormField
        control={control}
        name="evaluationDate"
        label="Evaluation date"
        placeholder="YYYY-MM-DD"
        required
      />
      <FormField
        control={control}
        name="weightKg"
        label="Weight (kg)"
        keyboardType="decimal-pad"
        required
      />
      <FormField
        control={control}
        name="bodyFatPct"
        label="Body fat (%)"
        keyboardType="decimal-pad"
      />
      <FormField
        control={control}
        name="muscleMassKg"
        label="Muscle mass (kg)"
        keyboardType="decimal-pad"
      />
      <FormField
        control={control}
        name="bloodPressureSystolic"
        label="Blood pressure — systolic"
        keyboardType="numeric"
      />
      <FormField
        control={control}
        name="bloodPressureDiastolic"
        label="Blood pressure — diastolic"
        keyboardType="numeric"
      />
      <FormField
        control={control}
        name="restingHeartRate"
        label="Resting heart rate (bpm)"
        keyboardType="numeric"
      />
      <FormField
        control={control}
        name="sleepQuality"
        label="Sleep quality (1–5)"
        keyboardType="numeric"
      />
      <FormField
        control={control}
        name="stressLevel"
        label="Stress level (1–5)"
        keyboardType="numeric"
      />
      <FormSelect
        control={control}
        name="activityLevel"
        label="Activity level"
        options={ACTIVITY}
      />
      <FormField control={control} name="doctorNotes" label="Doctor notes" />
      <FormField control={control} name="medicalConditions" label="Medical conditions" />
      <FormField control={control} name="medications" label="Medications" />

      <AppButton
        accessibilityLabel="Save evaluation"
        loading={saving}
        onPress={() => void handleSubmit(onSubmit)()}
      >
        Save evaluation
      </AppButton>
    </View>
  );
}
