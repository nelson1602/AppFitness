import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { formatNumber, interpolate, useLocalization } from '@/shared/localization';
import { kgToDisplay, roundToTenth, useUnits } from '@/shared/units';
import { useLocalDay } from '@/shared/application/local-day';
import { AppButton, AppText, FormDateField, FormField } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { BodyWeightInput } from '../domain/progress';
import {
  blankBodyWeightValues,
  createBodyWeightFormSchema,
  toBodyWeightInput,
  type BodyWeightFormInput,
  type BodyWeightFormOutput,
} from './progress-forms.schema';

interface BodyWeightFormProps {
  /** User-local `YYYY-MM-DD` prefilled as the entry date (resolved by the caller). */
  defaultDate: string;
  saving: boolean;
  /** Persists the entry (store → repository). Returns true on success. */
  onSubmit: (input: BodyWeightInput) => Promise<boolean>;
}

/**
 * Body-weight entry form (ADR-P016 Phase 17 Slice 5a). RHF + Zod with the
 * design-system `FormField`; persistence is delegated to the caller's
 * `onSubmit` — the UI never touches SQLite or the repository. Resets to a blank
 * form (date re-prefilled) after a successful save so quick consecutive entries
 * are easy.
 */
export function BodyWeightForm({ defaultDate, saving, onSubmit }: BodyWeightFormProps) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  // v10 Block C, item 9: typed in the person's units, saved in kg.
  const { system } = useUnits();
  const imperial = system === 'imperial';
  const today = useLocalDay((s) => s.today);
  const schema = createBodyWeightFormSchema(
    {
      dateFormat: t('progress.validation.dateFormat'),
      validDate: t('progress.validation.validDate'),
      weightPositive: t('progress.validation.weightPositive'),
      tooLarge: t('progress.validation.tooLarge'),
    },
    system,
  );
  const { control, handleSubmit, reset } = useForm<
    BodyWeightFormInput,
    unknown,
    BodyWeightFormOutput
  >({
    resolver: zodResolver(schema),
    defaultValues: blankBodyWeightValues(defaultDate),
  });

  const submit = async (values: BodyWeightFormOutput): Promise<void> => {
    const ok = await onSubmit(toBodyWeightInput(values, system));
    if (ok) reset(blankBodyWeightValues(defaultDate));
    // A false result surfaces via the parent screen's error banner.
  };

  return (
    <View style={{ gap: theme.spacing.md }} accessibilityLabel={t('progress.weight.accessibility')}>
      <AppText variant="title">{t('progress.weight.title')}</AppText>
      {/* v8 Block 3 (ADR-P043): the native picker, never a future date. */}
      <FormDateField
        control={control}
        name="date"
        label={t('progress.weight.date')}
        maximumDate={today}
        required
      />
      <FormField
        control={control}
        name="weightKg"
        label={t(imperial ? 'progress.weight.weightLb' : 'progress.weight.weightKg')}
        placeholder={
          imperial
            ? interpolate(t('units.example'), {
                value: formatNumber(roundToTenth(kgToDisplay(80.5, system)), language),
              })
            : t('progress.weight.weightPlaceholder')
        }
        keyboardType="decimal-pad"
        required
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="notes"
        label={t('progress.weight.notes')}
        placeholder={t('progress.weight.notesPlaceholder')}
        selectTextOnFocus
      />
      <AppButton
        accessibilityLabel={t('progress.weight.saveAccessibility')}
        testID="body-weight-submit"
        loading={saving}
        onPress={() => void handleSubmit(submit)()}
      >
        {t('progress.weight.save')}
      </AppButton>
    </View>
  );
}
