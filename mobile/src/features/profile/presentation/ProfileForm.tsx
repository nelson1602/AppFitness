import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppButton, AppText, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useProfileStore } from '../application/profile.store';
import { FormField } from './components/FormField';
import { FormSelect } from './components/FormSelect';
import {
  profileFormSchema,
  profileToFormValues,
  toProfileInput,
  type ProfileFormInput,
  type ProfileFormOutput,
} from './profile-form.schema';

const GENDER = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
  { label: 'Prefer not to say', value: 'UNDISCLOSED' },
] as const;
const FITNESS = [
  { label: 'Beginner', value: 'BEGINNER' },
  { label: 'Intermediate', value: 'INTERMEDIATE' },
  { label: 'Advanced', value: 'ADVANCED' },
] as const;
const ACTIVITY = [
  { label: 'Sedentary', value: 'SEDENTARY' },
  { label: 'Light', value: 'LIGHT' },
  { label: 'Moderate', value: 'MODERATE' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Very active', value: 'VERY_ACTIVE' },
] as const;

interface ProfileFormProps {
  /** Called after a successful local save (navigation is the caller's job). */
  onSaved: () => void;
}

/**
 * Profile create/edit form. Same screen serves first-time creation and
 * later edits (prefilled from the store). Validation is Zod; state is
 * RHF; persistence + sync are delegated to the store/service.
 */
export function ProfileForm({ onSaved }: ProfileFormProps) {
  const theme = useTheme();
  const { status, profile, error, load, save } = useProfileStore();

  const { control, handleSubmit, reset } = useForm<ProfileFormInput, unknown, ProfileFormOutput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileToFormValues(null),
  });

  useEffect(() => {
    void load();
  }, [load]);

  // Prefill once the profile loads (edit mode).
  useEffect(() => {
    if (profile) reset(profileToFormValues(profile));
  }, [profile, reset]);

  const onSubmit = async (values: ProfileFormOutput) => {
    const ok = await save(toProfileInput(values));
    if (ok) onSaved();
  };

  if (status === 'loading' || status === 'idle') {
    return <AppText accessibilityLabel="Loading profile">Loading…</AppText>;
  }

  const saving = status === 'saving';

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{profile ? 'Edit profile' : 'Create your profile'}</AppText>
        <AppText tone="muted">
          Saved on your device first, then synced. Required fields unlock your iCoach assessment.
        </AppText>
      </View>

      {error ? (
        <Banner title="Couldn’t save" tone="error">
          {error}
        </Banner>
      ) : null}

      <FormField
        control={control}
        name="birthDate"
        label="Birth date"
        placeholder="YYYY-MM-DD"
        required
      />
      <FormField
        control={control}
        name="heightCm"
        label="Height (cm)"
        keyboardType="numeric"
        required
      />
      <FormSelect control={control} name="gender" label="Gender" options={GENDER} />
      <FormSelect
        control={control}
        name="fitnessLevel"
        label="Fitness level"
        options={FITNESS}
        required
      />
      <FormSelect
        control={control}
        name="activityLevel"
        label="Activity level"
        options={ACTIVITY}
        required
      />
      <FormField
        control={control}
        name="yearsTraining"
        label="Years training"
        keyboardType="decimal-pad"
      />
      <FormField
        control={control}
        name="trainingDaysPerWeek"
        label="Training days / week"
        keyboardType="numeric"
      />
      <FormField
        control={control}
        name="sessionDurationMins"
        label="Session length (min)"
        keyboardType="numeric"
      />
      <FormField
        control={control}
        name="sleepHoursBaseline"
        label="Typical sleep (hours)"
        keyboardType="decimal-pad"
      />
      <FormField
        control={control}
        name="stressLevelBaseline"
        label="Typical stress (1–5)"
        keyboardType="numeric"
      />
      <FormField control={control} name="occupation" label="Occupation" />
      <FormField control={control} name="equipment" label="Equipment (comma separated)" />

      <AppButton
        accessibilityLabel="Save profile"
        loading={saving}
        onPress={() => void handleSubmit(onSubmit)()}
      >
        Save profile
      </AppButton>
    </View>
  );
}
