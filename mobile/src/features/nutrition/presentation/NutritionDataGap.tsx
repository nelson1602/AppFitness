import { router } from 'expo-router';
import { View } from 'react-native';

import type { DataRequirement } from '@/features/dashboard/domain/dashboard.types';
import { useLocalization, type TranslationKey } from '@/shared/localization';
import { AppButton, AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * Baseline gaps that block nutrition. Profile-side gaps (profile / birth date
 * / height) are fixed on the profile-edit screen; a missing weight is fixed
 * in Progress. Routing knowledge lives here so the nutrition
 * surfaces give users a DIRECT action instead of bouncing them to the
 * dashboard. Kept in sync with the dashboard's own gap ids (icoach-adapter).
 */
const PROFILE_GAP_IDS = new Set(['profile', 'birth-date', 'height']);
const WEIGHT_GAP_IDS = new Set(['weight']);

const GAP_DETAIL_KEY: Readonly<Record<string, TranslationKey>> = {
  profile: 'nutrition.gap.profileDetail',
  'birth-date': 'nutrition.gap.birthDateDetail',
  height: 'nutrition.gap.heightDetail',
  weight: 'nutrition.gap.weightDetail',
};

/**
 * Shared data-gap surface for the nutrition targets and meal-plan screens
 * (UX correction, 2026-07-16). Explains WHY nutrition is unavailable and
 * offers direct actions for the specific missing pieces:
 *   - profile / birth date / height  → /profile-edit
 *   - weight                         → /progress
 * The minimum baseline rule is unchanged (profile + birth date + height +
 * weight). Medical or professional records are not requested by public v1.
 */
export function NutritionDataGap({
  missing,
  context,
}: {
  missing: readonly DataRequirement[];
  context: 'targets' | 'plan';
}) {
  const theme = useTheme();
  const { t } = useLocalization();

  const profileGaps = missing.filter((g) => PROFILE_GAP_IDS.has(g.id));
  const weightGaps = missing.filter((g) => WEIGHT_GAP_IDS.has(g.id));
  const hasDirectActions = profileGaps.length > 0 || weightGaps.length > 0;

  return (
    <Card
      accessibilityLabel={t(
        context === 'plan'
          ? 'nutrition.gap.planAccessibility'
          : 'nutrition.gap.targetsAccessibility',
      )}
    >
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">{t('nutrition.gap.title')}</AppText>
        <AppText tone="muted">
          {t('nutrition.gap.description')}
          {context === 'plan' ? ` ${t('nutrition.gap.planSuffix')}` : ''}
        </AppText>

        {profileGaps.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label">{t('nutrition.gap.profileTitle')}</AppText>
            {profileGaps.map((gap) => (
              <AppText key={gap.id} variant="caption" tone="muted">
                {GAP_DETAIL_KEY[gap.id] ? t(GAP_DETAIL_KEY[gap.id]) : gap.detail}
              </AppText>
            ))}
            <AppButton
              accessibilityLabel={t('nutrition.gap.profileAccessibility')}
              testID="nutrition-gap-profile"
              variant="secondary"
              onPress={() => router.push('/profile-edit')}
            >
              {t('nutrition.gap.profileButton')}
            </AppButton>
          </View>
        ) : null}

        {weightGaps.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label">{t('nutrition.gap.weightTitle')}</AppText>
            {weightGaps.map((gap) => (
              <AppText key={gap.id} variant="caption" tone="muted">
                {GAP_DETAIL_KEY[gap.id] ? t(GAP_DETAIL_KEY[gap.id]) : gap.detail}
              </AppText>
            ))}
            <AppButton
              accessibilityLabel={t('nutrition.gap.weightAccessibility')}
              testID="nutrition-gap-weight"
              variant="secondary"
              onPress={() => router.push('/progress')}
            >
              {t('nutrition.gap.weightButton')}
            </AppButton>
          </View>
        ) : null}

        {hasDirectActions ? null : (
          // No specific gaps surfaced (e.g. still resolving) — fall back to the
          // dashboard, which is the single owner of baseline-gap routing.
          <AppButton
            accessibilityLabel={t('nutrition.gap.dashboardAccessibility')}
            testID="nutrition-gap-dashboard"
            onPress={() => router.push('/dashboard')}
          >
            {t('nutrition.gap.dashboardButton')}
          </AppButton>
        )}

        <AppText variant="caption" tone="muted">
          {t('nutrition.gap.wellnessNotice')}
        </AppText>
      </View>
    </Card>
  );
}
