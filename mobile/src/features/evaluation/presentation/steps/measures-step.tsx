import { useState } from 'react';
import { View } from 'react-native';

import { classifyBmi } from '@/features/icoach/domain/body-composition';
import { formatNumber, useLocalization } from '@/shared/localization';
import { AppText, Chip, DateField, GlassCard, Icon } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { BOUNDS, decimalText, draftBmi, parseDecimal } from '../../domain/evaluation';
import { addYears } from '../evaluation-format';
import { Choice, Legend, NumberField } from '../evaluation-controls';
import type { StepProps } from './step-props';
import { BMI_LABEL, SEX_LABEL } from '../evaluation-copy';

/** Paso 1 — Medidas: weight, height, birth date, assessment date, sex and live BMI. */
export function MeasuresStep({ draft, update, issues, today }: StepProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { language, t } = useLocalization();
  const [weight, setWeight] = useState(decimalText(draft.weightKg));
  const [height, setHeight] = useState(decimalText(draft.heightCm));
  const bmi = draftBmi(draft);
  const category = bmi === null ? null : classifyBmi(bmi);

  return (
    <View style={{ gap: spacing.lg }}>
      <GlassCard
        style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md }}
        testID="evaluation-measures-intro"
      >
        <Icon color={colors.accentCyan} name="clipboard" size={20} />
        <AppText style={{ flex: 1 }} tone="onStage" variant="label">
          {t('evaluation.measures.intro')}
        </AppText>
      </GlassCard>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <NumberField
          error={issues.includes('weight') ? t('evaluation.error.weight') : undefined}
          label={t('evaluation.measures.weight')}
          onChangeText={(text) => {
            setWeight(text);
            update({ weightKg: parseDecimal(text) });
          }}
          testID="evaluation-weight"
          unit={t('evaluation.unit.kg')}
          value={weight}
        />
        <NumberField
          error={issues.includes('height') ? t('evaluation.error.height') : undefined}
          label={t('evaluation.measures.height')}
          onChangeText={(text) => {
            setHeight(text);
            update({ heightCm: parseDecimal(text) });
          }}
          testID="evaluation-height"
          unit={t('evaluation.unit.cm')}
          value={height}
        />
      </View>

      <DateField
        error={issues.includes('birthDate') ? t('evaluation.error.birthDate') : undefined}
        initialDate={addYears(today, -30)}
        label={t('evaluation.measures.birthDate')}
        maximumDate={addYears(today, -BOUNDS.age.min)}
        minimumDate={addYears(today, -BOUNDS.age.max)}
        onChange={(birthDate) => update({ birthDate })}
        testID="evaluation-birth-date"
        value={draft.birthDate}
      />
      <DateField
        error={issues.includes('evaluationDate') ? t('evaluation.error.evaluationDate') : undefined}
        label={t('evaluation.measures.evaluationDate')}
        maximumDate={today}
        onChange={(evaluationDate) => update({ evaluationDate })}
        testID="evaluation-date"
        value={draft.evaluationDate}
      />

      <View style={{ gap: spacing.sm }}>
        <Legend>{t('evaluation.measures.sex')}</Legend>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['FEMALE', 'MALE'] as const).map((sex) => (
            <Choice
              grow
              key={sex}
              label={t(SEX_LABEL[sex])}
              onPress={() => update({ sex })}
              role="radio"
              selected={draft.sex === sex}
              testID={`evaluation-sex-${sex}`}
            />
          ))}
        </View>
      </View>

      <GlassCard
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.md,
          justifyContent: 'space-between',
          padding: spacing.lg,
        }}
        testID="evaluation-bmi"
      >
        <View style={{ flexShrink: 1, gap: 2 }}>
          <AppText tone="onStageVariant" variant="caption">
            {t('evaluation.measures.bmi')}
          </AppText>
          {bmi === null ? (
            <AppText tone="onStage">{t('evaluation.measures.bmiEmpty')}</AppText>
          ) : (
            <AppText testID="evaluation-bmi-value" tone="onStage" variant="headline">
              {formatNumber(bmi, language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </AppText>
          )}
        </View>
        {category ? (
          <Chip
            label={t(BMI_LABEL[category])}
            testID="evaluation-bmi-category"
            tone={category === 'NORMAL' ? 'cyan' : 'energy'}
          />
        ) : null}
      </GlassCard>
    </View>
  );
}
