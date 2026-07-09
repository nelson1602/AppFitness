import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppButton, AppText, FormField, FormSelect } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useRestrictionStore } from '../application/restriction.store';
import {
  restrictionFormDefaults,
  restrictionFormSchema,
  toRestrictionInput,
  type RestrictionFormInput,
  type RestrictionFormOutput,
} from './restriction-form.schema';

const TYPE_OPTIONS = [
  { label: 'Injury', value: 'INJURY' },
  { label: 'Condition', value: 'CONDITION' },
  { label: 'Doctor restriction', value: 'DOCTOR_RESTRICTION' },
] as const;
const SEVERITY_OPTIONS = [
  { label: 'Mild', value: 'MILD' },
  { label: 'Moderate', value: 'MODERATE' },
  { label: 'Severe', value: 'SEVERE' },
] as const;

interface RestrictionFormProps {
  /** Called after a successful add (the screen keeps the user on the list). */
  onAdded?: () => void;
}

/**
 * Add-restriction form (Phase 14 Slice 2). Records a NEW active restriction
 * and resets — the parent screen keeps showing the active list. Validation
 * is Zod; state is RHF; persistence, field-level encryption of the
 * sensitive `notes` free-text, and sync are delegated to the store/service/
 * repository. Sensitive values are never logged here. Save errors surface
 * through the parent screen's shared store banner.
 */
export function RestrictionForm({ onAdded }: RestrictionFormProps) {
  const theme = useTheme();
  const save = useRestrictionStore((s) => s.save);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<RestrictionFormInput, unknown, RestrictionFormOutput>({
    resolver: zodResolver(restrictionFormSchema),
    defaultValues: restrictionFormDefaults(),
  });

  const onSubmit = async (values: RestrictionFormOutput) => {
    const ok = await save(toRestrictionInput(values));
    if (ok) {
      reset(restrictionFormDefaults());
      onAdded?.();
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppText variant="title">Add a restriction</AppText>
      <FormSelect control={control} name="type" label="Type" options={TYPE_OPTIONS} required />
      <FormField control={control} name="bodyArea" label="Body area" placeholder="e.g. left knee" />
      <FormSelect control={control} name="severity" label="Severity" options={SEVERITY_OPTIONS} />
      <FormField control={control} name="notes" label="Notes" />
      <FormField
        control={control}
        name="effectiveFrom"
        label="Effective from"
        placeholder="YYYY-MM-DD"
      />
      <FormField
        control={control}
        name="effectiveUntil"
        label="Effective until"
        placeholder="YYYY-MM-DD"
      />
      <AppButton
        accessibilityLabel="Add restriction"
        loading={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      >
        Add restriction
      </AppButton>
    </View>
  );
}
