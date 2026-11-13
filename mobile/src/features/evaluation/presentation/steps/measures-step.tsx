import { useState } from 'react';
import { View } from 'react-native';

import { classifyBmi } from '@/features/icoach/domain/body-composition';
import { formatNumber, useLocalization } from '@/shared/localization';
import { AppText, BirthDateField, Chip, DateField, GlassCard, Icon } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';
import {
  cmToFeetInches,
  displayToKg,
  feetInchesToCm,
  UnitDropdown,
  useUnits,
  weightFieldText,
} from '@/shared/units';

import { decimalText, draftBmi, parseDecimal } from '../../domain/evaluation';
import { Choice, Legend, NumberField } from '../evaluation-controls';
import type { StepProps } from './step-props';
import { BMI_LABEL, SEX_LABEL } from '../evaluation-copy';

/** Paso 1 — Medidas: weight, height, birth date, assessment date, sex and live BMI. */
export function MeasuresStep({ draft, update, issues, today }: StepProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { language, t } = useLocalization();
  // v10 Block C, item 9: typed in the person's units, stored in kg and cm.
  // v11-B: weight and height each have their own unit (lb + cm is valid).
  const { weightSystem, lengthSystem } = useUnits();
  const imperialWeight = weightSystem === 'imperial';
  const imperial = lengthSystem === 'imperial';
  const [weight, setWeight] = useState(weightFieldText(draft.weightKg, weightSystem, language));
  const [height, setHeight] = useState(decimalText(draft.heightCm, language));
  const initialFeetInches = draft.heightCm === null ? null : cmToFeetInches(draft.heightCm);
  const [feet, setFeet] = useState(initialFeetInches ? String(initialFeetInches.feet) : '');
  const [inches, setInches] = useState(initialFeetInches ? String(initialFeetInches.inches) : '');
  // v10-B: switching kg/lb or cm/ft-in here re-shows what was typed in the new
  // unit (the draft keeps kg and cm, so nothing is lost or converted twice).
  const [shownWeight, setShownWeight] = useState(weightSystem);
  if (shownWeight !== weightSystem) {
    setShownWeight(weightSystem);
    setWeight(weightFieldText(draft.weightKg, weightSystem, language));
  }
  const [shownLength, setShownLength] = useState(lengthSystem);
  if (shownLength !== lengthSystem) {
    setShownLength(lengthSystem);
    setHeight(decimalText(draft.heightCm, language));
    const converted = draft.heightCm === null ? null : cmToFeetInches(draft.heightCm);
    setFeet(converted ? String(converted.feet) : '');
    setInches(converted ? String(converted.inches) : '');
  }
  const updateFeetInches = (nextFeet: string, nextInches: string) => {
    const f = parseDecimal(nextFeet);
    const i = nextInches.trim() === '' ? 0 : parseDecimal(nextInches);
    update({ heightCm: f === null || i === null ? null : feetInchesToCm(f, i) });
  };
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
          error={
            issues.includes('weight')
              ? t(imperialWeight ? 'evaluation.error.weightImperial' : 'evaluation.error.weight')
              : undefined
          }
          label={t('evaluation.measures.weight')}
          onChangeText={(text) => {
            setWeight(text);
            const typed = parseDecimal(text);
            update({ weightKg: typed === null ? null : displayToKg(typed, weightSystem) });
          }}
          testID="evaluation-weight"
          accessory={<UnitDropdown kind="weight" testID="evaluation-weight-unit" />}
          unit={imperialWeight ? t('units.lb') : t('evaluation.unit.kg')}
          value={weight}
        />
        {imperial ? (
          <>
            <NumberField
              error={issues.includes('height') ? t('evaluation.error.heightImperial') : undefined}
              accessory={<UnitDropdown kind="height" testID="evaluation-height-unit" />}
              label={t('evaluation.measures.height')}
              onChangeText={(text) => {
                setFeet(text);
                updateFeetInches(text, inches);
              }}
              testID="evaluation-height-feet"
              unit="ft"
              value={feet}
            />
            <NumberField
              label={t('units.inches')}
              onChangeText={(text) => {
                setInches(text);
                updateFeetInches(feet, text);
              }}
              testID="evaluation-height-inches"
              unit="in"
              value={inches}
            />
          </>
        ) : (
          <NumberField
            error={issues.includes('height') ? t('evaluation.error.height') : undefined}
            accessory={<UnitDropdown kind="height" testID="evaluation-height-unit" />}
            label={t('evaluation.measures.height')}
            onChangeText={(text) => {
              setHeight(text);
              update({ heightCm: parseDecimal(text) });
            }}
            testID="evaluation-height"
            unit={t('evaluation.unit.cm')}
            value={height}
          />
        )}
      </View>

      {/* v8.1: the Día / Mes / Año wheel, ages 16 to 100 (ADR-P043 amendment). */}
      <BirthDateField
        error={issues.includes('birthDate') ? t('evaluation.error.birthDate') : undefined}
        label={t('evaluation.measures.birthDate')}
        onChange={(birthDate) => update({ birthDate })}
        testID="evaluation-birth-date"
        today={today}
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
