import { getSession } from '@/features/authentication';
import { buildDashboardAssessment } from '@/features/dashboard/application/icoach-adapter';
import {
  addDietaryPreference,
  getMyDietaryPreferences,
  removeDietaryPreference,
} from '@/features/nutrition/application/dietary-preference.service';
import type { Profile } from '@/features/profile/domain/profile.types';
import { getMyActiveGoal, getMyProfile, saveMyProfile, setMyGoal } from '@/features/profile';
import { getMyLatestPhysicalAssessment, recordMyBodyWeight } from '@/features/progress';
import {
  getMyWellnessSafetyProfile,
  saveMyWellnessSafetyProfile,
} from '@/features/wellness/application/wellness-safety-profile.service';
import type { WellnessDeclaration } from '@/features/wellness/application/wellness-safety-consumption';
import { deviceToday } from '@/features/wellness/domain/wellness-safety-profile.rules';

import {
  draftFromSources,
  goalChanged,
  isEvaluationOwed,
  planDietaryChanges,
  toGoalInput,
  toProfileInput,
  toWellnessInput,
  type EvaluationDraft,
  type EvaluationSources,
} from '../domain/evaluation';

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

/** The person's saved data, read once, local-first. */
export async function loadEvaluationSources(now: Date = new Date()): Promise<EvaluationSources> {
  requireUserId();
  const [profile, goal, physical, wellness, preferences] = await Promise.all([
    getMyProfile(),
    getMyActiveGoal(),
    getMyLatestPhysicalAssessment(),
    getMyWellnessSafetyProfile(),
    getMyDietaryPreferences(),
  ]);
  return {
    profile,
    goal,
    weightKg: physical.weightKg,
    wellness,
    preferences,
    today: deviceToday(now),
  };
}

export async function loadEvaluationDraft(
  now: Date = new Date(),
): Promise<{ sources: EvaluationSources; draft: EvaluationDraft }> {
  const sources = await loadEvaluationSources(now);
  return { sources, draft: draftFromSources(sources) };
}

/** Whether the signed-in account still owes the first-run evaluation. */
export async function checkEvaluationOwed(): Promise<boolean> {
  return isEvaluationOwed(await loadEvaluationSources());
}

/**
 * Save the evaluation onto the existing entities, each local-first and synced
 * by its own path. Only what changed is written: a goal row is replaced only
 * when the goal changed (ADR history), a weigh-in is added only when the
 * weight differs from the latest one.
 */
export async function saveEvaluation(
  draft: EvaluationDraft,
  sources: EvaluationSources,
): Promise<void> {
  requireUserId();
  await saveMyProfile(toProfileInput(draft, sources.profile));
  if (draft.weightKg !== null && draft.weightKg !== sources.weightKg) {
    await recordMyBodyWeight({ date: sources.today, weightKg: draft.weightKg });
  }
  if (goalChanged(draft, sources.goal)) await setMyGoal(toGoalInput(draft));
  await saveMyWellnessSafetyProfile(toWellnessInput(draft, sources.wellness), sources.today);

  // Removals first: a kind change is a remove plus a create of the same food.
  const change = planDietaryChanges(draft, sources.preferences);
  for (const id of change.remove) await removeDietaryPreference(id);
  for (const entry of change.create) {
    await addDietaryPreference(
      entry.avoidTag
        ? { exclusionType: 'avoid_tag', avoidTag: entry.avoidTag, kind: entry.kind }
        : { exclusionType: 'catalog_key', catalogKey: entry.catalogKey, kind: entry.kind },
    );
  }
}

export interface EvaluationPreview {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  trainingDays: number;
  /** Movements the iCoach leaves out because of the declared injuries. */
  healthAdjustments: number;
}

/**
 * "Vista previa del iCoach": the deterministic engine run on the draft as if
 * it were saved. Same adapter the Panel uses, so the preview and the plan
 * cannot disagree. Null while the draft is incomplete.
 */
export function previewEvaluation(
  draft: EvaluationDraft,
  sources: EvaluationSources,
): EvaluationPreview | null {
  const profileInput = toProfileInput(draft, sources.profile);
  const wellness = toWellnessInput(draft, sources.wellness);
  const profile = {
    ...(sources.profile ?? {}),
    ...profileInput,
    yearsTraining: sources.profile?.yearsTraining ?? 0,
  } as Profile;
  const result = buildDashboardAssessment({
    profile,
    activeGoal: {
      id: 'preview',
      userId: '',
      goalType: draft.goalType,
      targetWeightKg: draft.targetWeightKg,
      targetDate: draft.targetDate,
      isActive: true,
      startedAt: sources.today,
      endedAt: null,
      version: 0,
      syncStatus: 'pending',
    },
    physicalAssessment: { weightKg: draft.weightKg, bodyFatPct: null },
    today: sources.today,
    wellness: { status: 'available', declaration: wellness as WellnessDeclaration },
  });
  if (result.status !== 'ready') return null;
  const { nutrition, training } = result.data.assessment;
  return {
    calories: nutrition.calories,
    proteinG: nutrition.proteinG,
    carbsG: nutrition.carbsG,
    fatG: nutrition.fatG,
    trainingDays: training.daysPerWeek,
    healthAdjustments: training.excludedMovements.length,
  };
}
