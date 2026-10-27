import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { useLocalDay } from '@/shared/application/local-day';
import { AppButton, AppText, FormDateField, FormField } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { BodyMeasurementInput } from '../domain/progress';
import {
  blankBodyMeasurementValues,
  createBodyMeasurementFormSchema,
  toBodyMeasurementInput,
  type BodyMeasurementFormInput,
  type BodyMeasurementFormOutput,
} from './progress-forms.schema';

interface BodyMeasurementFormProps {
  /** User-local `YYYY-MM-DD` prefilled as the entry date (resolved by the caller). */
  defaultDate: string;
  saving: boolean;
  /** Persists the entry (store → repository). Returns true on success. */
  onSubmit: (input: BodyMeasurementInput) => Promise<boolean>;
}

/**
 * Body-measurement entry form (ADR-P016 Phase 17 Slice 5a). RHF + Zod with the
 * design-system `FormField`. Public-v1 wellness scope: at least one visible
 * metric is required; waist, hip, chest, body-fat %, and muscle mass are
 * independently optional. Persistence is
 * delegated to the caller's `onSubmit` — the UI never touches SQLite. Resets to
 * a blank form (date re-prefilled) after a successful save.
 */
export function BodyMeasurementForm({ defaultDate, saving, onSubmit }: BodyMeasurementFormProps) {
  const theme = useTheme();
  const { t } = useLocalization();
  const today = useLocalDay((s) => s.today);
  const schema = createBodyMeasurementFormSchema({
    dateFormat: t('progress.validation.dateFormat'),
    validDate: t('progress.validation.validDate'),
    waistPositive: t('progress.validation.waistPositive'),
    hipPositive: t('progress.validation.hipPositive'),
    chestPositive: t('progress.validation.chestPositive'),
    tooLarge: t('progress.validation.tooLarge'),
    bodyFatPositive: t('progress.validation.bodyFatPositive'),
    bodyFatRange: t('progress.validation.bodyFatRange'),
    muscleMassRange: t('progress.measurements.muscleMassRange'),
    atLeastOne: t('progress.measurements.atLeastOne'),
  });
  const { control, handleSubmit, reset } = useForm<
    BodyMeasurementFormInput,
    unknown,
    BodyMeasurementFormOutput
  >({
    resolver: zodResolver(schema),
    defaultValues: blankBodyMeasurementValues(defaultDate),
  });

  const submit = async (values: BodyMeasurementFormOutput): Promise<void> => {
    const ok = await onSubmit(toBodyMeasurementInput(values));
    if (ok) reset(blankBodyMeasurementValues(defaultDate));
    // A false result surfaces via the parent screen's error banner.
  };

  return (
    <View
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={t('progress.measurements.accessibility')}
    >
      <AppText variant="title">{t('progress.measurements.title')}</AppText>
      {/* v8 Block 3 (ADR-P043): the native picker, never a future date. */}
      <FormDateField
        control={control}
        name="date"
        label={t('progress.measurements.date')}
        maximumDate={today}
        required
      />
      <FormField
        control={control}
        name="waistCm"
        label={t('progress.measurements.waist')}
        placeholder={t('progress.measurements.waistPlaceholder')}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="hipCm"
        label={t('progress.measurements.hip')}
        placeholder={t('progress.measurements.hipPlaceholder')}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="chestCm"
        label={t('progress.measurements.chest')}
        placeholder={t('progress.measurements.chestPlaceholder')}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="bodyFatPct"
        label={t('progress.measurements.bodyFat')}
        placeholder={t('progress.measurements.bodyFatPlaceholder')}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="muscleMassKg"
        label={t('progress.measurements.muscleMass')}
        placeholder={t('progress.measurements.muscleMassPlaceholder')}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="notes"
        label={t('progress.measurements.notes')}
        placeholder={t('progress.measurements.notesPlaceholder')}
        selectTextOnFocus
      />
      <AppButton
        accessibilityLabel={t('progress.measurements.saveAccessibility')}
        testID="body-measurement-submit"
        loading={saving}
        onPress={() => void handleSubmit(submit)()}
      >
        {t('progress.measurements.save')}
      </AppButton>
    </View>
  );
}
