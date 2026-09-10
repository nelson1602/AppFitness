import { getSession } from '@/features/authentication';
import { evaluate } from '@/features/icoach/domain/engine';
import {
  getMyLatestPhysicalAssessment,
  recordMyBodyMeasurement,
  recordMyBodyWeight,
} from '@/features/progress';
import { getActiveGoal, getMyProfile, saveMyProfile, setGoal } from '@/features/profile';
import { resolveWellnessDeclaration } from '@/features/wellness';
import { countByStatus, listPendingConflicts } from '@/shared/infrastructure/sync';

import type { DashboardData, SyncSummary } from '../domain/dashboard.types';
import { buildDashboardAssessment } from './icoach-adapter';

export async function loadDashboardData(now: Date = new Date()): Promise<DashboardData> {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');

  const [profile, activeGoal, physicalAssessment, queueCounts, conflicts, wellness] =
    await Promise.all([
      getMyProfile(),
      getActiveGoal(session.user.id),
      getMyLatestPhysicalAssessment(),
      countByStatus(session.user.id),
      listPendingConflicts(session.user.id),
      // ADR-P031 W-4C. Owner-scoped, offline-first and read-only: it consumes
      // the local row plus the relevant PENDING conflict snapshots, so a
      // pending local edit protects the user before anything is pushed.
      // The id comes from the same snapshot the other reads use, so one
      // load can never mix two accounts even if the session changes
      // mid-flight (ADR-P030 C-1).
      resolveWellnessDeclaration(session.user.id),
    ]);

  const adapter = buildDashboardAssessment({
    profile,
    activeGoal,
    physicalAssessment,
    today: now.toISOString().slice(0, 10),
    wellness,
  });

  return {
    assessment: adapter.status === 'ready' ? adapter.data : null,
    // Incomplete: blocking prerequisites first, then the advisory notes, so a
    // first-run surface sees every outstanding item. Ready: the notes are the
    // only outstanding items left. `unavailable` reports none: it is an
    // operation failure, not a set of prerequisites the user can supply.
    missing:
      adapter.status === 'incomplete'
        ? [...adapter.missing, ...adapter.notes]
        : adapter.status === 'ready'
          ? adapter.data.notes
          : [],
    sync: buildSyncSummary(queueCounts, conflicts.length),
    wellness: wellness.status,
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
  await recordMyBodyWeight({
    date: today,
    weightKg: 82,
  });
  await recordMyBodyMeasurement({
    date: today,
    bodyFatPct: 21,
    waistCm: 84,
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
