import { getSession } from '@/features/authentication';
import { evaluate } from '@/features/icoach/domain/engine';
import { getMyActiveRestrictions, getMyEvaluations, recordEvaluation } from '@/features/medical';
import { getActiveGoal, getMyProfile, saveMyProfile, setGoal } from '@/features/profile';
import { countByStatus, listPendingConflicts } from '@/shared/infrastructure/sync';

import type { DashboardData, SyncSummary } from '../domain/dashboard.types';
import { buildDashboardAssessment } from './icoach-adapter';

export async function loadDashboardData(now: Date = new Date()): Promise<DashboardData> {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');

  const [profile, activeGoal, evaluations, restrictions, queueCounts, conflicts] =
    await Promise.all([
      getMyProfile(),
      getActiveGoal(session.user.id),
      getMyEvaluations(),
      getMyActiveRestrictions(),
      countByStatus(),
      listPendingConflicts(),
    ]);

  const latestEvaluation = evaluations[0] ?? null;
  const adapter = buildDashboardAssessment({
    profile,
    activeGoal,
    latestEvaluation,
    activeRestrictions: restrictions,
    today: now.toISOString().slice(0, 10),
  });

  return {
    assessment: adapter.status === 'ready' ? adapter.data : null,
    missing: adapter.status === 'incomplete' ? adapter.missing : adapter.data.notes,
    sync: buildSyncSummary(queueCounts, conflicts.length),
  };
}

export async function loadSampleDashboardData(now: Date = new Date()): Promise<void> {
  if (!__DEV__) return;
  const session = getSession();
  if (!session) throw new Error('Not authenticated');

  const today = now.toISOString().slice(0, 10);
  await saveMyProfile({
    birthDate: '1990-01-15',
    gender: 'MALE',
    heightCm: 178,
    fitnessLevel: 'INTERMEDIATE',
    yearsTraining: 2,
    activityLevel: 'MODERATE',
    sleepHoursBaseline: 7,
    stressLevelBaseline: 2,
    equipment: ['dumbbells', 'bench'],
    trainingDaysPerWeek: 4,
    sessionDurationMins: 55,
  });
  await setGoal(session.user.id, {
    goalType: 'RECOMPOSITION',
    targetWeightKg: 78,
    targetDate: '2026-12-31',
  });
  await recordEvaluation({
    evaluationDate: today,
    weightKg: 82,
    bodyFatPct: 21,
    muscleMassKg: 36,
    bloodPressureSystolic: 122,
    bloodPressureDiastolic: 78,
    restingHeartRate: 62,
    sleepQuality: 4,
    stressLevel: 2,
    activityLevel: 'MODERATE',
  });

  // Force one engine call in dev seed so type drift between fixtures and
  // deterministic rules fails early during manual validation.
  const seeded = await loadDashboardData(now);
  if (seeded.assessment) evaluate(seeded.assessment.engineInput);
}

function buildSyncSummary(
  queueCounts: Awaited<ReturnType<typeof countByStatus>>,
  conflicts: number,
): SyncSummary {
  return {
    pending: queueCounts.PENDING ?? 0,
    inFlight: queueCounts.IN_FLIGHT ?? 0,
    failed: queueCounts.FAILED ?? 0,
    conflicts,
    status: 'idle',
    lastSyncedAt: null,
    message: null,
  };
}
