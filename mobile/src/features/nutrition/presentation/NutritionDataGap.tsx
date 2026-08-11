import { router } from 'expo-router';
import { View } from 'react-native';

import type { DataRequirement } from '@/features/dashboard/domain/dashboard.types';
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

  const profileGaps = missing.filter((g) => PROFILE_GAP_IDS.has(g.id));
  const weightGaps = missing.filter((g) => WEIGHT_GAP_IDS.has(g.id));
  const hasDirectActions = profileGaps.length > 0 || weightGaps.length > 0;

  return (
    <Card
      accessibilityLabel={
        context === 'plan' ? 'Meal plan needs more data' : 'Nutrition needs more data'
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">Finish your baseline first</AppText>
        <AppText tone="muted">
          Nutrition targets need your profile (birth date and height) and a recent weight.
          {context === 'plan' ? ' Your 15-day meal plan builds on those targets.' : ''}
        </AppText>

        {profileGaps.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label">Add your profile details</AppText>
            {profileGaps.map((gap) => (
              <AppText key={gap.id} variant="caption" tone="muted">
                {gap.detail}
              </AppText>
            ))}
            <AppButton
              accessibilityLabel="Create or edit your profile"
              testID="nutrition-gap-profile"
              variant="secondary"
              onPress={() => router.push('/profile-edit')}
            >
              Create or edit profile
            </AppButton>
          </View>
        ) : null}

        {weightGaps.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label">Record a weight</AppText>
            {weightGaps.map((gap) => (
              <AppText key={gap.id} variant="caption" tone="muted">
                {gap.detail}
              </AppText>
            ))}
            <AppButton
              accessibilityLabel="Record your body weight"
              testID="nutrition-gap-weight"
              variant="secondary"
              onPress={() => router.push('/progress')}
            >
              Record weight
            </AppButton>
          </View>
        ) : null}

        {hasDirectActions ? null : (
          // No specific gaps surfaced (e.g. still resolving) — fall back to the
          // dashboard, which is the single owner of baseline-gap routing.
          <AppButton
            accessibilityLabel="Go to the dashboard to finish your baseline"
            testID="nutrition-gap-dashboard"
            onPress={() => router.push('/dashboard')}
          >
            Go to dashboard
          </AppButton>
        )}

        <AppText variant="caption" tone="muted">
          AppFitness uses self-entered wellness data for these suggestions. It does not request
          diagnoses, prescriptions, doctor notes, or professional medical restrictions.
        </AppText>
      </View>
    </Card>
  );
}
