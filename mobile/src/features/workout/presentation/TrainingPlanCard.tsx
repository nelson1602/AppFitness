import { View } from 'react-native';

import type { Intensity, TrainingPlan } from '@/features/icoach/domain/types';
import { AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { toTrainingGuidance } from '../domain/training-guidance';

/**
 * Read-only surface for the deterministic iCoach `TrainingPlan` in the workout
 * module (ADR-P015 Phase 16 Slice 7). Renders, by medical priority:
 *  - blocked   → a prominent "on hold" notice (training must not start);
 *  - clearance → a "get medical clearance" warning;
 *  - ready     → a non-blocking guidance card (intensity / RPE cap / days per
 *                week / movements to avoid);
 *  - unknown   → nothing (safe fallback when the plan has not loaded).
 *
 * It never recomputes the plan or overrides medical restrictions — it only
 * displays what the engine produced (via `toTrainingGuidance`).
 */

const INTENSITY_LABEL: Record<Intensity, string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
};

export function TrainingPlanCard({ plan }: { plan: TrainingPlan | null | undefined }) {
  const theme = useTheme();
  const guidance = toTrainingGuidance(plan);

  if (guidance.status === 'unknown') return null;

  if (guidance.status === 'blocked') {
    return (
      <Banner title="Training is on hold" tone="error">
        Your iCoach assessment has paused training based on your medical information. You can review
        your plan, but do not start training until your restrictions are cleared.
      </Banner>
    );
  }

  if (guidance.status === 'clearance') {
    return (
      <Banner title="Medical clearance recommended" tone="warning">
        Your iCoach assessment suggests getting medical clearance before training. Plan carefully
        and check with a professional first.
      </Banner>
    );
  }

  // ready — non-blocking guidance from the plan (never a hard limit here).
  return (
    <Card accessibilityLabel="Training guidance">
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="title">Your training guidance</AppText>
        {guidance.intensity ? (
          <AppText variant="label">
            Suggested intensity: {INTENSITY_LABEL[guidance.intensity]}
          </AppText>
        ) : null}
        {guidance.rpeCap !== null ? (
          <AppText tone="muted">RPE cap: {guidance.rpeCap}</AppText>
        ) : null}
        {guidance.daysPerWeek !== null ? (
          <AppText tone="muted">Suggested training days per week: {guidance.daysPerWeek}</AppText>
        ) : null}
        {guidance.excludedMovements.length > 0 ? (
          <AppText variant="caption" tone="warning">
            Movements to avoid: {guidance.excludedMovements.join(', ')}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}
