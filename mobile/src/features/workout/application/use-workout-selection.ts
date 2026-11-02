import { useEffect, useMemo } from 'react';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { useProfileStore } from '@/features/profile/application/profile.store';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { planAsRoutine } from '@/features/weekly-plan/domain/plan-routine';
import { useEntitlementAccess } from '@/shared/application/use-entitlement-access';

import { selectWorkoutRoutine, type WorkoutRoutineSelection } from './workout-routine.service';

export type WorkoutSelectionState =
  | { kind: 'subscription' }
  | { kind: 'loading' }
  | { kind: 'wellness-unavailable' }
  | { kind: 'error' }
  | { kind: 'ready'; selection: WorkoutRoutineSelection; sessionMinutes: number | null };

/**
 * The week's routine for the Entrenamientos tab and "Plan completo": the saved
 * week (ADR-P042) with the live routine's progression rules and equipment
 * notes; the live routine is the fallback until the week's plan exists.
 */
export function useWorkoutSelection(): WorkoutSelectionState {
  const dashboardStatus = useDashboardStore((state) => state.status);
  const assessment = useDashboardStore((state) => state.data?.assessment ?? null);
  // The read outcome, so a surface can tell an unreadable declaration
  // (ADR-P031 §Decision 8) from a generic dashboard failure.
  const wellnessRead = useDashboardStore((state) => state.data?.wellness ?? 'absent');
  const refreshDashboard = useDashboardStore((state) => state.refresh);
  const profileStatus = useProfileStore((state) => state.status);
  const profile = useProfileStore((state) => state.profile);
  const loadProfile = useProfileStore((state) => state.load);
  const entitlement = useEntitlementAccess();
  const generationAllowed = entitlement.mode === 'unregulated' || entitlement.mode === 'active';
  const planRevisions = useWeeklyPlanStore((state) => state.revisions);

  useEffect(() => {
    if (dashboardStatus === 'idle') void refreshDashboard();
  }, [dashboardStatus, refreshDashboard]);

  useEffect(() => {
    if (profileStatus === 'idle') void loadProfile();
  }, [loadProfile, profileStatus]);

  const live = useMemo(
    () =>
      profile && generationAllowed
        ? selectWorkoutRoutine(assessment, {
            equipment: profile.equipment,
            sessionDurationMins: profile.sessionDurationMins,
            // ADR-P031 W-4D: the assessment's own exclusion set, not `[]`.
            excludedMovements: assessment?.assessment.training.excludedMovements ?? [],
          })
        : ({ status: 'gap' } satisfies WorkoutRoutineSelection),
    [assessment, generationAllowed, profile],
  );
  const selection = useMemo<WorkoutRoutineSelection>(() => {
    const saved = generationAllowed ? planAsRoutine(planRevisions) : null;
    if (!saved || live.status !== 'ready') return live;
    return { ...live, routine: { ...saved, progression: live.routine.progression } };
  }, [generationAllowed, live, planRevisions]);

  if (!generationAllowed) return { kind: 'subscription' };
  if (
    dashboardStatus === 'idle' ||
    dashboardStatus === 'loading' ||
    profileStatus === 'idle' ||
    profileStatus === 'loading'
  ) {
    return { kind: 'loading' };
  }
  // An unreadable declaration outranks the generic failure: the plan must not
  // be presented as respecting limitations the app could not read.
  if (wellnessRead === 'unavailable') return { kind: 'wellness-unavailable' };
  if (dashboardStatus === 'error' || profileStatus === 'error') return { kind: 'error' };
  return { kind: 'ready', selection, sessionMinutes: profile?.sessionDurationMins ?? null };
}
