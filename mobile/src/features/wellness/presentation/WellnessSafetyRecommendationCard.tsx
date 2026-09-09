import { useEffect } from 'react';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useWellnessSafetyProfileStore } from '../application/wellness-safety-profile.store';

/**
 * Dashboard recommendation to consider a professional physical evaluation
 * (ADR-P017 **W-3**).
 *
 * **A recommendation, never a requirement.** It blocks no navigation, disables
 * no control, replaces no content and gates no surface: assessment, nutrition,
 * exercise and offline operation behave identically whether or not a profile
 * exists. Its shape follows the shipped advisory precedent
 * (`VerificationReminderCard`, ADR-P026 V2-D) — a self-contained card driven by
 * its own state that the dashboard merely places.
 *
 * **Deliberately not an onboarding step.** ADR-P027's first-run checklist
 * derives its three steps and its "n of 3 complete" line from the dashboard's
 * Data-gap state, and those three are prerequisites the assessment genuinely
 * cannot compute without. This is not one of them — nothing is blocked by its
 * absence — so adding a fourth step would both overstate the requirement and
 * change a shipped count. It renders as its own card, and
 * `onboarding-checklist-card.tsx` is untouched.
 *
 * **Shown only when there is nothing recorded**, so it disappears the moment
 * the user answers and never becomes permanent dashboard furniture. The
 * persistent way back in is the dashboard's own navigation entry, which is
 * always present whether or not a profile exists — this card is the
 * first-run prompt, not the route's only door.
 *
 * It renders **nothing at all** while loading, on Web (where the local database
 * is dormant, ADR-P019) and on a read failure: a recommendation is not urgent
 * enough to justify a second error treatment on the dashboard, and the screen
 * itself reports those states honestly when the user opens it.
 */

interface WellnessSafetyRecommendationCardProps {
  /** Opens the capture surface. Routing knowledge stays with the caller. */
  onOpen: () => void;
}

export function WellnessSafetyRecommendationCard({
  onOpen,
}: WellnessSafetyRecommendationCardProps) {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status, profile, load } = useWellnessSafetyProfileStore();

  useEffect(() => {
    void load();
  }, [load]);

  if (status !== 'ready' || profile) return null;

  return (
    <Card accessibilityLabel={t('wellness.safety.recommendation.accessibility')}>
      <View style={{ gap: theme.spacing.md }} testID="wellness-recommendation">
        <AppText variant="title">{t('wellness.safety.recommendation.title')}</AppText>
        <AppText tone="muted">{t('wellness.safety.recommendation.body')}</AppText>
        <AppText variant="caption" tone="muted" testID="wellness-recommendation-optional">
          {t('wellness.safety.recommendation.optional')}
        </AppText>
        <AppButton
          accessibilityLabel={t('wellness.safety.recommendation.ctaAccessibility')}
          testID="wellness-recommendation-cta"
          onPress={onOpen}
          variant="secondary"
        >
          {t('wellness.safety.recommendation.cta')}
        </AppButton>
      </View>
    </Card>
  );
}
