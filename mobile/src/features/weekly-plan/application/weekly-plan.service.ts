import { getSession } from '@/features/authentication';
import { getById as getCatalogFood } from '@/features/nutrition/application/food-catalog.service';
import {
  listDailyCalorieTotals,
  listLoggedItems,
  listPlannedSlotsDone,
} from '@/features/nutrition/infrastructure/food-log.repository';
import { listBodyWeights } from '@/features/progress/infrastructure/progress.repository';
import { listRecentWorkoutLogs } from '@/features/workout/infrastructure/workout.repository';

import { computeWeekAdherence, type WeekAdherence, type WeekLogs } from '../domain/adherence';
import { buildWeeklyPlanContent } from '../domain/build-plan';
import { computeOffPlanAdjustment, type OffPlanAdjustment } from '../domain/off-plan';
import {
  daysProposalNote,
  openDaysProposal,
  proposedTrainingDays,
  type WeekWorkoutResult,
} from '../domain/days-progression';
import { changedPlanInputs, planInputsFingerprint, type PlanChange } from '../domain/plan-inputs';
import { nextLoadStep, progressionNotes, type PreviousWeekResult } from '../domain/progression';
import { addDays, localDateOf, previousWeekStart, weekDates, weekStartOf } from '../domain/week';
import type { PlanTrigger, WeeklyPlan } from '../domain/weekly-plan';
import {
  insertPlanRevision,
  listPastPlanRevisions,
  listWeekRevisions,
} from '../infrastructure/weekly-plan.repository';
import { gatherPlanContext, PLAN_RULE_VERSIONS, type PlanContext } from './plan-context';

/**
 * The saved weekly plan's orchestration (ADR-P042). Reads and writes go
 * through repositories; every rule is in the pure domain.
 */

/** Generous history for the weeks a person can scroll back through. */
const HISTORY_LIMIT_WORKOUTS = 500;

export type CurrentPlanResult =
  | { status: 'ready'; revisions: WeeklyPlan[]; current: WeeklyPlan }
  | { status: 'gap' }
  | { status: 'error' };

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

/** Everything adherence reads, loaded once for all weeks. */
export async function loadWeekLogs(userId: string, planIds: readonly string[]): Promise<WeekLogs> {
  const [workouts, slots, calories, weights] = await Promise.all([
    listRecentWorkoutLogs(userId, HISTORY_LIMIT_WORKOUTS),
    listPlannedSlotsDone(userId, planIds),
    listDailyCalorieTotals(userId),
    listBodyWeights(userId),
  ]);
  return {
    workouts: workouts.map((log) => ({
      localDate: localDateOf(log.startedAt),
      finished: log.finishedAt !== null,
      planLink: log.planLink,
    })),
    mealSlotsDone: new Set(slots),
    caloriesByDate: new Map(
      calories.filter((day) => day.calories > 0).map((day) => [day.date, day.calories]),
    ),
    weights: weights.map((weight) => ({ date: weight.date, weightKg: weight.weightKg })),
  };
}

function resultOf(adherence: WeekAdherence | null, loadStep: number): PreviousWeekResult | null {
  if (!adherence) return null;
  return {
    loadStep,
    plannedSessions: adherence.plannedSessions,
    fulfilledSessions: adherence.fulfilledSessions,
    daysInCalorieTarget: adherence.daysInCalorieTarget,
  };
}

async function saveRevision(
  context: PlanContext,
  weekStart: string,
  effectiveFrom: string,
  trigger: PlanTrigger,
  loadStep: number,
  notes: WeeklyPlan['notes'],
  nowIso: string,
): Promise<WeeklyPlan> {
  const plan = buildWeeklyPlanContent({
    weekStart,
    routine: context.routine,
    mealPlan: context.mealPlan,
    unrestrictedMealPlan: context.unrestrictedMealPlan,
    isExcluded: context.isExcluded,
    targets: context.targets,
    inputs: context.inputs,
    loadStep,
  });
  return insertPlanRevision(
    context.userId,
    {
      weekStart,
      effectiveFrom,
      trigger,
      loadStep,
      inputsFingerprint: planInputsFingerprint(context.inputs, PLAN_RULE_VERSIONS),
      ruleVersions: PLAN_RULE_VERSIONS,
      plan,
      notes,
    },
    nowIso,
  );
}

/**
 * This week's plan. Created once, on the first call of the week (offline
 * included), from the data at that moment; afterwards it is only read
 * (ADR-P042 D2). The load step and the iCoach note follow last week.
 */
export async function ensureCurrentWeekPlan(now: Date = new Date()): Promise<CurrentPlanResult> {
  const userId = requireUserId();
  const today = localDateOf(now.toISOString());
  const weekStart = weekStartOf(today);

  const existing = await listWeekRevisions(userId, weekStart);
  if (existing.length > 0) {
    return { status: 'ready', revisions: existing, current: existing[existing.length - 1] };
  }

  const past = await listPastPlanRevisions(userId, weekStart);
  const byWeek = (week: string) => past.filter((revision) => revision.weekStart === week);
  const lastWeek = byWeek(previousWeekStart(weekStart));
  const weekBefore = byWeek(previousWeekStart(previousWeekStart(weekStart)));

  // Days earned through the days progression stay in force (ADR-P040 D11).
  const daysLastWeek = lastWeek.at(-1)?.plan.inputs.trainingDays;
  const gathered = await gatherPlanContext(
    now,
    daysLastWeek !== undefined ? { unlockedTrainingDays: daysLastWeek } : {},
  );
  if (gathered.status !== 'ready')
    return gathered.status === 'gap' ? { status: 'gap' } : { status: 'error' };

  let previous: PreviousWeekResult | null = null;
  const results: WeekWorkoutResult[] = [];
  if (lastWeek.length > 0) {
    const logs = await loadWeekLogs(
      userId,
      [...lastWeek, ...weekBefore].map((revision) => revision.id),
    );
    const lastAdherence = computeWeekAdherence(lastWeek, logs);
    previous = resultOf(lastAdherence, lastWeek[lastWeek.length - 1].loadStep);
    for (const [revisions, adherence] of [
      [lastWeek, lastAdherence],
      [weekBefore, weekBefore.length > 0 ? computeWeekAdherence(weekBefore, logs) : null],
    ] as const) {
      if (!adherence) continue;
      results.push({
        weekStart: adherence.weekStart,
        plannedDays: revisions[revisions.length - 1].plan.inputs.trainingDays,
        plannedSessions: adherence.plannedSessions,
        fulfilledSessions: adherence.fulfilledSessions,
      });
    }
  }

  const proposal = proposedTrainingDays({
    daysInForce: gathered.context.inputs.trainingDays,
    chosenDays: gathered.context.chosenTrainingDays,
    weekStart,
    previousWeeks: results,
  });
  const notes = [
    ...progressionNotes(previous),
    ...(proposal !== null ? [daysProposalNote(proposal)] : []),
  ];

  const trigger: PlanTrigger = past.length === 0 ? 'FIRST_RUN' : 'WEEKLY';
  const current = await saveRevision(
    gathered.context,
    weekStart,
    weekStart,
    trigger,
    nextLoadStep(previous),
    notes,
    now.toISOString(),
  );
  return { status: 'ready', revisions: [current], current };
}

/**
 * What would change this week's plan, once confirmed (ADR-P042 D3): the
 * important inputs that changed since it was saved, plus an open "one more
 * day" proposal (ADR-P040 D11).
 */
export async function pendingPlanChanges(
  current: WeeklyPlan,
  now: Date = new Date(),
): Promise<PlanChange[]> {
  const daysInForce = current.plan.inputs.trainingDays;
  const gathered = await gatherPlanContext(now, { unlockedTrainingDays: daysInForce });
  if (gathered.status !== 'ready') return [];
  const changes: PlanChange[] = changedPlanInputs(current.plan.inputs, gathered.context.inputs);
  const proposal = openDaysProposal(current.notes, daysInForce);
  if (proposal !== null && proposal <= gathered.context.chosenTrainingDays) {
    changes.push('moreDays');
  }
  return changes;
}

/**
 * The person confirmed "Actualizar tu plan de esta semana": a new revision
 * effective today. Earlier days keep the previous revision. An injury change
 * resets the load step; anything else keeps it. An accepted "one more day"
 * raises the days in force; an unanswered proposal is carried forward.
 */
export async function regenerateCurrentWeek(
  current: WeeklyPlan,
  changes: readonly PlanChange[],
  now: Date = new Date(),
): Promise<WeeklyPlan | null> {
  const daysInForce = current.plan.inputs.trainingDays;
  const proposal = openDaysProposal(current.notes, daysInForce);
  const accepted = changes.includes('moreDays') && proposal !== null;
  const gathered = await gatherPlanContext(now, {
    unlockedTrainingDays: accepted ? proposal : daysInForce,
  });
  if (gathered.status !== 'ready') return null;
  const today = localDateOf(now.toISOString());
  const loadStep = changes.includes('injuries') ? 0 : current.loadStep;
  const notes = [
    ...changes.map((change) => ({ code: `plan.changed.${change}` })),
    ...(!accepted && proposal !== null ? [daysProposalNote(proposal)] : []),
  ];
  return saveRevision(
    gathered.context,
    current.weekStart,
    today < current.weekStart ? current.weekStart : today,
    'CHANGE',
    loadStep,
    notes,
    now.toISOString(),
  );
}

/** One row of "Semanas anteriores" with the note the iCoach wrote for the next week. */
export interface PastWeek {
  adherence: WeekAdherence;
  /** The notes of the plan that FOLLOWED this week: what the iCoach adjusted. */
  nextWeekNotes: WeeklyPlan['notes'];
}

/** Past weeks, newest first (ADR-P042 D7). Weeks without a saved plan are not shown. */
export async function loadPastWeeks(now: Date = new Date()): Promise<PastWeek[]> {
  const userId = requireUserId();
  const weekStart = weekStartOf(localDateOf(now.toISOString()));
  const past = await listPastPlanRevisions(userId, weekStart);
  if (past.length === 0) return [];
  const current = await listWeekRevisions(userId, weekStart);
  const all = [...past, ...current];
  const logs = await loadWeekLogs(
    userId,
    past.map((revision) => revision.id),
  );

  const byWeek = new Map<string, WeeklyPlan[]>();
  for (const revision of past) {
    byWeek.set(revision.weekStart, [...(byWeek.get(revision.weekStart) ?? []), revision]);
  }
  const weeks: PastWeek[] = [];
  for (const [week, revisions] of [...byWeek.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const adherence = computeWeekAdherence(revisions, logs);
    if (!adherence) continue;
    const next = all
      .filter((revision) => revision.weekStart === addDays(week, 7))
      .sort((a, b) => a.revision - b.revision)[0];
    weeks.push({ adherence, nextWeekNotes: next?.notes ?? [] });
  }
  return weeks;
}

/** This week's adherence so far, for the current plan. */
export async function loadCurrentWeekAdherence(
  revisions: readonly WeeklyPlan[],
): Promise<WeekAdherence | null> {
  if (revisions.length === 0) return null;
  const logs = await loadWeekLogs(
    revisions[0].userId,
    revisions.map((revision) => revision.id),
  );
  return computeWeekAdherence(revisions, logs);
}

/**
 * Today's off-plan overlay (ADR-P040 D7): yesterday's logged calories against
 * the plan, and alcohol logged yesterday or today. Never writes the plan.
 */
export async function loadTodayOverlay(
  current: WeeklyPlan,
  now: Date = new Date(),
): Promise<OffPlanAdjustment> {
  const today = localDateOf(now.toISOString());
  const yesterday = addDays(today, -1);
  const [yesterdayItems, todayItems] = await Promise.all([
    listLoggedItems(current.userId, yesterday),
    listLoggedItems(current.userId, today),
  ]);
  const kcal = yesterdayItems.reduce((sum, item) => sum + item.consumed.calories, 0);
  const alcohol = [...yesterdayItems, ...todayItems].some((item) =>
    (getCatalogFood(item.catalogKey ?? '')?.avoidFor ?? []).includes('alcohol'),
  );
  return computeOffPlanAdjustment({
    targets: current.plan.targets,
    yesterdayCalories: yesterdayItems.length > 0 ? kcal : null,
    alcoholYesterdayOrToday: alcohol,
  });
}

/** The 7 dates of the current plan's week (for the meal-plan slider). */
export function currentWeekDates(current: WeeklyPlan): string[] {
  return weekDates(current.weekStart);
}
