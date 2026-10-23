/**
 * In-app notifications (ADR-P039 D4). No push; nothing is sent or synced.
 *
 * Every item is derived deterministically from data already on the device, and
 * its id is stable for the period it covers (a day, an ISO week, a month), so
 * "read" survives app restarts and a new period brings the reminder back. The
 * "iCoach adjusted your plan" item waits for ADR-P040.
 */
export const NOTIFICATION_RULE_VERSION = 'notifications@1.0.0';

export type NotificationKind = 'today-training' | 'today-rest' | 'weigh-in' | 'evaluation-review';
/** The tab each notification opens. */
export type NotificationTarget = 'workouts' | 'progress' | 'profile';

export interface AppNotification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly target: NotificationTarget;
}

export interface NotificationInputs {
  /** Device-local `YYYY-MM-DD`. */
  readonly today: string;
  /** Monday of today's ISO week, `YYYY-MM-DD`. */
  readonly weekStart: string;
  /** Today from the generated plan, or `null` without one. */
  readonly todayPlan: 'training' | 'rest' | null;
  /** Device-local date of the latest body weight, or `null`. */
  readonly lastWeightDate: string | null;
  /** Wellness-safety evaluation date, or `null` when there is none. */
  readonly evaluationDate: string | null;
}

/** A weigh-in is due when nothing was logged for this many days. */
export const WEIGH_IN_DAYS = 7;
/** The evaluation is worth reviewing after this many days. */
export const EVALUATION_REVIEW_DAYS = 90;

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`);
  return Math.round(ms / 86_400_000);
}

export function buildNotifications(inputs: NotificationInputs): AppNotification[] {
  const items: AppNotification[] = [];
  if (inputs.todayPlan === 'training') {
    items.push({
      id: `today-training:${inputs.today}`,
      kind: 'today-training',
      target: 'workouts',
    });
  } else if (inputs.todayPlan === 'rest') {
    items.push({ id: `today-rest:${inputs.today}`, kind: 'today-rest', target: 'workouts' });
  }
  if (
    inputs.lastWeightDate === null ||
    daysBetween(inputs.lastWeightDate, inputs.today) >= WEIGH_IN_DAYS
  ) {
    items.push({ id: `weigh-in:${inputs.weekStart}`, kind: 'weigh-in', target: 'progress' });
  }
  if (
    inputs.evaluationDate === null ||
    daysBetween(inputs.evaluationDate, inputs.today) >= EVALUATION_REVIEW_DAYS
  ) {
    items.push({
      id: `evaluation-review:${inputs.today.slice(0, 7)}`,
      kind: 'evaluation-review',
      target: 'profile',
    });
  }
  return items;
}

/** Unread = not in the read set. Order is the rule order above. */
export function unreadOf(
  items: readonly AppNotification[],
  readIds: ReadonlySet<string>,
): AppNotification[] {
  return items.filter((item) => !readIds.has(item.id));
}
