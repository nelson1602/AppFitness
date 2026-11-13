import { addDays } from '@/features/weekly-plan/domain/week';

/**
 * Day-to-day carry-over (ADR-P040 Addendum v11-B, rule `carry-over@1.0.0`).
 * One rule for food and exercise; it replaces D7's calorie and cardio parts.
 * Pure and deterministic: identical logs give the identical adjustment.
 *
 * - C1 Difference: a day with at least one logged food compares what was
 *   logged with that day's actual target (today's model: base + its own
 *   carry-over + its extra-cardio bonus), never a saved week's stale target.
 *   A day with nothing logged adds no difference.
 * - C2 Over: up to `CARRY_OVER_DAILY_CAP_PCT` % of the base comes off the next
 *   day's food. The excess beyond it becomes easy cardio on the next scheduled
 *   workout instead of more reduced days: minutes = kcal ÷ (net MET × kg),
 *   the workout calorie model (`extra-activity`), capped at
 *   `MAX_CARDIO_MINUTES`; the rest is dropped. Kcal covered by food are never
 *   also covered by cardio. No cardio when a restriction rules it out.
 * - C3 Under: food goes up, at most `CARRY_OVER_DAILY_CAP_PCT` % of the base a
 *   day, spread over the next `CARRY_OVER_SPREAD_DAYS` days, then dropped.
 *   Exercise is never reduced.
 * - C4 Opposite differences cancel first: a day over cancels food still queued
 *   from a day under (oldest first), and the reverse.
 * - C5 Safe minimum: a day's planned target never goes below the iCoach's safe
 *   minimum (the larger of the clinical floor and BMR, `planNutrition`). Only
 *   what was applied leaves the queue.
 * - C6 Window: rebuilt from `CARRY_OVER_LOOKBACK_DAYS` days before today,
 *   starting empty. The base target is never written.
 */
export const CARRY_OVER_RULE_VERSION = 'carry-over@1.0.0';
export const CARRY_OVER_DAILY_CAP_PCT = 10;
export const CARRY_OVER_SPREAD_DAYS = 3;
export const CARRY_OVER_LOOKBACK_DAYS = 7;
/** C2: the most cardio one day over can add to a workout. */
export const MAX_CARDIO_MINUTES = 30;
/** C2: brisk walking, low–moderate (Compendium 17190, `ACTIVITY_MET.walking`). */
export const CARDIO_MET = 3.5;
/** C2: minutes are given in 5-minute steps; less than half a step is none. */
export const CARDIO_STEP_MINUTES = 5;

/** One past day's logged intake (device-local date). */
export interface DayIntake {
  date: string;
  /** kcal logged that day. */
  calories: number;
  /** Logged food items that day; 0 means the day does not count (C1). */
  items: number;
}

export interface CarryOverInput {
  /** Device-local `YYYY-MM-DD`. */
  today: string;
  /** The iCoach's base calorie target (never changed by this rule). */
  baseCalories: number;
  /** The iCoach's safe minimum (C5). */
  floorCalories: number;
  /** Past days, any order; days outside the window are ignored. */
  days: readonly DayIntake[];
  /** Extra-cardio bonus per date (ADR-P040 v10-A R2), when known. */
  bonusByDate?: Readonly<Record<string, number>>;
  /** For the cardio minutes (C2); without it no cardio is added. */
  weightKg?: number | null;
  /** False when the evaluation restricts this kind of exercise (C2). */
  cardioAllowed?: boolean;
}

export interface CarryOverDay {
  date: string;
  consumed: number;
  /** That day's planned target (base + carry-over + bonus). */
  target: number;
}

/** C2: easy cardio for the first scheduled workout after `fromDate`. */
export interface CarryOverCardio {
  fromDate: string;
  /** Excess kcal beyond the food part, before the cap. */
  kcal: number;
  minutes: number;
}

export interface CarryOver {
  ruleVersion: typeof CARRY_OVER_RULE_VERSION;
  /** kcal added to (positive) or removed from (negative) today's target. */
  adjustment: number;
  /** Yesterday, when something was logged. */
  yesterday: CarryOverDay | null;
  /** kcal still queued for the coming days after today (signed). */
  remaining: number;
  /** Cardio owed by each day over in the window, oldest first (C2). */
  cardio: CarryOverCardio[];
}

interface Queued {
  amount: number;
  daysLeft: number;
}

const sum = (queue: readonly Queued[]) => queue.reduce((total, item) => total + item.amount, 0);

/** Removes `kcal` (≥ 0) of the queue's sign, oldest first. */
function consume(queue: Queued[], kcal: number): void {
  let left = kcal;
  for (const item of queue) {
    if (left <= 0) break;
    const take = Math.min(Math.abs(item.amount), left);
    item.amount -= Math.sign(item.amount) * take;
    left -= take;
  }
}

/** C4: cancels the opposite sign first; returns what is left of `diff`. */
function cancel(queue: Queued[], diff: number): number {
  let left = diff;
  for (const item of queue) {
    if (left === 0) break;
    if (item.amount === 0 || Math.sign(item.amount) === Math.sign(left)) continue;
    const amount = Math.min(Math.abs(item.amount), Math.abs(left));
    item.amount -= Math.sign(item.amount) * amount;
    left -= Math.sign(left) * amount;
  }
  return left;
}

/** C2–C3 + C5: what the day takes from the queue. */
function take(queue: readonly Queued[], base: number, floor: number, cap: number): number {
  const pending = sum(queue);
  let adjustment = Math.sign(pending) * Math.min(cap, Math.abs(pending));
  if (adjustment < 0) adjustment = Math.max(adjustment, Math.min(0, floor - base));
  return adjustment;
}

/** C2: kcal as minutes of easy cardio, in 5-minute steps, capped. */
export function cardioMinutes(kcal: number, weightKg: number): number {
  const perMinute = ((CARDIO_MET - 1) * weightKg) / 60;
  if (kcal <= 0 || perMinute <= 0) return 0;
  const steps = Math.round(kcal / perMinute / CARDIO_STEP_MINUTES);
  return Math.min(MAX_CARDIO_MINUTES, steps * CARDIO_STEP_MINUTES);
}

export function computeCarryOver(input: CarryOverInput): CarryOver {
  const base = Math.round(input.baseCalories);
  const floor = Math.round(input.floorCalories);
  const cap = Math.round((base * CARRY_OVER_DAILY_CAP_PCT) / 100);
  const weight = input.weightKg ?? null;
  const cardioAllowed = input.cardioAllowed !== false && weight !== null && weight > 0;
  const byDate = new Map(input.days.map((day) => [day.date, day]));
  const queue: Queued[] = [];
  const cardio: CarryOverCardio[] = [];
  let yesterday: CarryOverDay | null = null;

  for (let back = CARRY_OVER_LOOKBACK_DAYS; back >= 1; back -= 1) {
    const date = addDays(input.today, -back);
    const adjustment = take(queue, base, floor, cap);
    consume(queue, Math.abs(adjustment));
    for (const item of queue) item.daysLeft -= 1;
    const live = queue.filter((item) => item.daysLeft > 0 && item.amount !== 0);
    queue.splice(0, queue.length, ...live);

    const day = byDate.get(date);
    if (!day || day.items <= 0) continue;
    const target = base + adjustment + Math.max(0, Math.round(input.bonusByDate?.[date] ?? 0));
    const consumed = Math.round(day.calories);
    if (back === 1) yesterday = { date, consumed, target };
    const left = cancel(queue, target - consumed);
    if (left > 0) {
      // C3: under, spread over the next days.
      queue.push({ amount: left, daysLeft: CARRY_OVER_SPREAD_DAYS });
    } else if (left < 0) {
      // C2: over, the next day's food first, the rest as cardio.
      const food = Math.min(-left, cap);
      queue.push({ amount: -food, daysLeft: 1 });
      const excess = -left - food;
      const minutes = cardioAllowed && excess > 0 ? cardioMinutes(excess, weight as number) : 0;
      if (minutes > 0) cardio.push({ fromDate: date, kcal: excess, minutes });
    }
  }

  const adjustment = take(queue, base, floor, cap);
  consume(queue, Math.abs(adjustment));
  const remaining = sum(queue.filter((item) => item.daysLeft > 1));
  return { ruleVersion: CARRY_OVER_RULE_VERSION, adjustment, yesterday, remaining, cardio };
}
