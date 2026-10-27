import { getSession } from '@/features/authentication';
import { logPlannedMeal } from '@/features/nutrition/infrastructure/food-log.repository';
import { recordMyBodyWeight } from '@/features/progress/application/progress.service';
import {
  createWorkoutLog,
  updateWorkoutLog,
} from '@/features/workout/infrastructure/workout.repository';

import { addDays, localDateOf, weekStartOf } from '../domain/week';
import { listPastPlanRevisions } from '../infrastructure/weekly-plan.repository';
import { ensureCurrentWeekPlan } from './weekly-plan.service';

/**
 * DEV ONLY (owner decision 9, v8 Block 2): four past weeks of plans and
 * activity, so "Semanas anteriores" can be reviewed without waiting a month.
 *
 * It goes through the production path — each week's plan is built by
 * `ensureCurrentWeekPlan` as of that week's Monday, so the progression rule
 * and its notes are the real ones — and the rows sync like any other edit.
 * It refuses to run outside a development build, against anything but a
 * local API, or for an account that already has past weeks.
 */

/**
 * Sessions skipped and the share of planned meals eaten, oldest week first.
 * The two most recent weeks complete every session, so the "one more day"
 * proposal (ADR-P040 D11) can be reviewed at the next Monday plan.
 */
const PATTERN = [
  { skipped: 2, mealTenths: 5 },
  { skipped: 1, mealTenths: 7 },
  { skipped: 0, mealTenths: 9 },
  { skipped: 0, mealTenths: 8 },
] as const;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

export function isLocalApi(url: string | undefined): boolean {
  const base = url ?? 'http://localhost:3001';
  const host = /^https?:\/\/([^/:]+)/.exec(base)?.[1];
  return host !== undefined && LOCAL_HOSTS.has(host);
}

export function canSeedDevHistory(): boolean {
  return __DEV__ && isLocalApi(process.env.EXPO_PUBLIC_API_URL);
}

/** Local noon of a calendar date. */
const noon = (date: string) => new Date(`${date}T12:00:00`);

export async function seedDevHistory(now: Date = new Date()): Promise<number> {
  if (!canSeedDevHistory()) throw new Error('dev history seed: development build + local API only');
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  const userId = session.user.id;

  const thisWeek = weekStartOf(localDateOf(now.toISOString()));
  const firstWeek = addDays(thisWeek, -7 * PATTERN.length);
  if ((await listPastPlanRevisions(userId, thisWeek)).length > 0) {
    throw new Error('dev history seed: this account already has past weeks');
  }

  let weight = 82;
  for (const [index, week] of PATTERN.entries()) {
    const weekStart = addDays(firstWeek, 7 * index);
    const result = await ensureCurrentWeekPlan(noon(weekStart));
    if (result.status !== 'ready') throw new Error(`dev history seed: plan ${result.status}`);
    const plan = result.current;

    // Workouts: the last `skipped` sessions of the week are missed.
    const training = plan.plan.days.filter((day) => day.workout.kind === 'TRAINING');
    for (const day of training.slice(0, training.length - week.skipped)) {
      if (day.workout.kind !== 'TRAINING') continue;
      const startedAt = new Date(`${day.date}T18:00:00`).toISOString();
      const log = await createWorkoutLog(userId, {
        name: day.workout.sessionKey,
        startedAt,
        planLink: {
          weeklyPlanId: plan.id,
          planSessionKey: day.workout.sessionKey,
          planDate: day.date,
        },
      });
      await updateWorkoutLog(userId, log.id, {
        finishedAt: new Date(`${day.date}T18:50:00`).toISOString(),
      });
    }

    // Meals: a fixed, spread-out share of the planned slots.
    let slot = 0;
    for (const day of plan.plan.days) {
      for (const meal of day.meals) {
        const eaten = (slot * 7) % 10 < week.mealTenths;
        slot += 1;
        if (!eaten || meal.foods.length === 0) continue;
        await logPlannedMeal(userId, {
          date: day.date,
          mealType: meal.slot,
          lines: meal.foods.map((food) => ({
            catalogKey: food.foodId,
            servingCount: food.servings,
          })),
          planLink: { planId: plan.id, planDate: day.date, planSlot: meal.slot },
        });
      }
    }

    // Two weigh-ins a week, trending down.
    await recordMyBodyWeight({ date: weekStart, weightKg: weight });
    weight = Math.round((weight - 0.4) * 10) / 10;
    await recordMyBodyWeight({ date: addDays(weekStart, 6), weightKg: weight });
  }
  return PATTERN.length;
}
