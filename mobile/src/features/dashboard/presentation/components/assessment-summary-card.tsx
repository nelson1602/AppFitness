import { View } from 'react-native';

import { AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { DashboardAssessment } from '../../domain/dashboard.types';

interface AssessmentSummaryCardProps {
  assessment: DashboardAssessment;
}

export function AssessmentSummaryCard({ assessment }: AssessmentSummaryCardProps) {
  const theme = useTheme();
  const result = assessment.assessment;
  return (
    <Card accessibilityLabel="Today assessment summary">
      <View style={{ gap: theme.spacing.md }}>
        <View>
          <AppText variant="label" tone="muted">Today&apos;s assessment</AppText>
          <AppText variant="headline">{result.nutrition.calories} kcal</AppText>
          <AppText tone="muted">
            BMI {result.bodyComposition.bmi} / {result.bodyComposition.bmiCategory.toLowerCase()}
          </AppText>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Metric label="Protein" value={`${result.nutrition.proteinG}g`} />
          <Metric label="Carbs" value={`${result.nutrition.carbsG}g`} />
          <Metric label="Fat" value={`${result.nutrition.fatG}g`} />
          <Metric
            label="Training"
            value={
              result.training.blocked
                ? 'Blocked'
                : `${result.training.daysPerWeek}x / ${result.training.intensity}`
            }
          />
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
