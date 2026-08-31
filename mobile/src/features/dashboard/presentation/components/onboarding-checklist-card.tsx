import { View } from 'react-native';

import { formatNumber, type TranslationKey, useLocalization } from '@/shared/localization';
import { AppButton, AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { DataRequirement } from '../../domain/dashboard.types';

interface OnboardingChecklistCardProps {
  gaps: DataRequirement[];
  loading?: boolean;
  onLoadSampleData?: () => void;
  /**
   * Maps a gap to a "fix it" action, or undefined if no entry screen exists for
   * it. Routing knowledge stays in the screen — this card never hard-codes
   * which gaps are addressable, exactly like `DataGapCard`.
   */
  resolveFix?: (gap: DataRequirement) => (() => void) | undefined;
}

/**
 * The three copy-level steps (UX-3C, `.ai/19_COPY_DECKS.md`). Each groups the
 * gap ids that resolve on the same screen, without changing their routing.
 * `default-sex` is deliberately absent: it has no entry screen in
 * `resolveGapFix`, so it is not a step a user can complete here.
 */
const STEPS: readonly { id: string; gapIds: readonly string[]; label: TranslationKey }[] = [
  {
    id: 'profile',
    gapIds: ['profile', 'birth-date', 'height'],
    label: 'dashboard.onboarding.profile',
  },
  { id: 'goal', gapIds: ['default-goal'], label: 'dashboard.onboarding.goal' },
  { id: 'weight', gapIds: ['weight'], label: 'dashboard.onboarding.weight' },
];

function template(value: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replaceAll(`{${key}}`, replacement),
    value,
  );
}

/**
 * Advisory first-run checklist (ADR-P027 Decision 1, UX-4B). Derived entirely
 * from the Data-gap state the dashboard already computes, so it is resumable by
 * construction: an unresolved prerequisite simply stays listed, and a resolved
 * one drops off while the progress line keeps counting it. It is non-blocking —
 * nothing here gates any surface — and adds NO route, NO persistence and NO
 * dismissal control, because ADR-P027 leaves dismissal semantics undecided.
 *
 * Completion is conveyed by TEXT ("2 of 3 complete"), never by colour, and no
 * status word is invented: only outstanding steps render a row, so a row always
 * means "still to do". Pure/presentational — the caller supplies the gaps and
 * the routing resolver.
 */
export function OnboardingChecklistCard({
  gaps,
  loading,
  onLoadSampleData,
  resolveFix,
}: OnboardingChecklistCardProps) {
  const theme = useTheme();
  const { t, language } = useLocalization();

  const outstandingSteps = STEPS.map((step) => ({
    ...step,
    outstanding: gaps.filter((gap) => step.gapIds.includes(gap.id)),
  })).filter((step) => step.outstanding.length > 0);
  const completed = STEPS.length - outstandingSteps.length;

  return (
    <Card accessibilityLabel={t('dashboard.onboarding.accessibility')}>
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">{t('dashboard.onboarding.title')}</AppText>
        <AppText tone="muted">{t('dashboard.onboarding.description')}</AppText>
        <AppText variant="label" tone="muted" testID="onboarding-progress">
          {template(t('dashboard.onboarding.progress'), {
            completed: formatNumber(completed, language),
            total: formatNumber(STEPS.length, language),
          })}
        </AppText>

        <View style={{ gap: theme.spacing.sm }}>
          {outstandingSteps.map((step) => {
            const label = t(step.label);
            const firstOutstanding = step.outstanding[0];
            const fix = resolveFix?.(firstOutstanding);
            return (
              <View key={step.id} style={{ gap: theme.spacing.xs }}>
                <AppText variant="label" testID={`onboarding-step-${step.id}`}>
                  {label}
                </AppText>
                {fix ? (
                  <AppButton
                    accessibilityLabel={`${t('dashboard.gap.fixAccessibility')}: ${label}`}
                    testID={`gap-fix-${firstOutstanding.id}`}
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
