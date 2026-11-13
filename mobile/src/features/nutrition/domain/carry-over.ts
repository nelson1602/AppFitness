import { addDays } from '@/features/weekly-plan/domain/week';

/**
 * Day-to-day carry-over (ADR-P040 Addendum v11-B, rule `carry-over@1.0.0`).
 * Pure and deterministic: identical logs give the identical adjustment.
 *
 * - C1 Difference: a day with at least one logged food compares what was
 *   logged with that day's planned target (base + its own carry-over + its
 *   extra-cardio bonus). Under → today plans more; over → today plans less.
 *   A day with nothing logged adds no difference.
 * - C2 Queue: a new difference first cancels what is still queued with the
 *   opposite sign (oldest first); the rest is queued for the next
 *   `CARRY_OVER_SPREAD_DAYS` calendar days, then dropped.
 * - C3 Daily cap: each day takes at most `CARRY_OVER_DAILY_CAP_PCT` % of the
 *   base target from the queue, oldest first.
 * - C4 Safe minimum: a day's planned target never goes below the iCoach's safe
 *   minimum (the larger of the clinical floor and BMR, `planNutrition`); only
 *   what was applied leaves the queue.
 * - C5 Window: the queue is rebuilt from `CARRY_OVER_LOOKBACK_DAYS` days before
 *   today, starting empty. The base target is never written.
 */
export const CARRY_OVER_RULE_VERSION = 'carry-over@1.0.0';
export const CARRY_OVER_DAILY_CAP_PCT = 10;
export const CARRY_OVER_SPREAD_DAYS = 3;
export const CARRY_OVER_LOOKBACK_DAYS = 7;

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
  /** The iCoach's safe minimum (C4). */
  floorCalories: number;
  /** Past days, any order; days outside the window are ignored. */
  days: readonly DayIntake[];
  /** Extra-cardio bonus per date (ADR-P040 v10-A R2), when known. */
  bonusByDate?: Readonly<Record<string, number>>;
}

export interface CarryOverDay {
  date: string;
  consumed: number;
  /** That day's planned target (base + carry-over + bonus). */
  target: number;
}

export interface CarryOver {
  ruleVersion: typeof CARRY_OVER_RULE_VERSION;
  /** kcal added to (positive) or removed from (negative) today's target. */
  adjustment: number;
  /** Yesterday, when something was logged. */
  yesterday: CarryOverDay | null;
  /** kcal still queued for the coming days after today (signed). */
  remaining: number;
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

/** C2: cancels the opposite sign first, queues the rest. */
function enqueue(queue: Queued[], diff: number): void {
  let left = diff;
  for (const item of queue) {
    if (left === 0) break;
    if (Math.sign(item.amount) === Math.sign(left) || item.amount === 0) continue;
    const cancel = Math.min(Math.abs(item.amount), Math.abs(left));
    item.amount -= Math.sign(item.amount) * cancel;
    left -= Math.sign(left) * cancel;
  }
  if (left !== 0) queue.push({ amount: left, daysLeft: CARRY_OVER_SPREAD_DAYS });
}

/** C3 + C4: what the day takes from the queue. */
function take(queue: readonly Queued[], base: number, floor: number): number {
  const pending = sum(queue);
  const cap = Math.round((base * CARRY_OVER_DAILY_CAP_PCT) / 100);
  let adjustment = Math.sign(pending) * Math.min(cap, Math.abs(pending));
  if (adjustment < 0) adjustment = Math.max(adjustment, Math.min(0, floor - base));
  return adjustment;
}

export function computeCarryOver(input: CarryOverInput): CarryOver {
  const base = Math.round(input.baseCalories);
  const floor = Math.round(input.floorCalories);
  const byDate = new Map(input.days.map((day) => [day.date, day]));
  const queue: Queued[] = [];
  let yesterday: CarryOverDay | null = null;

  for (let back = CARRY_OVER_LOOKBACK_DAYS; back >= 1; back -= 1) {
    const date = addDays(input.today, -back);
    const adjustment = take(queue, base, floor);
    consume(queue, Math.abs(adjustment));
    for (const item of queue) item.daysLeft -= 1;
    const live = queue.filter((item) => item.daysLeft > 0 && item.amount !== 0);
    queue.splice(0, queue.length, ...live);

    const day = byDate.get(date);
    if (!day || day.items <= 0) continue;
    const target = base + adjustment + Math.max(0, Math.round(input.bonusByDate?.[date] ?? 0));
    const consumed = Math.round(day.calories);
    enqueue(queue, target - consumed);
    if (back === 1) yesterday = { date, consumed, target };
  }

  const adjustment = take(queue, base, floor);
  consume(queue, Math.abs(adjustment));
  const remaining = sum(queue.filter((item) => item.daysLeft > 1));
  return { ruleVersion: CARRY_OVER_RULE_VERSION, adjustment, yesterday, remaining };
}
