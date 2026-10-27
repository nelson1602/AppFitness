import { View } from 'react-native';

import { formatNumber, formatQuantity, interpolate, useLocalization } from '@/shared/localization';
import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import {
  ACTIVITY_OPTIONS,
  EQUIPMENT_OPTIONS,
  SLEEP_MAX,
  SLEEP_MIN,
  SLEEP_STEP,
  STRESS_OPTIONS,
  TRAINING_DAY_OPTIONS,
  type EquipmentOption,
} from '../../domain/evaluation';
import { Choice, Legend, OptionRow, Stepper } from '../evaluation-controls';
import type { StepProps } from './step-props';
import { ACTIVITY_HINT, ACTIVITY_LABEL, EQUIPMENT_LABEL, STRESS_LABEL } from '../evaluation-copy';

/** "Gimnasio completo" already includes the rest, so it is chosen on its own. */
function toggleEquipment(current: readonly EquipmentOption[], option: EquipmentOption) {
  if (current.includes(option)) return current.filter((value) => value !== option);
  if (option === 'gym') return ['gym' as const];
  return EQUIPMENT_OPTIONS.filter(
    (value) => value !== 'gym' && (value === option || current.includes(value)),
  );
}

/** Paso 4 — Estilo de vida: activity, stress, sleep, training days and equipment. */
export function LifestyleStep({ draft, update, issues }: StepProps) {
  const theme = useTheme();
  const { spacing } = theme;
  const { language, t } = useLocalization();

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        <Legend>{t('evaluation.lifestyle.activity')}</Legend>
        {ACTIVITY_OPTIONS.map((level) => (
          <OptionRow
            detail={t(ACTIVITY_HINT[level])}
            key={level}
            onPress={() => update({ activityLevel: level })}
            role="radio"
            selected={draft.activityLevel === level}
            testID={`evaluation-activity-${level}`}
            title={t(ACTIVITY_LABEL[level])}
          />
        ))}
      </View>

      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        <Legend>{t('evaluation.lifestyle.stress')}</Legend>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {STRESS_OPTIONS.map((level) => (
            <Choice
              key={level}
              label={t(STRESS_LABEL[level])}
              onPress={() => update({ stressLevel: level })}
              role="radio"
              selected={draft.stressLevel === level}
              testID={`evaluation-stress-${level}`}
            />
          ))}
        </View>
      </View>

      <Stepper
        display={formatQuantity(draft.sleepHours, 'h', language)}
        label={t('evaluation.lifestyle.sleep')}
        lessLabel={t('evaluation.lifestyle.sleepLess')}
        max={SLEEP_MAX}
        min={SLEEP_MIN}
        moreLabel={t('evaluation.lifestyle.sleepMore')}
        onChange={(sleepHours) => update({ sleepHours })}
        step={SLEEP_STEP}
        testID="evaluation-sleep"
        value={draft.sleepHours}
      />

      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        <Legend>{t('evaluation.lifestyle.days')}</Legend>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {TRAINING_DAY_OPTIONS.map((days) => (
            <Choice
              accessibilityLabel={interpolate(t('evaluation.lifestyle.daysValue'), {
                n: formatNumber(days, language),
              })}
              grow
              key={days}
              label={formatNumber(days, language)}
              onPress={() => update({ trainingDays: days })}
              role="radio"
              selected={draft.trainingDays === days}
              testID={`evaluation-days-${days}`}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Legend>{t('evaluation.lifestyle.equipment')}</Legend>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {EQUIPMENT_OPTIONS.map((option) => (
            <Choice
              key={option}
              label={t(EQUIPMENT_LABEL[option])}
              onPress={() => update({ equipment: toggleEquipment(draft.equipment, option) })}
              role="checkbox"
              selected={draft.equipment.includes(option)}
              testID={`evaluation-equipment-${option}`}
            />
          ))}
        </View>
        {issues.includes('equipment') ? (
          <AppText testID="evaluation-equipment-error" tone="errorOnStage" variant="caption">
            {t('evaluation.error.equipment')}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
