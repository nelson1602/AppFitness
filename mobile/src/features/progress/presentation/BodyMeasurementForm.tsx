import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppButton, AppText, FormField } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { BodyMeasurementInput } from '../domain/progress';
import {
  blankBodyMeasurementValues,
  bodyMeasurementFormSchema,
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
 * design-system `FormField`. v1 focused scope (D4): waist is the required
 * primary metric; hip, chest, and body-fat % are optional. Persistence is
 * delegated to the caller's `onSubmit` — the UI never touches SQLite. Resets to
 * a blank form (date re-prefilled) after a successful save.
 */
export function BodyMeasurementForm({ defaultDate, saving, onSubmit }: BodyMeasurementFormProps) {
  const theme = useTheme();
  const { control, handleSubmit, reset } = useForm<
    BodyMeasurementFormInput,
    unknown,
    BodyMeasurementFormOutput
  >({
    resolver: zodResolver(bodyMeasurementFormSchema),
    defaultValues: blankBodyMeasurementValues(defaultDate),
  });

  const submit = async (values: BodyMeasurementFormOutput): Promise<void> => {
    const ok = await onSubmit(toBodyMeasurementInput(values));
    if (ok) reset(blankBodyMeasurementValues(defaultDate));
    // A false result surfaces via the parent screen's error banner.
  };

  return (
    <View style={{ gap: theme.spacing.md }} accessibilityLabel="Record body measurements">
      <AppText variant="title">Record measurements</AppText>
      <FormField control={control} name="date" label="Date" placeholder="YYYY-MM-DD" required />
      <FormField
        control={control}
        name="waistCm"
        label="Waist (cm)"
        placeholder="e.g. 82"
        keyboardType="decimal-pad"
        required
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="hipCm"
        label="Hip (cm, optional)"
        placeholder="e.g. 96"
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="chestCm"
        label="Chest (cm, optional)"
        placeholder="e.g. 100"
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="bodyFatPct"
        label="Body fat (%, optional)"
        placeholder="e.g. 18"
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <FormField
        control={control}
        name="notes"
        label="Notes (optional)"
        placeholder="Anything worth remembering"
        selectTextOnFocus
      />
      <AppButton
        accessibilityLabel="Save body measurements"
        testID="body-measurement-submit"
        loading={saving}
        onPress={() => void handleSubmit(submit)()}
      >
        Save measurements
      </AppButton>
    </View>
  );
}
