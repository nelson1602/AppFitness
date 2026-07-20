import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import type { TrainingPlan } from '@/features/icoach/domain/types';

/**
 * Reads the deterministic iCoach `TrainingPlan` the dashboard store has already
 * assembled (ADR-P015 Phase 16 Slice 7). The workout module consumes it
 * READ-ONLY — it never recomputes the plan or the medical restrictions behind
 * it. Returns `null` when the dashboard has no assessment yet (safe fallback);
 * callers pass the result to `toTrainingGuidance`.
 */
export function useTrainingPlan(): TrainingPlan | null {
  return useDashboardStore((s) => s.data?.assessment?.assessment.training ?? null);
}
