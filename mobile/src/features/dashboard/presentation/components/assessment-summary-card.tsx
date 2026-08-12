import { View } from 'react-native';

import { formatNumber, type TranslationKey, useLocalization } from '@/shared/localization';
import { AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { DashboardAssessment } from '../../domain/dashboard.types';

interface AssessmentSummaryCardProps {
  assessment: DashboardAssessment;
}

export function AssessmentSummaryCard({ assessment }: AssessmentSummaryCardProps) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const result = assessment.assessment;
  const bmiCategory = t(
    `dashboard.bmi.${result.bodyComposition.bmiCategory.toLowerCase()}` as TranslationKey,
  );
  const trainingValue = result.training.blocked
    ? t('dashboard.training.blocked')
    : `${formatNumber(result.training.daysPerWeek, language)}× / ${t(
        `dashboard.intensity.${result.training.intensity.toLowerCase()}` as TranslationKey,
      )}`;
  return (
    <Card accessibilityLabel={t('dashboard.assessment.accessibility')}>
      <View style={{ gap: theme.spacing.md }}>
        <View>
          <AppText variant="label" tone="muted">
            {t('dashboard.assessment.title')}
          </AppText>
          <AppText variant="headline">
            {formatNumber(result.nutrition.calories, language)} kcal
          </AppText>
          <AppText tone="muted">
            {t('dashboard.assessment.bmi')} {formatNumber(result.bodyComposition.bmi, language)} /{' '}
            {bmiCategory}
          </AppText>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Metric
            label={t('dashboard.assessment.protein')}
            value={`${formatNumber(result.nutrition.proteinG, language)} g`}
          />
          <Metric
            label={t('dashboard.assessment.carbs')}
            value={`${formatNumber(result.nutrition.carbsG, language)} g`}
          />
          <Metric
            label={t('dashboard.assessment.fat')}
            value={`${formatNumber(result.nutrition.fatG, language)} g`}
          />
          <Metric label={t('dashboard.assessment.training')} value={trainingValue} />
        </View>
      </View>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText tone="muted">{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}
