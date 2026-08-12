import { View } from 'react-native';

import { type TranslationKey, useLocalization } from '@/shared/localization';
import { AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';
import type { Recommendation } from '@/features/icoach/domain/types';

import { resolveRecommendationCopy } from '../recommendation-copy';

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const copy = resolveRecommendationCopy(recommendation, language, t);
  const category = t(
    `dashboard.recommendation.category.${recommendation.category.toLowerCase()}` as TranslationKey,
  );
  const priority = t(
    `dashboard.recommendation.priority.${recommendation.priority.toLowerCase()}` as TranslationKey,
  );
  const tone =
    recommendation.priority === 'CRITICAL' || recommendation.priority === 'HIGH'
      ? 'warning'
      : 'primary';
  return (
    <Card
      accessibilityLabel={`${priority} ${t('dashboard.recommendation.accessibility')}: ${copy.title}`}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="caption" tone={tone}>
          {category} / {priority}
        </AppText>
        <AppText variant="title">{copy.title}</AppText>
        <AppText>{copy.explanation}</AppText>
        <AppText variant="caption" tone="muted">
          {t('dashboard.recommendation.evidence')}: {copy.evidence}
        </AppText>
      </View>
    </Card>
  );
}
