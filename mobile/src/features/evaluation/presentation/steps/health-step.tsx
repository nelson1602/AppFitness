import { View } from 'react-native';

import { type TranslationKey, useLocalization } from '@/shared/localization';
import { AppText, GlassCard, Icon } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { INJURY_OPTIONS, type InjuryOption } from '../../domain/evaluation';
import { Group, OptionRow } from '../evaluation-controls';
import type { StepProps } from './step-props';
import { INJURY_LABEL } from '../evaluation-copy';

/** Injuries the design describes with a second line. */
const DETAIL: Partial<Record<InjuryOption, TranslationKey>> = {
  shoulder: 'evaluation.injury.shoulder.detail',
  knee: 'evaluation.injury.knee.detail',
  lower_back: 'evaluation.injury.lower_back.detail',
  wrist: 'evaluation.injury.wrist.detail',
  elbow: 'evaluation.injury.elbow.detail',
  ankle: 'evaluation.injury.ankle.detail',
  neck: 'evaluation.injury.neck.detail',
  muscle_tear: 'evaluation.injury.muscle_tear.detail',
  shin_splints: 'evaluation.injury.shin_splints.detail',
};

/**
 * Paso 2 — Salud. Only the injury list: the design's conditions, blood
 * pressure, pulse and medicines are clinical data public V1 does not collect
 * (SECURITY-002), and "Otra lesión" free text is out of v8 (owner decision).
 */
export function HealthStep({ draft, update }: StepProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { t } = useLocalization();
  const toggle = (injury: InjuryOption) =>
    update({
      injuries: draft.injuries.includes(injury)
        ? draft.injuries.filter((value) => value !== injury)
        : INJURY_OPTIONS.filter((value) => value === injury || draft.injuries.includes(value)),
    });

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText tone="onStageVariant">{t('evaluation.health.hint')}</AppText>
      <Group
        count={draft.injuries.length}
        initiallyOpen
        testID="evaluation-injuries"
        title={t('evaluation.health.injuries')}
      >
        {INJURY_OPTIONS.map((injury) => {
          const detail = DETAIL[injury];
          return (
            <OptionRow
              detail={detail ? t(detail) : undefined}
              key={injury}
              onPress={() => toggle(injury)}
              role="checkbox"
              selected={draft.injuries.includes(injury)}
              testID={`evaluation-injury-${injury}`}
              title={t(INJURY_LABEL[injury])}
            />
          );
        })}
      </Group>
      <GlassCard style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md }}>
        <Icon color={colors.accentCyan} name="shield" size={20} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText tone="onStage" variant="caption">
            {t('evaluation.health.effect')}
          </AppText>
          <AppText tone="onStageVariant" variant="caption">
            {t('evaluation.health.noMedical')}
          </AppText>
        </View>
      </GlassCard>
    </View>
  );
}
