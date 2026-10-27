import { useState } from 'react';
import { View } from 'react-native';

import { goalTypeShortLabelKey } from '@/features/profile/presentation/goal-type-label';
import { formatQuantity, interpolate, useLocalization } from '@/shared/localization';
import { AppText, DateField, GlassCard } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { GOAL_OPTIONS, decimalText, parseDecimal } from '../../domain/evaluation';
import { addDaysTo } from '../evaluation-format';
import { Choice, Legend, NumberField } from '../evaluation-controls';
import type { StepProps } from './step-props';

/** Paso 5 — Meta: goal type, target weight and target date. */
export function GoalStep({ draft, update, issues, today }: StepProps) {
  const theme = useTheme();
  const { spacing } = theme;
  const { language, t } = useLocalization();
  const [target, setTarget] = useState(decimalText(draft.targetWeightKg));
  const kg = (value: number) =>
    formatQuantity(value, t('evaluation.unit.kg'), language, { maximumFractionDigits: 1 });

  const from = draft.weightKg;
  const to = draft.targetWeightKg;
  const diff = from !== null && to !== null ? Math.round(Math.abs(from - to) * 10) / 10 : null;
  const summary =
    from === null || to === null || diff === null
      ? null
      : diff === 0
        ? interpolate(t('evaluation.goal.keep'), { to: kg(to) })
        : interpolate(t(to < from ? 'evaluation.goal.toLose' : 'evaluation.goal.toGain'), {
            from: kg(from),
            to: kg(to),
            diff: kg(diff),
          });

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        <Legend>{t('evaluation.goal.what')}</Legend>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {GOAL_OPTIONS.map((goal) => {
            const key = goalTypeShortLabelKey(goal);
            return key ? (
              <Choice
                key={goal}
                label={t(key)}
                onPress={() => update({ goalType: goal })}
                role="radio"
                selected={draft.goalType === goal}
                testID={`evaluation-goal-${goal}`}
              />
            ) : null;
          })}
        </View>
      </View>

      <NumberField
        error={issues.includes('targetWeight') ? t('evaluation.error.targetWeight') : undefined}
        label={t('evaluation.goal.targetWeight')}
        onChangeText={(text) => {
          setTarget(text);
          update({ targetWeightKg: parseDecimal(text) });
        }}
        testID="evaluation-target-weight"
        unit={t('evaluation.unit.kg')}
        value={target}
      />
      <DateField
        error={issues.includes('targetDate') ? t('evaluation.error.targetDate') : undefined}
        initialDate={addDaysTo(today, 90)}
        label={t('evaluation.goal.targetDate')}
        minimumDate={addDaysTo(today, 1)}
        onChange={(targetDate) => update({ targetDate })}
        testID="evaluation-target-date"
        value={draft.targetDate}
      />

      {summary ? (
        <GlassCard style={{ padding: spacing.lg }} testID="evaluation-goal-summary">
          <AppText tone="onStage">{summary}</AppText>
        </GlassCard>
      ) : null}
    </View>
  );
}
