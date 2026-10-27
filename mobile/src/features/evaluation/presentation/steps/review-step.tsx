import { Pressable, View } from 'react-native';

import { goalTypeShortLabelKey } from '@/features/profile/presentation/goal-type-label';
import {
  formatDate,
  formatNumber,
  formatQuantity,
  interpolate,
  useLocalization,
} from '@/shared/localization';
import {
  AppText,
  Icon,
  backgroundImageStyle,
  goalCardBackgroundImage,
  withAlpha,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { EvaluationPreview } from '../../application/evaluation.service';
import { ageOn, draftBmi, type EvaluationStep } from '../../domain/evaluation';
import { calendarDate } from '../evaluation-format';
import { ACTIVITY_LABEL, INJURY_LABEL, STRESS_LABEL, foodLabelKey } from '../evaluation-copy';
import type { StepProps } from './step-props';

interface ReviewStepProps extends StepProps {
  preview: EvaluationPreview | null;
  goStep: (step: EvaluationStep) => void;
}

/** Paso 6 — Revisión: one editable summary per section and the iCoach preview. */
export function ReviewStep({ draft, today, preview, goStep }: ReviewStepProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { language, t } = useLocalization();
  const kg = (value: number) =>
    formatQuantity(value, t('evaluation.unit.kg'), language, { maximumFractionDigits: 1 });
  const g = (value: number) => formatQuantity(value, 'g', language);
  const onCta = { color: colors.onCta };
  const bmi = draftBmi(draft);
  const goalKey = goalTypeShortLabelKey(draft.goalType);
  const foods = Object.keys(draft.foods).map((id) => t(foodLabelKey(id)));

  const rows: { step: EvaluationStep; title: string; value: string }[] = [
    {
      step: 'measures',
      title: t('evaluation.step.measures'),
      value: interpolate(t('evaluation.review.measures'), {
        weight: draft.weightKg === null ? '—' : kg(draft.weightKg),
        height:
          draft.heightCm === null
            ? '—'
            : formatQuantity(draft.heightCm, t('evaluation.unit.cm'), language),
        age: draft.birthDate ? formatNumber(ageOn(draft.birthDate, today), language) : '—',
        bmi:
          bmi === null
            ? '—'
            : formatNumber(bmi, language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      }),
    },
    {
      step: 'health',
      title: t('evaluation.step.health'),
      value:
        draft.injuries.length === 0
          ? t('evaluation.review.noInjuries')
          : interpolate(t('evaluation.review.injuries'), {
              list: draft.injuries.map((injury) => t(INJURY_LABEL[injury])).join(', '),
            }),
    },
    {
      step: 'food',
      title: t('evaluation.step.food'),
      value:
        foods.length === 0
          ? t('evaluation.review.noFoods')
          : interpolate(t('evaluation.review.foods'), { list: foods.join(', ') }),
    },
    {
      step: 'lifestyle',
      title: t('evaluation.step.lifestyle'),
      value: interpolate(t('evaluation.review.lifestyle'), {
        activity: t(ACTIVITY_LABEL[draft.activityLevel]).toLocaleLowerCase(language),
        stress: t(STRESS_LABEL[draft.stressLevel]).toLocaleLowerCase(language),
        sleep: formatQuantity(draft.sleepHours, 'h', language),
        days: formatNumber(draft.trainingDays, language),
      }),
    },
    {
      step: 'goal',
      title: t('evaluation.step.goal'),
      value: interpolate(t('evaluation.review.goal'), {
        goal: goalKey ? t(goalKey) : '',
        weight: draft.targetWeightKg === null ? '—' : kg(draft.targetWeightKg),
        date: draft.targetDate
          ? formatDate(calendarDate(draft.targetDate), language, { dateStyle: 'long' })
          : '—',
      }),
    },
  ];

  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((row) => (
        <View
          key={row.step}
          style={{
            alignItems: 'flex-start',
            backgroundColor: withAlpha(colors.onStage, 0.05),
            borderColor: withAlpha(colors.onStage, 0.1),
            borderRadius: theme.radius.large,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.md,
            padding: spacing.md,
          }}
          testID={`evaluation-review-${row.step}`}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText tone="primary" variant="caption">
              {row.title}
            </AppText>
            <AppText tone="onStage" variant="label">
              {row.value}
            </AppText>
          </View>
          <Pressable
            accessibilityLabel={interpolate(t('evaluation.review.edit'), { section: row.title })}
            accessibilityRole="button"
            onPress={() => goStep(row.step)}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: withAlpha(colors.onStage, pressed ? 0.16 : 0.08),
              borderRadius: theme.radius.full,
              justifyContent: 'center',
              minHeight: theme.spacing.x5l,
              minWidth: theme.spacing.x5l,
            })}
            testID={`evaluation-review-edit-${row.step}`}
          >
            <Icon color={colors.onStage} name="pencil" size={16} />
          </Pressable>
        </View>
      ))}

      <View
        style={[
          backgroundImageStyle(goalCardBackgroundImage(colors), colors.ctaStart),
          { borderRadius: theme.radius.large, gap: spacing.xs, padding: spacing.lg },
        ]}
        testID="evaluation-preview"
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
          <Icon color={colors.onCta} name="sparkle" size={16} />
          <AppText style={onCta} variant="caption">
            {t('evaluation.preview.title')}
          </AppText>
        </View>
        {preview ? (
          <>
            <AppText testID="evaluation-preview-kcal" style={onCta} variant="title">
              {interpolate(t('evaluation.preview.kcal'), {
                kcal: formatQuantity(preview.calories, 'kcal', language),
              })}
            </AppText>
            <AppText style={onCta} variant="caption">
              {interpolate(t('evaluation.preview.macros'), {
                p: g(preview.proteinG),
                c: g(preview.carbsG),
                f: g(preview.fatG),
              })}
            </AppText>
            <AppText style={onCta} variant="caption">
              {[
                interpolate(t('evaluation.preview.days'), {
                  n: formatNumber(preview.trainingDays, language),
                }),
                preview.healthAdjustments === 0
                  ? null
                  : preview.healthAdjustments === 1
                    ? t('evaluation.preview.adjustOne')
                    : interpolate(t('evaluation.preview.adjustMany'), {
                        n: formatNumber(preview.healthAdjustments, language),
                      }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </>
        ) : (
          <AppText style={onCta}>{t('evaluation.preview.unavailable')}</AppText>
        )}
      </View>
    </View>
  );
}
