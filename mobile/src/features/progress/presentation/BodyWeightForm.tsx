import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppButton, AppText, FormField } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { BodyWeightInput } from '../domain/progress';
import {
  blankBodyWeightValues,
  bodyWeightFormSchema,
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
  const { control, handleSubmit, reset } = useForm<
    BodyWeightFormInput,
    unknown,
    BodyWeightFormOutput
  >({
    resolver: zodResolver(bodyWeightFormSchema),
    defaultValues: blankBodyWeightValues(defaultDate),
  });

  const submit = async (values: BodyWeightFormOutput): Promise<void> => {
    const ok = await onSubmit(toBodyWeightInput(values));
    if (ok) reset(blankBodyWeightValues(defaultDate));
    // A false result surfaces via the parent screen's error banner.
  };

  return (
    <View style={{ gap: theme.spacing.md }} accessibilityLabel="Record body weight">
      <AppText variant="title">Record weight</AppText>
      <FormField control={control} name="date" label="Date" placeholder="YYYY-MM-DD" required />
      <FormField
        control={control}
        name="weightKg"
        label="Weight (kg)"
        placeholder="e.g. 80.5"
        keyboardType="decimal-pad"
        required
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
        accessibilityLabel="Save body weight"
        testID="body-weight-submit"
        loading={saving}
        onPress={() => void handleSubmit(submit)()}
      >
        Save weight
      </AppButton>
    </View>
  );
}
