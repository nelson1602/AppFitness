import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, FormField, FormSelect } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useProfileStore } from '../application/profile.store';
import {
  createProfileFormSchema,
  profileToFormValues,
  toProfileInput,
  type ProfileFormInput,
  type ProfileFormOutput,
} from './profile-form.schema';

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
  const { t } = useLocalization();
  const { status, profile, error, load, save } = useProfileStore();
  const schema = createProfileFormSchema({
    dateFormat: t('profile.validation.dateFormat'),
    validDate: t('profile.validation.validDate'),
    greaterThanZero: t('profile.validation.greaterThanZero'),
    tooLarge: t('profile.validation.tooLarge'),
    cannotBeNegative: t('profile.validation.cannotBeNegative'),
    maxSeven: t('profile.validation.maxSeven'),
    scaleOneToFive: t('profile.validation.scaleOneToFive'),
  });
  const genderOptions = [
    { label: t('profile.gender.male'), value: 'MALE' },
    { label: t('profile.gender.female'), value: 'FEMALE' },
    { label: t('profile.gender.other'), value: 'OTHER' },
    { label: t('profile.gender.undisclosed'), value: 'UNDISCLOSED' },
  ] as const;
  const fitnessOptions = [
    { label: t('profile.fitness.beginner'), value: 'BEGINNER' },
    { label: t('profile.fitness.intermediate'), value: 'INTERMEDIATE' },
    { label: t('profile.fitness.advanced'), value: 'ADVANCED' },
  ] as const;
  const activityOptions = [
    { label: t('profile.activity.sedentary'), value: 'SEDENTARY' },
    { label: t('profile.activity.light'), value: 'LIGHT' },
    { label: t('profile.activity.moderate'), value: 'MODERATE' },
    { label: t('profile.activity.active'), value: 'ACTIVE' },
    { label: t('profile.activity.veryActive'), value: 'VERY_ACTIVE' },
  ] as const;

  const { control, handleSubmit, reset } = useForm<ProfileFormInput, unknown, ProfileFormOutput>({
    resolver: zodResolver(schema),
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

  // Local database is dormant on Web (ADR-P019): render an honest, info-tone
  // bilingual state — no form fields, validation, retry, or save controls, and
  // nothing implying the data could persist on Web.
  if (status === 'web-unavailable') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="headline">{t('profile.routeTitle')}</AppText>
        </View>
        <Banner title={t('profile.webUnavailableTitle')} tone="info">
          {t('profile.webUnavailableBody')}
        </Banner>
      </View>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <AppText accessibilityLabel={t('profile.loadingAccessibility')}>
        {t('profile.loading')}
      </AppText>
    );
  }

  const saving = status === 'saving';

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">
          {profile ? t('profile.editTitle') : t('profile.createTitle')}
        </AppText>
        <AppText tone="muted">{t('profile.subtitle')}</AppText>
      </View>

      {error ? (
        <Banner title={t('profile.errorTitle')} tone="error">
          {t('profile.errorMessage')}
        </Banner>
      ) : null}

      <FormField
        control={control}
        name="birthDate"
        label={t('profile.birthDate')}
        placeholder="YYYY-MM-DD"
        required
      />
      <FormField
        control={control}
        name="heightCm"
        label={t('profile.heightCm')}
        keyboardType="numeric"
        required
      />
      <FormSelect
        control={control}
        name="gender"
        label={t('profile.gender')}
        options={genderOptions}
      />
      <FormSelect
        control={control}
        name="fitnessLevel"
        label={t('profile.fitnessLevel')}
        options={fitnessOptions}
        required
      />
      <FormSelect
        control={control}
        name="activityLevel"
        label={t('profile.activityLevel')}
        options={activityOptions}
        required
      />
      <FormField
        control={control}
        name="yearsTraining"
        label={t('profile.yearsTraining')}
        keyboardType="decimal-pad"
      />
      <FormField
        control={control}
        name="trainingDaysPerWeek"
        label={t('profile.trainingDaysPerWeek')}
        keyboardType="numeric"
      />
      <FormField
        control={control}
        name="sessionDurationMins"
        label={t('profile.sessionDurationMins')}
        keyboardType="numeric"
      />
      <FormField
        control={control}
        name="sleepHoursBaseline"
        label={t('profile.sleepHoursBaseline')}
        keyboardType="decimal-pad"
      />
      <FormField
        control={control}
        name="stressLevelBaseline"
        label={t('profile.stressLevelBaseline')}
        keyboardType="numeric"
      />
      <FormField control={control} name="occupation" label={t('profile.occupation')} />
      <FormField control={control} name="equipment" label={t('profile.equipment')} />

      <AppButton
        accessibilityLabel={t('profile.save')}
        loading={saving}
        onPress={() => void handleSubmit(onSubmit)()}
      >
        {t('profile.save')}
      </AppButton>
    </View>
  );
}
