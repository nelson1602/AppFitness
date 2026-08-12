import { View } from 'react-native';

import { type TranslationKey, useLocalization } from '@/shared/localization';
import { AppButton, AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { DataRequirement } from '../../domain/dashboard.types';

interface DataGapCardProps {
  gaps: DataRequirement[];
  loading?: boolean;
  onLoadSampleData?: () => void;
  /**
   * Maps a gap to a "fix it" action, or undefined if no entry screen
   * exists for it yet. Routing knowledge stays in the screen — the card
   * never hard-codes which gaps are addressable.
   */
  resolveFix?: (gap: DataRequirement) => (() => void) | undefined;
}

const GAP_COPY: Record<string, { title: TranslationKey; detail: TranslationKey }> = {
  profile: { title: 'dashboard.gap.profileTitle', detail: 'dashboard.gap.profileDetail' },
  'birth-date': {
    title: 'dashboard.gap.birthDateTitle',
    detail: 'dashboard.gap.birthDateDetail',
  },
  height: { title: 'dashboard.gap.heightTitle', detail: 'dashboard.gap.heightDetail' },
  weight: { title: 'dashboard.gap.weightTitle', detail: 'dashboard.gap.weightDetail' },
  'default-goal': {
    title: 'dashboard.gap.goalTitle',
    detail: 'dashboard.gap.goalDetail',
  },
  'default-sex': {
    title: 'dashboard.gap.sexTitle',
    detail: 'dashboard.gap.sexDetail',
  },
};

export function DataGapCard({ gaps, loading, onLoadSampleData, resolveFix }: DataGapCardProps) {
  const theme = useTheme();
  const { t } = useLocalization();
  return (
    <Card accessibilityLabel={t('dashboard.gap.accessibility')}>
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">{t('dashboard.gap.title')}</AppText>
        <AppText tone="muted">{t('dashboard.gap.description')}</AppText>
        <View style={{ gap: theme.spacing.sm }}>
          {gaps.map((gap) => {
            const fix = resolveFix?.(gap);
            const copy = GAP_COPY[gap.id];
            const title = copy ? t(copy.title) : gap.title;
            const detail = copy ? t(copy.detail) : gap.detail;
            return (
              <View key={gap.id} style={{ gap: theme.spacing.xs }}>
                <AppText variant="label">{title}</AppText>
                <AppText variant="caption" tone="muted">
                  {detail}
                </AppText>
                {fix ? (
                  <AppButton
                    accessibilityLabel={`${t('dashboard.gap.fixAccessibility')}: ${title}`}
                    testID={`gap-fix-${gap.id}`}
                    onPress={fix}
                    variant="secondary"
                  >
                    {t('dashboard.gap.addNow')}
                  </AppButton>
                ) : null}
              </View>
            );
          })}
        </View>
        {__DEV__ && onLoadSampleData ? (
          <AppButton
            accessibilityLabel={t('dashboard.gap.sampleAccessibility')}
            loading={loading}
            onPress={onLoadSampleData}
          >
            {t('dashboard.gap.sampleButton')}
          </AppButton>
        ) : null}
      </View>
    </Card>
  );
}
