import { View } from 'react-native';

import { AppButton, AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { DataRequirement } from '../../domain/dashboard.types';

interface DataGapCardProps {
  gaps: DataRequirement[];
  loading?: boolean;
  onLoadSampleData?: () => void;
}

export function DataGapCard({ gaps, loading, onLoadSampleData }: DataGapCardProps) {
  const theme = useTheme();
  return (
    <Card accessibilityLabel="Dashboard setup requirements">
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">Finish your baseline</AppText>
        <AppText tone="muted">
          The dashboard runs entirely from local data. Add the basics below to unlock your first
          iCoach assessment.
        </AppText>
        <View style={{ gap: theme.spacing.sm }}>
          {gaps.map((gap) => (
            <View key={gap.id} style={{ gap: theme.spacing.xs }}>
              <AppText variant="label">{gap.title}</AppText>
              <AppText variant="caption" tone="muted">
                {gap.detail}
              </AppText>
            </View>
          ))}
        </View>
        {__DEV__ && onLoadSampleData ? (
          <AppButton
            accessibilityLabel="Load fake sample dashboard data"
            loading={loading}
            onPress={onLoadSampleData}
          >
            Load sample data
          </AppButton>
        ) : null}
      </View>
    </Card>
  );
}
