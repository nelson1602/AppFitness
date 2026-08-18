import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, FormField } from '@/shared/presentation';
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
  const { t } = useLocalization();
  const schema = createBodyWeightFormSchema({
    dateFormat: t('progress.validation.dateFormat'),
    validDate: t('progress.validation.validDate'),
    weightPositive: t('progress.validation.weightPositive'),
    tooLarge: t('progress.validation.tooLarge'),
  });
  const { control, handleSubmit, reset } = useForm<
    BodyWeightFormInput,
    unknown,
    BodyWeightFormOutput
  >({
    resolver: zodResolver(schema),
    defaultValues: blankBodyWeightValues(defaultDate),
  });

  const submit = async (values: BodyWeightFormOutput): Promise<void> => {
    const ok = await onSubmit(toBodyWeightInput(values));
    if (ok) reset(blankBodyWeightValues(defaultDate));
    // A false result surfaces via the parent screen's error banner.
  };

  return (
    <View style={{ gap: theme.spacing.md }} accessibilityLabel={t('progress.weight.accessibility')}>
      <AppText variant="title">{t('progress.weight.title')}</AppText>
      <FormField
        control={control}
        name="date"
        label={t('progress.weight.date')}
        placeholder={t('progress.weight.datePlaceholder')}
        required
      />
      <FormField
        control={control}
        name="weightKg"
        label={t('progress.weight.weightKg')}
        placeholder={t('progress.weight.weightPlaceholder')}
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
