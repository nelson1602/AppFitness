import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, FormField, FormSelect } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { WellnessSafetyProfile } from '../domain/wellness-safety-profile';
import type { WellnessSafetyProfileInput } from '../domain/wellness-safety-profile.rules';
import {
  createWellnessSafetyFormSchema,
  toFormValues,
  toProfileInput,
  type WellnessSafetyFormOutput,
  type WellnessSafetyFormValues,
} from './wellness-safety-profile-form.schema';
import { WellnessTokenGroup } from './wellness-token-group';
import { affectedAreaOptions, movementOptions } from './wellness-token-labels';

/**
 * Wellness Safety Profile capture / edit form (ADR-P017 **W-3**).
 *
 * RHF + Zod with the design-system `FormSelect` / `FormField`, exactly like the
 * progress, goal and profile forms. Persistence is delegated to the caller's
 * `onSubmit` — this component never touches the store's service, the repository
 * or SQLite.
 *
 * **One form for create and edit.** A missing profile prefills the blank shape
 * ("not yet", no date, nothing selected), and a stored profile prefills itself,
 * so the Empty state and the edit state are the same surface. That is why
 * `reset` re-runs whenever the loaded profile changes.
 *
 * **What it asks, and nothing more:** whether a professional physical
 * evaluation was completed, its date **only if** it was, and two multi-selects
 * over the closed vocabularies. There is no free-text input of any kind — no
 * provider, finding, diagnosis, condition, medication, treatment, instruction,
 * severity, dosage, document or note — and no control that could be read as
 * granting or recording clearance.
 *
 * **Limitations are independent of the evaluation answer** (W-1 invariant 4):
 * both token groups stay fully selectable when the answer is "not yet", so a
 * user who has never been evaluated can still declare what to avoid.
 */

interface WellnessSafetyProfileFormProps {
  /** The stored profile, or null for a first entry. Prefills the fields. */
  profile: WellnessSafetyProfile | null;
  saving: boolean;
  /** Device-local `YYYY-MM-DD`, resolved by the caller — never a clock here. */
  today: string;
  onSubmit: (input: WellnessSafetyProfileInput) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}

export function WellnessSafetyProfileForm({
  profile,
  saving,
  today,
  onSubmit,
  onRemove,
}: WellnessSafetyProfileFormProps) {
  const theme = useTheme();
  const { t } = useLocalization();
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  const schema = createWellnessSafetyFormSchema(today, {
    dateRequired: t('wellness.safety.validation.dateRequired'),
    dateFormat: t('wellness.safety.validation.dateFormat'),
    validDate: t('wellness.safety.validation.validDate'),
    dateNotFuture: t('wellness.safety.validation.dateNotFuture'),
  });

  const { control, handleSubmit, reset } = useForm<
    WellnessSafetyFormValues,
    unknown,
    WellnessSafetyFormOutput
  >({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(profile),
  });

  // Editing starts from what is stored: a profile arriving (or changing after a
  // save or a removal) re-prefills the fields rather than leaving stale input.
  useEffect(() => {
    reset(toFormValues(profile));
  }, [profile, reset]);

  const evaluationCompleted = useWatch({ control, name: 'evaluationCompleted' });
  const affectedAreas = useWatch({ control, name: 'affectedAreas' });
  const movementsToAvoid = useWatch({ control, name: 'movementsToAvoid' });
  const nothingDeclared =
    (affectedAreas?.length ?? 0) === 0 && (movementsToAvoid?.length ?? 0) === 0;

  const submit = async (values: WellnessSafetyFormOutput): Promise<void> => {
    await onSubmit(toProfileInput(values));
    // A false result surfaces through the screen's error banner; the form keeps
    // its values so nothing the user typed is lost.
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <FormSelect
        control={control}
        name="evaluationCompleted"
        label={t('wellness.safety.evaluation.legend')}
        options={[
          { label: t('wellness.safety.evaluation.yes'), value: 'yes' },
          { label: t('wellness.safety.evaluation.no'), value: 'no' },
        ]}
        required
      />
      <AppText variant="caption" tone="muted">
        {t('wellness.safety.evaluation.hint')}
      </AppText>

      {evaluationCompleted === 'yes' ? (
        // The date appears only for a completed evaluation. Its appearance is
        // **not** programmatically announced: ADR-P024 Decision 3 authorizes
        // `aria-live` on exactly one node — the localized error message
        // `FormField` already renders — and nothing else, so putting it on this
        // container would be a second announcement mechanism this slice has no
        // authorization to add. The field is visible and keyboard reachable, and
        // `FormField`'s shipped validation-error behaviour is untouched.
        <View style={{ gap: theme.spacing.xs }} testID="wellness-date-section">
          <FormField
            control={control}
            name="evaluationDate"
            label={t('wellness.safety.evaluation.dateLabel')}
            placeholder={t('wellness.safety.evaluation.datePlaceholder')}
            required
            selectTextOnFocus
          />
          <AppText variant="caption" tone="muted">
            {t('wellness.safety.evaluation.dateHint')}
          </AppText>
        </View>
      ) : null}

      <WellnessTokenGroup
        control={control}
        name="affectedAreas"
        legend={t('wellness.safety.areas.legend')}
        hint={t('wellness.safety.areas.hint')}
        options={affectedAreaOptions(t)}
        testIDPrefix="area"
      />

      <WellnessTokenGroup
        control={control}
        name="movementsToAvoid"
        legend={t('wellness.safety.movements.legend')}
        hint={t('wellness.safety.movements.hint')}
        options={movementOptions(t)}
        testIDPrefix="movement"
      />

      {/* The meaning of an empty selection, stated rather than assumed: it
          records that nothing was declared, and is never a clearance. */}
      {nothingDeclared ? (
        <AppText variant="caption" tone="muted" testID="wellness-nothing-declared">
          {t('wellness.safety.nothingDeclared')}
        </AppText>
      ) : null}

      <AppButton
        accessibilityLabel={t('wellness.safety.saveAccessibility')}
        testID="wellness-save"
        loading={saving}
        onPress={() => void handleSubmit(submit)()}
      >
        {t('wellness.safety.save')}
      </AppButton>

      {/* Privacy-preserving removal, always two-step and never silent. */}
      {profile ? (
        confirmingRemoval ? (
          <View style={{ gap: theme.spacing.sm }} testID="wellness-remove-confirm-section">
            <Banner title={t('wellness.safety.removeConfirmTitle')} tone="warning">
              {t('wellness.safety.removeConfirmBody')}
            </Banner>
            <AppButton
              accessibilityLabel={t('wellness.safety.removeConfirmAccessibility')}
              testID="wellness-remove-confirm"
              variant="destructive"
              loading={saving}
              onPress={() => {
                void onRemove().then((removed) => {
                  if (removed) setConfirmingRemoval(false);
                });
              }}
            >
              {t('wellness.safety.removeConfirm')}
            </AppButton>
            <AppButton
              accessibilityLabel={t('wellness.safety.removeCancelAccessibility')}
              testID="wellness-remove-cancel"
              variant="text"
              onPress={() => setConfirmingRemoval(false)}
            >
              {t('wellness.safety.removeCancel')}
            </AppButton>
          </View>
        ) : (
          <AppButton
            accessibilityLabel={t('wellness.safety.removeAccessibility')}
            testID="wellness-remove"
            variant="text"
            onPress={() => setConfirmingRemoval(true)}
          >
            {t('wellness.safety.remove')}
          </AppButton>
        )
      ) : null}
    </View>
  );
}
