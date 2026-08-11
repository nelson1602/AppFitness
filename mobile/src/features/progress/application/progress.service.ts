import { getSession } from '@/features/authentication';

import type { BodyMeasurementInput, BodyWeightInput } from '../domain/progress';
import {
  createBodyMeasurement,
  createBodyWeight,
  listBodyMeasurements,
  listBodyWeights,
} from '../infrastructure/progress.repository';

export interface PhysicalAssessmentMetrics {
  weightKg: number | null;
  bodyFatPct: number | null;
}

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

/** Public-v1 wellness baseline. Medical evaluations are intentionally not read. */
export async function getMyLatestPhysicalAssessment(): Promise<PhysicalAssessmentMetrics> {
  const userId = requireUserId();
  const [weights, measurements] = await Promise.all([
    listBodyWeights(userId, 1),
    listBodyMeasurements(userId, 1),
  ]);

  return {
    weightKg: weights[0]?.weightKg ?? null,
    bodyFatPct: measurements[0]?.bodyFatPct ?? null,
  };
}

export function recordMyBodyWeight(input: BodyWeightInput) {
  return createBodyWeight(requireUserId(), input);
}

export function recordMyBodyMeasurement(input: BodyMeasurementInput) {
  return createBodyMeasurement(requireUserId(), input);
}
