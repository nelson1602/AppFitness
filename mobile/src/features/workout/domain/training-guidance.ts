import type { Intensity, TrainingPlan } from '@/features/icoach/domain/types';

/**
 * Deterministic view model over the iCoach `TrainingPlan` for the workout
 * module (ADR-P015 Phase 16 Slice 7). The engine owns the plan; the workout
 * module only READS it — never recomputes, overrides, or reinterprets medical
 * restrictions.
 *
 * Medical priority is absolute and encoded here as a total ordering:
 *   blocked  >  requiresMedicalClearance  >  ready
 * When no plan is available yet (dashboard not loaded / no assessment) the
 * status is `unknown`: a safe, non-blocking fallback with no excluded movements.
 *
 * Pure and side-effect free — identical input always yields identical output.
 */

export type TrainingGuidanceStatus = 'blocked' | 'clearance' | 'ready' | 'unknown';

export interface TrainingGuidance {
  status: TrainingGuidanceStatus;
  /** True only for `blocked` — training must not start. */
  blocked: boolean;
  /** True only for `clearance` — get medical clearance before training. */
  requiresMedicalClearance: boolean;
  intensity: Intensity | null;
  rpeCap: number | null;
  daysPerWeek: number | null;
  /** Movement tokens the plan excludes (empty when unknown). */
  excludedMovements: string[];
}

export function toTrainingGuidance(plan: TrainingPlan | null | undefined): TrainingGuidance {
  if (!plan) {
    return {
      status: 'unknown',
      blocked: false,
      requiresMedicalClearance: false,
      intensity: null,
      rpeCap: null,
      daysPerWeek: null,
      excludedMovements: [],
    };
  }

  // Medical priority: blocked outranks clearance outranks ready.
  const status: TrainingGuidanceStatus = plan.blocked
    ? 'blocked'
    : plan.requiresMedicalClearance
      ? 'clearance'
      : 'ready';

  return {
    status,
    blocked: plan.blocked,
    requiresMedicalClearance: plan.requiresMedicalClearance,
    intensity: plan.intensity,
    rpeCap: plan.rpeCap,
    daysPerWeek: plan.daysPerWeek,
    excludedMovements: plan.excludedMovements,
  };
}
