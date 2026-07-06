import { View } from 'react-native';

import { AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';
import type { Recommendation } from '@/features/icoach/domain/types';

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const theme = useTheme();
  const tone = recommendation.priority === 'CRITICAL' || recommendation.priority === 'HIGH'
    ? 'warning'
    : 'primary';
  return (
    <Card accessibilityLabel={`${recommendation.priority.toLowerCase()} recommendation: ${recommendation.title}`}>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="caption" tone={tone}>
          {recommendation.category} / {recommendation.priority}
        </AppText>
        <AppText variant="title">{recommendation.title}</AppText>
        <AppText>{recommendation.explanation}</AppText>
        <AppText variant="caption" tone="muted">
          Evidence: {recommendation.scientificBasis}
        </AppText>
      </View>
    </Card>
  );
}
