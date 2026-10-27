import { useState } from 'react';
import { View } from 'react-native';

import { type TranslationKey, useLocalization } from '@/shared/localization';
import { interpolate } from '@/shared/localization/format';
import { AppButton, AppText, GlassCard } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useWeeklyPlanStore } from '../application/weekly-plan.store';
import type { PlanInputChange } from '../domain/plan-inputs';

const CHANGE_KEY: Record<PlanInputChange, TranslationKey> = {
  goal: 'plan.change.goal',
  trainingDays: 'plan.change.trainingDays',
  equipment: 'plan.change.equipment',
  injuries: 'plan.change.injuries',
  excludedFoods: 'plan.change.excludedFoods',
};

/**
 * "¿Actualizar tu plan de esta semana?" (ADR-P042 D3). Shown only when the
 * plan's deciding inputs changed since it was saved. "Sí" saves a new revision
 * effective today; "Ahora no" keeps the week as it is until Monday.
 */
export function PlanChangePrompt() {
  const theme = useTheme();
  const { t } = useLocalization();
  const pending = useWeeklyPlanStore((s) => s.pendingChanges);
  const confirmRegenerate = useWeeklyPlanStore((s) => s.confirmRegenerate);
  const dismissChanges = useWeeklyPlanStore((s) => s.dismissChanges);
  const [busy, setBusy] = useState(false);

  if (pending.length === 0) return null;
  const changes = pending.map((change) => t(CHANGE_KEY[change])).join(', ');

  return (
    <GlassCard
      style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}
      testID="plan-change-prompt"
    >
      <AppText accessibilityRole="header" tone="onStage" variant="title">
        {t('plan.change.title')}
      </AppText>
      <AppText tone="onStageVariant">{interpolate(t('plan.change.body'), { changes })}</AppText>
      <View style={{ gap: theme.spacing.sm }}>
        <AppButton
          loading={busy}
          onPress={() => {
            setBusy(true);
            void confirmRegenerate().finally(() => setBusy(false));
          }}
          testID="plan-change-confirm"
        >
          {t('plan.change.confirm')}
        </AppButton>
        <AppButton onPress={dismissChanges} testID="plan-change-dismiss" variant="stage-secondary">
          {t('plan.change.dismiss')}
        </AppButton>
      </View>
    </GlassCard>
  );
}
